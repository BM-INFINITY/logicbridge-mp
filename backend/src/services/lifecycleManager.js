const mongoose = require('mongoose');
const { stopScheduler } = require('./scheduler');
const { getActiveExecutionsCount, waitForActiveExecutions } = require('./workflowEngine');
const dataRetentionService = require('./dataRetentionService');

/**
 * Production Process Lifecycle & Graceful Shutdown Manager for LogicBridge Backend.
 * Handles SIGTERM, SIGINT, process exceptions, in-flight execution drainage, and resource cleanup.
 */
class LifecycleManager {
  constructor() {
    this._isShuttingDown = false;
    this._server = null;
    this._shutdownPromise = null;
    this._signalHandlersRegistered = false;
    this._exceptionHandlersRegistered = false;
  }

  /**
   * Registers the active Express HTTP server instance.
   * @param {import('http').Server} server
   */
  registerServer(server) {
    this._server = server;
  }

  /**
   * Returns whether the application is currently undergoing graceful shutdown.
   * @returns {boolean}
   */
  isShuttingDown() {
    return this._isShuttingDown;
  }

  /**
   * Explicitly sets the shutting down state (primarily used in test environments).
   * @param {boolean} val
   */
  setShuttingDown(val) {
    this._isShuttingDown = Boolean(val);
  }

  /**
   * Registers OS signal listeners for SIGTERM and SIGINT.
   */
  registerSignalHandlers() {
    if (this._signalHandlersRegistered) return;
    this._signalHandlersRegistered = true;

    process.on('SIGTERM', () => {
      console.log('🛑 [Lifecycle] Received SIGTERM signal. Initiating graceful shutdown...');
      this.initiateShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('🛑 [Lifecycle] Received SIGINT signal. Initiating graceful shutdown...');
      this.initiateShutdown('SIGINT');
    });
  }

  /**
   * Registers top-level process exception handlers for unhandled rejections and uncaught exceptions.
   * Structured diagnostics are emitted without exposing credentials or secrets.
   */
  setupProcessExceptionHandlers() {
    if (this._exceptionHandlersRegistered) return;
    this._exceptionHandlersRegistered = true;

    process.on('uncaughtException', (err) => {
      this._logProcessDiagnostic('UNCAUGHT_EXCEPTION', err);
      // Controlled shutdown upon fatal uncaught exceptions
      this.initiateShutdown('uncaughtException', { exitCode: 1 });
    });

    process.on('unhandledRejection', (reason) => {
      this._logProcessDiagnostic('UNHANDLED_REJECTION', reason);
      // Controlled shutdown upon unhandled promise rejections
      this.initiateShutdown('unhandledRejection', { exitCode: 1 });
    });
  }

  /**
   * Safely formats and logs process diagnostics without recursive failure.
   * @private
   */
  _logProcessDiagnostic(type, err) {
    try {
      const message = err instanceof Error ? err.message : String(err);
      const isProd = process.env.NODE_ENV === 'production';
      const diagnostic = {
        level: 'FATAL',
        event: type,
        timestamp: new Date().toISOString(),
        message: message.replace(/(password|secret|token|key)=([^& \t\n]+)/gi, '$1=[REDACTED]'),
        stack: !isProd && err instanceof Error ? err.stack : undefined,
      };
      console.error(`💥 [Lifecycle] ${type}:`, JSON.stringify(diagnostic));
    } catch {
      console.error(`💥 [Lifecycle] ${type} encountered (diagnostic serialization failed)`);
    }
  }

  /**
   * Initiates graceful shutdown sequence.
   * Idempotent: repeated invocations return the same in-progress shutdown promise.
   *
   * @param {string} [signal='SIGTERM'] - Initiating signal or reason
   * @param {object} [options={}] - Custom options { timeoutMs, exitCode, skipExit }
   * @returns {Promise<object>} Summary of shutdown execution
   */
  initiateShutdown(signal = 'SIGTERM', options = {}) {
    if (this._shutdownPromise) {
      console.log(`⚠ [Lifecycle] Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
      return this._shutdownPromise;
    }

    this._isShuttingDown = true;
    const timeoutMs = options.timeoutMs || parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 15000;
    const exitCode = typeof options.exitCode === 'number' ? options.exitCode : 0;
    const skipExit = options.skipExit !== undefined ? options.skipExit : process.env.NODE_ENV === 'test';

    console.log(`🛡 [Lifecycle] Graceful shutdown sequence starting (timeout: ${timeoutMs}ms, trigger: ${signal})`);

    this._shutdownPromise = (async () => {
      const steps = [];

      // Step 1: Stop HTTP Server from accepting new requests
      if (this._server && typeof this._server.close === 'function') {
        try {
          await new Promise((resolve, reject) => {
            this._server.close((err) => {
              if (err) return reject(err);
              resolve();
            });
          });
          console.log('✓ [Lifecycle] HTTP server closed to new connections');
          steps.push('http_server_closed');
        } catch (serverErr) {
          console.warn('⚠ [Lifecycle] HTTP server close encountered error:', serverErr.message);
          steps.push('http_server_close_error');
        }
      }

      // Step 2: Stop Scheduler polling worker and Data Retention worker
      try {
        stopScheduler();
        dataRetentionService.stopRetentionWorker();
        console.log('✓ [Lifecycle] Scheduler & retention polling terminated');
        steps.push('scheduler_stopped');
      } catch (schedErr) {
        console.warn('⚠ [Lifecycle] Scheduler stop encountered error:', schedErr.message);
        steps.push('scheduler_stop_error');
      }

      // Step 3: Wait for active in-flight workflow executions to finish or checkpoint
      try {
        const activeCount = getActiveExecutionsCount();
        if (activeCount > 0) {
          console.log(`⏳ [Lifecycle] Waiting for ${activeCount} active workflow execution(s) to finish...`);
          const completedCleanly = await waitForActiveExecutions(timeoutMs);
          if (completedCleanly) {
            console.log('✓ [Lifecycle] All active workflow executions finished cleanly');
            steps.push('active_executions_drained');
          } else {
            console.warn(`⚠ [Lifecycle] Shutdown timeout reached with executions still pending`);
            steps.push('active_executions_timed_out');
          }
        } else {
          console.log('✓ [Lifecycle] Zero active workflow executions in progress');
          steps.push('no_active_executions');
        }
      } catch (execErr) {
        console.warn('⚠ [Lifecycle] Error while waiting for active executions:', execErr.message);
        steps.push('active_executions_error');
      }

      // Step 4: Close MongoDB connection cleanly
      try {
        if (mongoose.connection && mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          console.log('✓ [Lifecycle] MongoDB connection closed cleanly');
          steps.push('mongodb_closed');
        }
      } catch (dbErr) {
        console.warn('⚠ [Lifecycle] MongoDB disconnect encountered error:', dbErr.message);
        steps.push('mongodb_close_error');
      }

      console.log(`🏁 [Lifecycle] Graceful shutdown sequence completed. Trigger: ${signal}`);

      if (!skipExit) {
        setTimeout(() => process.exit(exitCode), 100);
      }

      return {
        success: true,
        signal,
        steps,
        exitCode,
      };
    })();

    return this._shutdownPromise;
  }
}

// Export singleton instance
const lifecycleManager = new LifecycleManager();

module.exports = lifecycleManager;
