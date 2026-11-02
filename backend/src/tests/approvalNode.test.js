/**
 * approvalNode.test.js
 *
 * Tests for Human Approval Node (`action-approval`):
 * 1. Metadata and registry checks
 * 2. Configuration validation
 * 3. Dynamic variable resolution in title/description/message
 * 4. Execution pause signal generation with allowed approvers and timeout config
 * 5. Resumption handling for approved, rejected, and timeout branches
 */

const assert = require('assert');
const ApprovalNode = require('../nodes/ApprovalNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { ExecutionContext } = require('../utils');
const ExecutionPauseSignal = require('../errors/ExecutionPauseSignal');

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Approval Node Unit Tests...\n');

  const node = new ApprovalNode();

  // ── Group 1: Metadata & Registration ──────────────────────────────────────
  console.log('Group 1: Metadata & Registration');
  check('Correct node type', node.type === NodeTypes.ACTION_APPROVAL);
  check('Category is action', node.category === 'action');
  check('Node name is Human Approval', node.name === 'Human Approval');

  // ── Group 2: Configuration Validation ─────────────────────────────────────
  console.log('\nGroup 2: Configuration Validation');
  {
    const missingTitle = node.validate({ data: {} });
    check('Rejects missing title', !missingTitle.valid && missingTitle.error.includes('title is required'));

    const emptyTitle = node.validate({ data: { title: '   ' } });
    check('Rejects empty title string', !emptyTitle.valid);

    const validBasic = node.validate({ data: { title: 'Invoice Approval' } });
    check('Accepts valid title', validBasic.valid);

    const invalidTimeout = node.validate({ data: { title: 'Approval', timeoutMinutes: -5 } });
    check('Rejects negative timeout', !invalidTimeout.valid);

    const invalidAction = node.validate({ data: { title: 'Approval', timeoutAction: 'explode' } });
    check('Rejects invalid timeout action', !invalidAction.valid);

    const validTimeout = node.validate({ data: { title: 'Approval', timeoutMinutes: 60, timeoutAction: 'reject' } });
    check('Accepts valid timeout config', validTimeout.valid);
  }

  // ── Group 3: Execution Pause Signal & Dynamic Resolution ───────────────────
  console.log('\nGroup 3: Execution Pause Signal & Dynamic Resolution');
  {
    const context = new ExecutionContext({
      variables: { invoiceId: 'INV-2026', requesterEmail: 'alice@example.com' },
    });
    context.lastOutput = { totalAmount: 4500 };

    let pauseCaught = null;
    try {
      await node.execute(
        {
          id: 'approval_node_1',
          data: {
            title: 'Approve Invoice {{variables.invoiceId}}',
            description: 'Requested by {{variables.requesterEmail}}',
            message: 'Amount: ${{totalAmount}} requires manager sign-off.',
            allowedApprovers: 'finance@example.com, manager@example.com',
            approverRole: 'finance_manager',
            timeoutMinutes: '120',
            timeoutAction: 'reject',
          },
        },
        context
      );
    } catch (err) {
      if (err instanceof ExecutionPauseSignal) {
        pauseCaught = err;
      }
    }

    check('Throws ExecutionPauseSignal on initial run', pauseCaught !== null);
    check('Signal pauseType is approval', pauseCaught?.pauseType === 'approval');
    check(
      'Resolves dynamic variables in title',
      pauseCaught?.details?.title === 'Approve Invoice INV-2026'
    );
    check(
      'Resolves dynamic variables in description',
      pauseCaught?.details?.description === 'Requested by alice@example.com'
    );
    check(
      'Resolves dynamic previous output in message',
      pauseCaught?.details?.message.includes('4500')
    );
    check(
      'Parses comma-separated allowed approvers',
      Array.isArray(pauseCaught?.details?.allowedApprovers) &&
        pauseCaught.details.allowedApprovers.length === 2 &&
        pauseCaught.details.allowedApprovers.includes('finance@example.com')
    );
    check('Preserves approver role', pauseCaught?.details?.approverRole === 'finance_manager');
    check('Parses timeoutMinutes as number', pauseCaught?.details?.timeoutMinutes === 120);
    check('Sets timeoutAction to reject', pauseCaught?.details?.timeoutAction === 'reject');
  }

  // ── Group 4: Resumption Handling ──────────────────────────────────────────
  console.log('\nGroup 4: Resumption Handling');
  {
    // 4.1: Approved decision
    const approveContext = new ExecutionContext({});
    approveContext.resumingApproval = {
      approvalId: 'appr_123',
      nodeId: 'approval_node_1',
      status: 'approved',
      decision: 'approved',
      decidedBy: 'manager@example.com',
      decidedAt: '2026-11-02T12:00:00.000Z',
      comments: 'Approved under Q4 budget policy',
    };

    const approveOutput = await node.execute(
      { id: 'approval_node_1', data: { title: 'Approve Invoice' } },
      approveContext
    );

    check('Returns approved status on approval resume', approveOutput.status === 'approved');
    check('Returns approved decision', approveOutput.decision === 'approved');
    check('Selects approved branch', approveOutput.selectedBranch === BranchTypes.APPROVED);
    check('Includes approver email', approveOutput.decidedBy === 'manager@example.com');
    check('Includes comments', approveOutput.comments === 'Approved under Q4 budget policy');
    check('Flags as resumed', approveOutput.resumed === true);

    // 4.2: Rejected decision
    const rejectContext = new ExecutionContext({});
    rejectContext.resumingApproval = {
      approvalId: 'appr_123',
      nodeId: 'approval_node_1',
      status: 'rejected',
      decision: 'rejected',
      decidedBy: 'finance@example.com',
      decidedAt: '2026-11-02T12:05:00.000Z',
      comments: 'Receipt missing attachment',
    };

    const rejectOutput = await node.execute(
      { id: 'approval_node_1', data: { title: 'Approve Invoice' } },
      rejectContext
    );

    check('Returns rejected status on rejection resume', rejectOutput.status === 'rejected');
    check('Returns rejected decision', rejectOutput.decision === 'rejected');
    check('Selects rejected branch', rejectOutput.selectedBranch === BranchTypes.REJECTED);
    check('Includes rejection comments', rejectOutput.comments === 'Receipt missing attachment');

    // 4.3: Timeout decision
    const timeoutContext = new ExecutionContext({});
    timeoutContext.resumingApproval = {
      approvalId: 'appr_123',
      nodeId: 'approval_node_1',
      status: 'timeout',
      decidedBy: 'system',
      decidedAt: '2026-11-02T14:00:00.000Z',
      comments: 'Auto-resolved via approval timeout',
    };

    const timeoutOutput = await node.execute(
      { id: 'approval_node_1', data: { title: 'Approve Invoice' } },
      timeoutContext
    );

    check('Returns timeout status on timeout resume', timeoutOutput.status === 'timeout');
    check('Selects timeout branch', timeoutOutput.selectedBranch === BranchTypes.TIMEOUT);
  }

  console.log(`\nApproval Node Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
