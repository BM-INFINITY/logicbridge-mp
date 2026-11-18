const os = require('os');
const crypto = require('crypto');

/**
 * Generates a globally collision-resistant worker ID across physical machines,
 * virtual machines, Docker containers (even with identical PID 1), and Kubernetes pods.
 *
 * @param {string} [prefix='worker']
 * @returns {string} Globally unique worker identifier
 */
function generateWorkerId(prefix = 'worker') {
  if (process.env.WORKER_ID && String(process.env.WORKER_ID).trim()) {
    return String(process.env.WORKER_ID).trim();
  }
  const rawHost = os.hostname() || 'node';
  const sanitizedHost = rawHost.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'host';
  const pid = process.pid || 1;
  const rand = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : crypto.randomBytes(8).toString('hex');

  return `${prefix}_${sanitizedHost}_${pid}_${rand}`;
}

module.exports = { generateWorkerId };
