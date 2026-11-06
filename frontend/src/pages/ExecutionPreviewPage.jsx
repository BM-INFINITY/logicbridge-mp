import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, RefreshCw, UserCheck, Clock,
  Play, RotateCcw, Sliders, Activity, Database, Sparkles, Brain, Wrench
} from 'lucide-react';
import {
  NodeInspector,
  ErrorDebugger,
  AgentToolCallViewer,
  ExecutionDetailModal,
  ExecutionTimeline,
  TimelineNode,
} from '../components/execution';
import { JsonViewer, Button, Badge, StatusIndicator, Card } from '../components/ui';

// Mock rich execution dataset
const MOCK_EXECUTIONS = [
  {
    _id: '672010a8b9e14c3300000001',
    workflow: { _id: 'wf_slack_alert', name: 'Order Notification & Customer Alert' },
    status: 'success',
    trigger: 'webhook',
    duration: 1420,
    startedAt: '2026-11-06T13:45:00.000Z',
    finishedAt: '2026-11-06T13:45:01.420Z',
    steps: [
      {
        nodeId: 'node_order_trigger',
        nodeName: 'Order Webhook',
        nodeType: 'trigger-webhook',
        status: 'success',
        duration: 35,
        output: { event: 'order.created', orderId: 'ORD-9841', amount: 149.99, currency: 'USD', customer: { email: 'sarah@example.com', name: 'Sarah Chen' } },
      },
      {
        nodeId: 'node_check_tier',
        nodeName: 'Check VIP Tier',
        nodeType: 'logic-condition',
        status: 'success',
        duration: 20,
        output: { passed: true, selectedBranch: 'true', expression: '{{order.amount}} >= 100' },
      },
      {
        nodeId: 'node_ai_summary',
        nodeName: 'Generate Order Summary',
        nodeType: 'action-ai-agent',
        status: 'success',
        duration: 850,
        output: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          thought: 'The order amount is $149.99 (VIP Tier). Querying inventory status and generating personalized confirmation note.',
          toolCalls: [
            {
              iteration: 1,
              tool: 'inventoryLookup',
              args: { sku: 'PRO-WIDGET-01', location: 'us-east' },
              result: { availableStock: 42, warehouse: 'Newark Hub', shippingEstimate: '1-2 business days' },
              durationMs: 120,
            },
            {
              iteration: 2,
              tool: 'customerLoyalty',
              args: { email: 'sarah@example.com' },
              result: { tier: 'Gold VIP', pointsBalance: 2450, discountApplied: '15%' },
              durationMs: 95,
            },
          ],
          iterations: 2,
          tokenUsage: { promptTokens: 380, completionTokens: 95, totalTokens: 475 },
          text: 'Order ORD-9841 confirmed for Gold VIP customer Sarah Chen. 1x PRO-WIDGET-01 allocated from Newark Hub with 15% VIP discount applied. Estimated delivery: 1-2 business days.',
        },
      },
      {
        nodeId: 'node_slack_notify',
        nodeName: 'Slack VIP Channel',
        nodeType: 'action-slack',
        status: 'success',
        duration: 180,
        output: { channel: '#sales-vip-orders', messageId: 'msg_1730894520', delivered: true },
      },
    ],
  },
  {
    _id: '672010a8b9e14c3300000002',
    workflow: { _id: 'wf_db_sync', name: 'Stripe Billing & PostgreSQL Sync' },
    status: 'failed',
    trigger: 'schedule',
    duration: 3200,
    startedAt: '2026-11-06T13:40:00.000Z',
    finishedAt: '2026-11-06T13:40:03.200Z',
    error: '401 Unauthorized: Invalid API Key provided for PostgreSQL service connection',
    steps: [
      {
        nodeId: 'node_cron',
        nodeName: 'Hourly Cron Trigger',
        nodeType: 'trigger-schedule',
        status: 'success',
        duration: 15,
        output: { cron: '0 * * * *', timestamp: '2026-11-06T13:40:00.000Z' },
      },
      {
        nodeId: 'node_fetch_charges',
        nodeName: 'Fetch Stripe Charges',
        nodeType: 'action-http',
        status: 'success',
        duration: 680,
        output: { status: 200, chargesCount: 14, totalVolume: 4210.50 },
      },
      {
        nodeId: 'node_pg_upsert',
        nodeName: 'PostgreSQL Upsert Records',
        nodeType: 'action-postgres',
        status: 'failed',
        duration: 2500,
        error: '401 Unauthorized: Invalid API Key provided for PostgreSQL service connection',
        input: { table: 'billing_events', batchSize: 14, connectionId: 'conn_pg_prod_01' },
      },
    ],
  },
  {
    _id: '672010a8b9e14c3300000003',
    workflow: { _id: 'wf_invoice_proc', name: 'Contract Review & Human Approval' },
    status: 'waiting_approval',
    trigger: 'manual',
    duration: 650,
    startedAt: '2026-11-06T13:30:00.000Z',
    approval: {
      status: 'pending',
      title: 'Approve $5,000 Vendor Payment',
      message: 'Vendor Acme Corp invoice #INV-2026-88 requires CFO approval before disbursement.',
      allowedApprovers: ['cfo@company.com', 'finance-lead@company.com'],
      approverRole: 'finance-admin',
      timeoutMinutes: 120,
    },
    steps: [
      {
        nodeId: 'node_parse_pdf',
        nodeName: 'Parse Invoice PDF',
        nodeType: 'action-transform',
        status: 'success',
        duration: 110,
        output: { vendor: 'Acme Corp', invoiceNumber: 'INV-2026-88', total: 5000 },
      },
      {
        nodeId: 'node_approval_step',
        nodeName: 'Require CFO Signoff',
        nodeType: 'action-approval',
        status: 'waiting',
        duration: 45,
        output: { status: 'waiting_approval', allowedRole: 'finance-admin' },
      },
    ],
  },
  {
    _id: '672010a8b9e14c3300000004',
    workflow: { _id: 'wf_ai_agent', name: 'Autonomous Support Ticket Resolver' },
    status: 'running',
    trigger: 'webhook',
    duration: 4100,
    startedAt: '2026-11-06T13:48:10.000Z',
    steps: [
      {
        nodeId: 'node_ticket_in',
        nodeName: 'Zendesk Ticket Webhook',
        nodeType: 'trigger-webhook',
        status: 'success',
        duration: 25,
        output: { ticketId: 'TICK-4912', subject: 'Cannot reset password via magic link' },
      },
      {
        nodeId: 'node_agent_solve',
        nodeName: 'Autonomous Agent Resolver',
        nodeType: 'action-ai-agent',
        status: 'running',
        duration: 4050,
        output: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          thought: 'User is unable to receive password reset emails. Checking user email verification status and bounce logs.',
          toolCalls: [
            {
              iteration: 1,
              tool: 'emailBounceLookup',
              args: { email: 'user491@domain.com' },
              result: { bounceCount: 1, reason: 'Temporary mailbox full (soft bounce)' },
              durationMs: 310,
            },
          ],
        },
      },
    ],
  },
];

export default function ExecutionPreviewPage() {
  const params = new URLSearchParams(window.location.search);
  const view = (typeof window !== 'undefined' && window.__PREVIEW_VIEW__) || params.get('view') || 'logs';
  const theme = (typeof window !== 'undefined' && window.__PREVIEW_THEME__) || params.get('theme') || 'dark';

  const [selectedExec, setSelectedExec] = useState(MOCK_EXECUTIONS[0]);
  const [modalOpen, setModalOpen] = useState(view === 'modal');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: view === 'logs' ? 0 : 24,
      }}
    >
      {/* ── 1. Logs Dashboard View ────────────────────────────────────────── */}
      {view === 'logs' && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Execution Monitoring & Logs</h1>
                <span
                  style={{
                    background: 'rgba(108,99,255,0.15)',
                    border: '1px solid rgba(108,99,255,0.3)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span className="spinner" style={{ width: 10, height: 10 }} />
                  2 Active Runs
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Comprehensive real-time tracking, payload inspection, diagnostics, and debugging traces
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />}>
              Refresh
            </Button>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Executions</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>4</div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Success Rate</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-success)', marginTop: 2 }}>75%</div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Average Duration</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: 2 }}>1.76s</div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active / In Flight</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: 2 }}>2</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <input
                className="form-input"
                style={{ flex: 1, height: 36, fontSize: '0.82rem' }}
                placeholder="Search workflow name, execution ID, trigger, or step..."
                defaultValue=""
              />
              <select className="form-select" style={{ width: 'auto', minWidth: 160, height: 36, fontSize: '0.8rem' }}>
                <option>All Workflows (4)</option>
                <option>Order Notification & Customer Alert</option>
                <option>Stripe Billing & PostgreSQL Sync</option>
                <option>Contract Review & Human Approval</option>
                <option>Autonomous Support Ticket Resolver</option>
              </select>
              <select className="form-select" style={{ width: 'auto', minWidth: 140, height: 36, fontSize: '0.8rem' }}>
                <option>Past 24 Hours</option>
                <option>All Time</option>
                <option>Last 7 Days</option>
              </select>
              <select className="form-select" style={{ width: 'auto', minWidth: 140, height: 36, fontSize: '0.8rem' }}>
                <option>Latest First</option>
                <option>Duration (Longest)</option>
              </select>
            </div>

            {/* Status pills */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 3, borderRadius: 6, border: '1px solid var(--border)' }}>
                <button className="btn btn-sm btn-primary" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>All Statuses</button>
                <button className="btn btn-sm btn-ghost" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Success</button>
                <button className="btn btn-sm btn-ghost" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Failed</button>
                <button className="btn btn-sm btn-ghost" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Running</button>
                <button className="btn btn-sm btn-ghost" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Waiting Approval</button>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Showing 1–4 of 4 executions</span>
            </div>
          </div>

          {/* Executions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_EXECUTIONS.map((exec) => (
              <div
                key={exec._id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusIndicator
                    status={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'error' : exec.status === 'running' ? 'running' : 'warning'}
                    label={exec.status}
                    size="sm"
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{exec.workflow.name}</span>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>
                    {exec._id.slice(-6)}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                    {exec.trigger}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{exec.steps.length} steps</span>
                  <span>{exec.duration ? `${(exec.duration / 1000).toFixed(2)}s` : 'running...'}</span>
                  <span>{new Date(exec.startedAt).toLocaleTimeString()}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn-sm btn-primary" style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sliders size={11} /> Inspect
                  </button>
                  <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Play size={11} /> Replay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Execution Detail Modal View ─────────────────────────────────── */}
      {view === 'modal' && (
        <div>
          <ExecutionDetailModal
            execution={selectedExec}
            isOpen={true}
            onClose={() => {}}
            onExecutionUpdate={(updated) => setSelectedExec(updated)}
          />
        </div>
      )}

      {/* ── 3. Node Inspector View ─────────────────────────────────────────── */}
      {view === 'inspector' && (
        <div style={{ maxWidth: 840, margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Node Input & Output Inspector</div>
          <NodeInspector step={MOCK_EXECUTIONS[0].steps[2]} />
        </div>
      )}

      {/* ── 4. Error Debugger Diagnostic View ─────────────────────────────── */}
      {view === 'debugger' && (
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>Runtime Error Diagnostic & Suggestion Engine</div>
          <ErrorDebugger
            error={MOCK_EXECUTIONS[1].error}
            nodeName="PostgreSQL Upsert Records"
            nodeType="action-postgres"
            technicalContext={{
              nodeId: 'node_pg_upsert',
              connectionId: 'conn_pg_prod_01',
              timestamp: '2026-11-06T13:40:02.500Z',
              input: MOCK_EXECUTIONS[1].steps[2].input,
            }}
            onRetry={() => alert('Retry triggered')}
          />
        </div>
      )}

      {/* ── 5. AI Agent Tool Call Trace View ──────────────────────────────── */}
      {view === 'agent' && (
        <div style={{ maxWidth: 800, margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={18} color="var(--accent-primary)" />
            AI Agent Multi-Turn Execution Sequence
          </div>
          <AgentToolCallViewer output={MOCK_EXECUTIONS[0].steps[2].output} />
        </div>
      )}

      {/* ── 6. Execution Timeline Canvas Overlay View ─────────────────────── */}
      {view === 'timeline' && (
        <div style={{ maxWidth: 900, margin: '40px auto 0' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Execution Timeline Step Sequence</div>
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
              <TimelineNode
                snapshot={{
                  nodeId: 'node_order_trigger',
                  nodeName: 'Order Webhook',
                  nodeType: 'trigger-webhook',
                  status: 'success',
                  duration: 35,
                }}
                index={0}
                isSelected={false}
                isActive={false}
                onClick={() => {}}
              />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <TimelineNode
                snapshot={{
                  nodeId: 'node_check_tier',
                  nodeName: 'Check VIP Tier',
                  nodeType: 'logic-condition',
                  status: 'success',
                  duration: 20,
                  output: { passed: true, selectedBranch: 'true' },
                  selectedBranches: { node_check_tier: 'true' },
                }}
                index={1}
                isSelected={true}
                isActive={true}
                onClick={() => {}}
              />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <TimelineNode
                snapshot={{
                  nodeId: 'node_ai_summary',
                  nodeName: 'Generate Order Summary',
                  nodeType: 'action-ai-agent',
                  status: 'success',
                  duration: 850,
                  output: { iterations: 2 },
                }}
                index={2}
                isSelected={false}
                isActive={false}
                onClick={() => {}}
              />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <TimelineNode
                snapshot={{
                  nodeId: 'node_slack_notify',
                  nodeName: 'Slack VIP Channel',
                  nodeType: 'action-slack',
                  status: 'success',
                  duration: 180,
                }}
                index={3}
                isSelected={false}
                isActive={false}
                onClick={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}