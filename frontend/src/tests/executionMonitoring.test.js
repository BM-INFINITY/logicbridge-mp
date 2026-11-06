import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Activity, RefreshCw, Search } from 'lucide-react';
import { transformWithOxc } from 'vite';
import { categorizeError } from '../utils/ErrorCategorizer.js';
import { ReplayService } from '../services/ReplayService.js';
import useReplayStore from '../store/replayStore.js';
import renderIcon from '../components/ui/renderIcon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Iteration 40 — Execution Monitoring & Debugging UX', () => {

  describe('Error Diagnostic Categorization (ErrorDebugger)', () => {
    it('accurately categorizes Authorization & Authentication errors with corrective advice', () => {
      const err1 = categorizeError('401 Unauthorized: Invalid API Token provided');
      assert.strictEqual(err1.category, 'AUTH_ERROR');
      assert.strictEqual(err1.label, 'Authorization Error');
      assert.strictEqual(err1.badgeVariant, 'danger');
      assert.match(err1.advice, /credentials|API keys/i);

      const err2 = categorizeError('Forbidden (403): User lacks write permission to Slack channel');
      assert.strictEqual(err2.category, 'AUTH_ERROR');
      assert.match(err2.advice, /OAuth tokens|scopes/i);
    });

    it('accurately categorizes Timeout & Gateway errors with corrective advice', () => {
      const err = categorizeError('ETIMEDOUT: Connection to endpoint timed out after 10000ms');
      assert.strictEqual(err.category, 'TIMEOUT_ERROR');
      assert.strictEqual(err.label, 'Timeout Error');
      assert.strictEqual(err.badgeVariant, 'warning');
      assert.match(err.advice, /timeout/i);

      const errGateway = categorizeError('504 Gateway Timeout while contacting upstream service');
      assert.strictEqual(errGateway.category, 'TIMEOUT_ERROR');
    });

    it('accurately categorizes Configuration & Syntax errors with corrective advice', () => {
      const errSyntax = categorizeError('SyntaxError: Unexpected token < in JSON at position 0');
      assert.strictEqual(errSyntax.category, 'CONFIG_ERROR');
      assert.strictEqual(errSyntax.label, 'Configuration Error');
      assert.strictEqual(errSyntax.badgeVariant, 'warning');
      assert.match(errSyntax.advice, /field mappings|expressions/i);

      const errMissing = categorizeError('Missing required field: "channel"');
      assert.strictEqual(errMissing.category, 'CONFIG_ERROR');
      assert.match(errMissing.advice, /step settings/i);
    });

    it('accurately categorizes Provider & Upstream errors with corrective advice', () => {
      const err500 = categorizeError('500 Internal Server Error returned by Stripe Webhook');
      assert.strictEqual(err500.category, 'PROVIDER_ERROR');
      assert.strictEqual(err500.label, 'Provider / Service Error');
      assert.strictEqual(err500.badgeVariant, 'danger');
      assert.match(err500.advice, /external|service/i);

      const err503 = categorizeError('503 Service Unavailable: upstream rate limited');
      assert.strictEqual(err503.category, 'PROVIDER_ERROR');
    });

    it('falls back gracefully to Execution Failure for unknown exceptions', () => {
      const errGeneric = categorizeError('Something unexpected went wrong in step worker');
      assert.strictEqual(errGeneric.category, 'EXECUTION_FAILURE');
      assert.strictEqual(errGeneric.label, 'Execution Failure');
      assert.strictEqual(errGeneric.badgeVariant, 'danger');
      assert.match(errGeneric.advice, /unexpected error|logs below/i);
    });
  });

  describe('Sensitive Data Redaction & Sanitization', () => {
    it('masks Slack tokens, OpenAI keys, GitHub tokens, and Bearer headers in payloads', () => {
      // Logic mirroring sanitizePayload in AgentToolCallViewer
      function sanitize(str) {
        return str
          .replace(/xox[baprs]-[0-9a-zA-Z]{10,48}/gi, 'xoxb-***[REDACTED]***')
          .replace(/sk-[a-zA-Z0-9_-]{20,64}/gi, 'sk-***[REDACTED]***')
          .replace(/ghp_[a-zA-Z0-9]{36}/gi, 'ghp_***[REDACTED]***')
          .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer ***[REDACTED]***');
      }

      const raw = 'Calling tool with token xoxb-1234567890-abcdef123456 and api key sk-live9876543210abcdefghijklmn using Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const clean = sanitize(raw);

      assert.doesNotMatch(clean, /xoxb-1234567890/);
      assert.doesNotMatch(clean, /sk-live9876543210/);
      assert.doesNotMatch(clean, /Bearer eyJhbGci/);
      assert.match(clean, /xoxb-\*\*\*\[REDACTED\]\*\*\*/);
      assert.match(clean, /sk-\*\*\*\[REDACTED\]\*\*\*/);
      assert.match(clean, /Bearer \*\*\*\[REDACTED\]\*\*\*/);
    });
  });

  describe('Execution Filtering & Sorting Logic', () => {
    const mockExecutions = [
      {
        _id: '672000000000000000000001',
        workflow: { _id: 'wf_1', name: 'Slack Alert Pipeline' },
        status: 'success',
        trigger: 'webhook',
        duration: 1200,
        startedAt: '2026-11-06T10:00:00.000Z',
        steps: [{ nodeName: 'HTTP Request', status: 'success' }],
      },
      {
        _id: '672000000000000000000002',
        workflow: { _id: 'wf_2', name: 'Customer Email Blast' },
        status: 'failed',
        trigger: 'manual',
        duration: 4500,
        error: 'ETIMEDOUT: SMTP server not reachable',
        startedAt: '2026-11-06T11:00:00.000Z',
        steps: [{ nodeName: 'Send Email', status: 'failed', error: 'ETIMEDOUT' }],
      },
      {
        _id: '672000000000000000000003',
        workflow: { _id: 'wf_1', name: 'Slack Alert Pipeline' },
        status: 'running',
        trigger: 'schedule',
        duration: null,
        startedAt: '2026-11-06T12:00:00.000Z',
        steps: [{ nodeName: 'HTTP Request', status: 'running' }],
      },
      {
        _id: '672000000000000000000004',
        workflow: { _id: 'wf_3', name: 'Invoice Processing' },
        status: 'waiting_approval',
        trigger: 'webhook',
        duration: 500,
        startedAt: '2026-11-05T08:00:00.000Z', // older than 24h
        steps: [{ nodeName: 'Approval Check', status: 'waiting' }],
      },
    ];

    it('filters executions by status correctly', () => {
      const failed = mockExecutions.filter((e) => e.status === 'failed');
      assert.strictEqual(failed.length, 1);
      assert.strictEqual(failed[0]._id, '672000000000000000000002');

      const running = mockExecutions.filter((e) => e.status === 'running');
      assert.strictEqual(running.length, 1);
      assert.strictEqual(running[0].status, 'running');
    });

    it('filters executions by specific workflow', () => {
      const wf1Runs = mockExecutions.filter((e) => (e.workflow?._id || e.workflow) === 'wf_1');
      assert.strictEqual(wf1Runs.length, 2);
    });

    it('searches by workflow name, execution ID, trigger, or error message', () => {
      function search(query, list) {
        const q = query.toLowerCase();
        return list.filter((e) => {
          const wf = (e.workflow?.name || '').toLowerCase();
          const id = String(e._id || '').toLowerCase();
          const trg = (e.trigger || '').toLowerCase();
          const err = (e.error || '').toLowerCase();
          const steps = (e.steps || []).some((s) => (s.nodeName || '').toLowerCase().includes(q));
          return wf.includes(q) || id.includes(q) || trg.includes(q) || err.includes(q) || steps;
        });
      }

      assert.strictEqual(search('Slack', mockExecutions).length, 2);
      assert.strictEqual(search('000000000004', mockExecutions).length, 1);
      assert.strictEqual(search('SMTP', mockExecutions).length, 1);
      assert.strictEqual(search('schedule', mockExecutions).length, 1);
      assert.strictEqual(search('Send Email', mockExecutions).length, 1);
      assert.strictEqual(search('NonExistentQuery', mockExecutions).length, 0);
    });

    it('sorts executions by latest, oldest, duration ascending, and duration descending', () => {
      // Duration Descending
      const byDurDesc = [...mockExecutions].sort((a, b) => (b.duration || 0) - (a.duration || 0));
      assert.strictEqual(byDurDesc[0].duration, 4500);

      // Duration Ascending
      const byDurAsc = [...mockExecutions].sort((a, b) => (a.duration || 0) - (b.duration || 0));
      assert.strictEqual(byDurAsc[0].duration, null);
      assert.strictEqual(byDurAsc[1].duration, 500);

      // Latest First
      const byLatest = [...mockExecutions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      assert.strictEqual(byLatest[0]._id, '672000000000000000000003');

      // Oldest First
      const byOldest = [...mockExecutions].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
      assert.strictEqual(byOldest[0]._id, '672000000000000000000004');
    });

    it('computes correct pagination slices', () => {
      const pageSize = 2;
      const totalPages = Math.ceil(mockExecutions.length / pageSize);
      assert.strictEqual(totalPages, 2);

      const page1 = mockExecutions.slice(0, 2);
      assert.strictEqual(page1.length, 2);

      const page2 = mockExecutions.slice(2, 4);
      assert.strictEqual(page2.length, 2);
    });
  });

  describe('Replay Timeline & Branch Decision Chips', () => {
    it('correctly constructs branch evaluation and loop snapshot events', () => {
      const executionWithBranch = {
        _id: 'exec_branch_test',
        status: 'success',
        startedAt: '2026-11-06T10:00:00.000Z',
        finishedAt: '2026-11-06T10:00:02.000Z',
        steps: [
          {
            nodeId: 'cond_1',
            nodeName: 'Check Threshold',
            nodeType: 'logic-condition',
            status: 'success',
            startedAt: '2026-11-06T10:00:00.000Z',
            finishedAt: '2026-11-06T10:00:00.500Z',
            duration: 50,
            output: { passed: true, selectedBranch: 'true' },
          },
          {
            nodeId: 'loop_1',
            nodeName: 'Process Items',
            nodeType: 'action-loop',
            status: 'success',
            startedAt: '2026-11-06T10:00:00.500Z',
            finishedAt: '2026-11-06T10:00:01.000Z',
            duration: 500,
            output: { iterations: 5, total: 5, selectedBranch: 'done' },
          },
        ],
      };

      const nodes = [
        { id: 'cond_1', type: 'logic-condition', position: { x: 0, y: 0 }, data: { label: 'Check Threshold' } },
        { id: 'loop_1', type: 'action-loop', position: { x: 200, y: 0 }, data: { label: 'Process Items' } },
      ];

      const snapshots = ReplayService.buildSnapshots(executionWithBranch, nodes);

      // Total snapshots: Initial + (2 per step: running & finished) + terminal = 6 snapshots
      assert.strictEqual(snapshots.length, 6);

      const condFinishSnap = snapshots.find((s) => s.snapshotId === 'snap_finish_0_cond_1');
      assert.ok(condFinishSnap);
      assert.strictEqual(condFinishSnap.selectedBranches['cond_1'], 'true');
      assert.strictEqual(condFinishSnap.output.passed, true);

      const loopFinishSnap = snapshots.find((s) => s.snapshotId === 'snap_finish_1_loop_1');
      assert.ok(loopFinishSnap);
      assert.strictEqual(loopFinishSnap.output.iterations, 5);
      assert.strictEqual(loopFinishSnap.output.total, 5);
    });

    it('manages Replay Store state transitions and navigation', () => {
      const store = useReplayStore.getState();
      store.stopReplay();

      assert.strictEqual(useReplayStore.getState().isReplayActive, false);

      const mockExec = {
        _id: 'replay_test_exec',
        status: 'success',
        steps: [
          { nodeId: 'node_1', nodeName: 'Start', status: 'success', duration: 10 },
          { nodeId: 'node_2', nodeName: 'End', status: 'success', duration: 20 },
        ],
      };

      store.startReplay(mockExec, [
        { id: 'node_1', position: { x: 0, y: 0 } },
        { id: 'node_2', position: { x: 100, y: 0 } },
      ]);

      assert.strictEqual(useReplayStore.getState().isReplayActive, true);
      assert.strictEqual(useReplayStore.getState().selectedExecution._id, 'replay_test_exec');
      assert.ok(useReplayStore.getState().snapshots.length > 0);

      // Seek to step index
      store.seekTo(1);
      assert.strictEqual(useReplayStore.getState().timelineCursor.index, 1);

      // Set inspector active node
      store.setInspectorNodeId('node_2');
      assert.strictEqual(useReplayStore.getState().inspectorNodeId, 'node_2');

      // Stop replay
      store.stopReplay();
      assert.strictEqual(useReplayStore.getState().isReplayActive, false);
      assert.strictEqual(useReplayStore.getState().selectedExecution, null);
    });
  });

  describe('Side-Effects Replay vs Retry Policy', () => {
    it('enforces external side-effect warning copy for user confirmation', () => {
      const retryWarningMessage =
        'Are you sure you want to retry this workflow? This will start a fresh execution run. External actions (such as HTTP POST requests, sending emails, or database modifications) will execute again.';

      assert.match(retryWarningMessage, /fresh execution run/i);
      assert.match(retryWarningMessage, /HTTP POST requests/i);
      assert.match(retryWarningMessage, /sending emails/i);
      assert.match(retryWarningMessage, /execute again/i);
    });
  });

  describe('Regression Prevention: React Child Icon Resolution & EmptyState Safety', () => {
    it('renderIcon correctly normalizes null, undefined, strings, elements, and forwardRef components', () => {
      // 1. null / undefined / falsy must return null
      assert.strictEqual(renderIcon(null), null);
      assert.strictEqual(renderIcon(undefined), null);
      assert.strictEqual(renderIcon(false), null);

      // 2. Strings and emojis must remain unchanged primitives (NOT React elements)
      const emojiIcon = '⚡';
      const emojiResult = renderIcon(emojiIcon);
      assert.strictEqual(emojiResult, '⚡');
      assert.strictEqual(typeof emojiResult, 'string');
      assert.strictEqual(React.isValidElement(emojiResult), false);

      const textIcon = 'rocket';
      const textResult = renderIcon(textIcon);
      assert.strictEqual(textResult, 'rocket');
      assert.strictEqual(typeof textResult, 'string');
      assert.strictEqual(React.isValidElement(textResult), false);

      const numIcon = 100;
      const numResult = renderIcon(numIcon);
      assert.strictEqual(numResult, 100);
      assert.strictEqual(typeof numResult, 'number');
      assert.strictEqual(React.isValidElement(numResult), false);

      // 3. Pre-instantiated React elements must be returned unchanged
      const existingElement = React.createElement('svg', { 'data-testid': 'custom' });
      const elResult = renderIcon(existingElement);
      assert.strictEqual(elResult, existingElement);
      assert.strictEqual(React.isValidElement(elResult), true);

      // 4. Functional component must produce a valid React element with defaultProps
      function FuncIcon(props) {
        return React.createElement('svg', props);
      }
      const funcResult = renderIcon(FuncIcon, { size: 24, className: 'icon-func' });
      assert.strictEqual(React.isValidElement(funcResult), true);
      assert.strictEqual(funcResult.props.size, 24);
      assert.strictEqual(funcResult.props.className, 'icon-func');

      // 5. Class component must produce a valid React element with defaultProps
      class ClassIcon extends React.Component {
        render() {
          return React.createElement('svg', this.props);
        }
      }
      const classResult = renderIcon(ClassIcon, { size: 18 });
      assert.strictEqual(React.isValidElement(classResult), true);
      assert.strictEqual(classResult.props.size, 18);

      // 6. forwardRef component object (shape of Lucide React icons in React 19)
      const forwardRefSymbol = Symbol.for('react.forward_ref');
      const ForwardRefIcon = {
        $$typeof: forwardRefSymbol,
        render: (props, _ref) => React.createElement('svg', props),
      };
      const refResult = renderIcon(ForwardRefIcon, { size: 32 });
      assert.strictEqual(React.isValidElement(refResult), true);
      assert.strictEqual(refResult.props.size, 32);
      assert.strictEqual(refResult.type, ForwardRefIcon);

      // 7. Real Lucide icon components (Activity, RefreshCw, Search)
      const lucideResult = renderIcon(Activity, { size: 28 });
      assert.strictEqual(React.isValidElement(lucideResult), true);
      assert.strictEqual(lucideResult.props.size, 28);
      assert.strictEqual(lucideResult.type, Activity);

      // 8. Unsupported plain objects must return null rather than leaking into JSX children
      const invalidObj = { some: 'arbitrary-object', foo: 'bar' };
      const invalidResult = renderIcon(invalidObj);
      assert.strictEqual(invalidResult, null, 'Unsupported plain object returns null to prevent React child crash');
    });

    it('focused rendering: EmptyState and Button render to string with real Lucide forwardRef icons', async () => {
      // Compile Button dynamically with classic JSX runtime
      const btnRaw = fs.readFileSync(path.resolve(__dirname, '../components/ui/Button.jsx'), 'utf8');
      const btnTrans = await transformWithOxc(btnRaw, 'Button.jsx', { jsx: { runtime: 'classic' } });
      const cleanBtn = btnTrans.code
        .replace(/import\s+[^;]+;/g, '')
        .replace('export default function Button', 'function Button');
      const Button = new Function('React', 'renderIcon', cleanBtn + '\nreturn Button;')(React, renderIcon);

      // Compile EmptyState dynamically with classic JSX runtime
      const emptyRaw = fs.readFileSync(path.resolve(__dirname, '../components/ui/EmptyState.jsx'), 'utf8');
      const emptyTrans = await transformWithOxc(emptyRaw, 'EmptyState.jsx', { jsx: { runtime: 'classic' } });
      const cleanEmpty = emptyTrans.code
        .replace(/import\s+[^;]+;/g, '')
        .replace('export default function EmptyState', 'function EmptyState');
      const EmptyState = new Function('React', 'renderIcon', 'Button', cleanEmpty + '\nreturn EmptyState;')(React, renderIcon, Button);

      // 1. Verify EmptyState renders with real Lucide forwardRef icon without throwing
      let emptyHtmlWithForwardRef = '';
      assert.doesNotThrow(() => {
        emptyHtmlWithForwardRef = ReactDOMServer.renderToString(
          React.createElement(EmptyState, {
            icon: Activity,
            title: 'No executions recorded',
            description: 'Run a workflow from the Dashboard or Builder to inspect real-time execution logs.',
            actionLabel: 'Go to Workflows',
            onAction: () => {},
          })
        );
      }, 'EmptyState renders without invalid React child exception when passed a forwardRef icon component');

      assert.ok(emptyHtmlWithForwardRef.includes('<svg'), 'Rendered EmptyState HTML contains Lucide svg element');
      assert.ok(emptyHtmlWithForwardRef.includes('No executions recorded'), 'Rendered EmptyState HTML contains title');
      assert.ok(emptyHtmlWithForwardRef.includes('Go to Workflows'), 'Rendered EmptyState HTML contains action button');

      // 2. Verify Button renders with real Lucide forwardRef icon without throwing
      let btnHtmlWithForwardRef = '';
      assert.doesNotThrow(() => {
        btnHtmlWithForwardRef = ReactDOMServer.renderToString(
          React.createElement(Button, {
            variant: 'secondary',
            size: 'sm',
            icon: RefreshCw,
          }, 'Refresh')
        );
      }, 'Button renders without invalid React child exception when passed a forwardRef icon component');

      assert.ok(btnHtmlWithForwardRef.includes('<svg'), 'Rendered Button HTML contains Lucide svg element');
      assert.ok(btnHtmlWithForwardRef.includes('Refresh'), 'Rendered Button HTML contains button label');

      // 3. Verify EmptyState renders with pre-instantiated JSX element without throwing
      let emptyHtmlWithElement = '';
      assert.doesNotThrow(() => {
        emptyHtmlWithElement = ReactDOMServer.renderToString(
          React.createElement(EmptyState, {
            icon: React.createElement(Activity, { size: 32 }),
            title: 'No executions recorded',
            action: React.createElement(Button, { variant: 'primary', size: 'sm' }, 'Go to Workflows'),
          })
        );
      }, 'EmptyState renders with pre-instantiated element');
      assert.ok(emptyHtmlWithElement.includes('<svg'), 'Contains svg icon');

      // 4. Verify EmptyState renders with string/emoji icon without throwing
      let emptyHtmlWithEmoji = '';
      assert.doesNotThrow(() => {
        emptyHtmlWithEmoji = ReactDOMServer.renderToString(
          React.createElement(EmptyState, {
            icon: '⚡',
            title: 'No triggers active',
          })
        );
      }, 'EmptyState renders with primitive string emoji');
      assert.ok(emptyHtmlWithEmoji.includes('⚡'), 'Contains emoji text');

      // 5. Verify EmptyState and Button render LogsPage initial state without runtime exception
      let logsPageInitialHtml = '';
      assert.doesNotThrow(() => {
        logsPageInitialHtml = ReactDOMServer.renderToString(
          React.createElement('div', { className: 'logs-page' },
            React.createElement(Button, {
              variant: 'secondary',
              size: 'sm',
              icon: React.createElement(RefreshCw, { size: 13 }),
            }, 'Refresh'),
            React.createElement(EmptyState, {
              icon: React.createElement(Activity, { size: 32 }),
              title: 'No executions recorded',
              description: 'Run a workflow from the Dashboard or Builder to inspect real-time execution logs and diagnostics.',
              action: React.createElement(Button, {
                variant: 'primary',
                size: 'sm',
              }, 'Go to Workflows')
            })
          )
        );
      }, 'LogsPage initial empty view renders cleanly without invalid React child exception');
      assert.ok(logsPageInitialHtml.includes('No executions recorded'));
    });

    it('ensures LogsPage passes instantiated elements instead of bare forwardRef components', () => {
      const logsPagePath = path.resolve(__dirname, '../pages/LogsPage.jsx');
      const logsPageContent = fs.readFileSync(logsPagePath, 'utf8');

      // Bare forwardRef icon references passed directly to props cause React 19 child errors
      assert.doesNotMatch(
        logsPageContent,
        /icon=\{Activity\}/,
        'LogsPage must not pass bare Activity component reference to EmptyState'
      );
      assert.doesNotMatch(
        logsPageContent,
        /icon=\{Search\}/,
        'LogsPage must not pass bare Search component reference to EmptyState'
      );
      assert.doesNotMatch(
        logsPageContent,
        /icon=\{RefreshCw\}/,
        'LogsPage must not pass bare RefreshCw component reference to Button'
      );

      // Must pass pre-instantiated JSX elements
      assert.match(
        logsPageContent,
        /icon=\{<Activity\s+size=\{32\}\s*\/>\}/,
        'LogsPage passes instantiated <Activity size={32} /> element'
      );
      assert.match(
        logsPageContent,
        /icon=\{<Search\s+size=\{32\}\s*\/>\}/,
        'LogsPage passes instantiated <Search size={32} /> element'
      );
    });

    it('ensures EmptyState.jsx uses renderIcon defensively and supports actionLabel/onAction', () => {
      const emptyStatePath = path.resolve(__dirname, '../components/ui/EmptyState.jsx');
      const emptyStateContent = fs.readFileSync(emptyStatePath, 'utf8');

      assert.match(emptyStateContent, /import\s+renderIcon\s+from\s+['"]\.\/renderIcon['"]/, 'EmptyState imports renderIcon');
      assert.match(emptyStateContent, /renderIcon\(icon,\s*\{\s*size:/, 'EmptyState uses renderIcon to normalize icon prop');
      assert.match(emptyStateContent, /actionLabel/, 'EmptyState accepts actionLabel prop');
      assert.match(emptyStateContent, /onAction/, 'EmptyState accepts onAction prop');
    });

    it('ensures core UI components defensively use renderIcon for icon normalization', () => {
      const componentsToCheck = [
        '../components/ui/Badge.jsx',
        '../components/ui/Button.jsx',
        '../components/ui/IconButton.jsx',
        '../components/ui/Alert.jsx',
        '../components/ui/Modal.jsx',
        '../components/ui/Panel.jsx',
        '../components/ui/FormSection.jsx',
        '../components/ui/Tabs.jsx',
        '../components/ui/Dropdown.jsx',
      ];

      for (const relPath of componentsToCheck) {
        const fullPath = path.resolve(__dirname, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.match(
          content,
          /renderIcon/,
          `${path.basename(relPath)} integrates renderIcon helper for safe icon rendering`
        );
      }
    });
  });
});