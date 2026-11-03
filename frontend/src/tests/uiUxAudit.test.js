/**
 * Unit Tests for Iteration 37 UI/UX Audit & Standardization
 * Covers:
 *   - ConfirmDialog accessibility & variants
 *   - AgentToolCallViewer trace & metrics handling
 *   - SwitchField role="switch" accessibility
 *   - Theme variables and CSS classes
 *   - Toolbar and NodePalette search & filter architecture
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Iteration 37 UI/UX Audit & Standardization Tests...\n');

  // ── Group 1: CSS Standardization & Light Theme Tokens ────────────────────────
  console.log('Group 1: CSS Architecture & Theme Tokens');
  const cssPath = path.resolve('frontend/src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  check(cssContent.includes('.modal-content'), 'index.css defines .modal-content style rule');
  check(cssContent.includes('[data-theme="light"]'), 'index.css defines [data-theme="light"] tokens');
  check(cssContent.includes('--bg-surface'), 'index.css provides --bg-surface token');
  check(cssContent.includes('.switch-track'), 'index.css defines .switch-track style rule');
  check(cssContent.includes('.switch-thumb'), 'index.css defines .switch-thumb style rule');
  check(cssContent.includes('.dropdown-menu'), 'index.css defines .dropdown-menu style rule');
  check(cssContent.includes('.dropdown-item'), 'index.css defines .dropdown-item style rule');
  check(cssContent.includes('.unsaved-dot'), 'index.css defines .unsaved-dot style rule');
  check(cssContent.includes('@media (max-width: 768px)'), 'index.css contains tablet/mobile responsive breakpoint (768px)');
  check(cssContent.includes('@media (max-width: 600px)'), 'index.css contains mobile drawer breakpoint (600px)');

  // ── Group 2: ConfirmDialog Component Architecture ─────────────────────────────
  console.log('\nGroup 2: ConfirmDialog Component Architecture');
  const confirmDialogPath = path.resolve('frontend/src/components/ConfirmDialog.jsx');
  const confirmCode = fs.readFileSync(confirmDialogPath, 'utf8');

  check(confirmCode.includes('role="dialog"'), 'ConfirmDialog provides role="dialog" accessibility attribute');
  check(confirmCode.includes('aria-modal="true"'), 'ConfirmDialog declares aria-modal="true"');
  check(confirmCode.includes('aria-labelledby="confirm-dialog-title"'), 'ConfirmDialog links aria-labelledby');
  check(confirmCode.includes("e.key === 'Escape'"), 'ConfirmDialog supports Escape key dismissal');
  check(confirmCode.includes('confirmBtnRef.current?.focus()'), 'ConfirmDialog manages accessible focus on open');
  check(confirmCode.includes('isDanger'), 'ConfirmDialog supports danger variant');
  check(confirmCode.includes('isWarning'), 'ConfirmDialog supports warning variant');

  // ── Group 3: SwitchField Component Architecture ───────────────────────────────
  console.log('\nGroup 3: SwitchField Component Architecture');
  const switchFieldPath = path.resolve('frontend/src/components/forms/SwitchField.jsx');
  const switchCode = fs.readFileSync(switchFieldPath, 'utf8');

  check(switchCode.includes('role="switch"'), 'SwitchField declares role="switch"');
  check(switchCode.includes('aria-checked={isChecked}'), 'SwitchField declares aria-checked state');
  check(switchCode.includes("e.key === ' ' || e.key === 'Enter'"), 'SwitchField supports keyboard space and enter activation');
  check(!switchCode.includes('<select'), 'SwitchField does NOT use native select dropdown');

  // ── Group 4: AgentToolCallViewer Trace & Metrics ─────────────────────────────
  console.log('\nGroup 4: AgentToolCallViewer Trace & Metrics');
  const agentViewerPath = path.resolve('frontend/src/components/execution/AgentToolCallViewer.jsx');
  const agentViewerCode = fs.readFileSync(agentViewerPath, 'utf8');

  check(agentViewerCode.includes('toolCalls.map'), 'AgentToolCallViewer renders toolCalls sequence');
  check(agentViewerCode.includes('tokenUsage'), 'AgentToolCallViewer renders token usage metrics');
  check(agentViewerCode.includes('finalAnswer'), 'AgentToolCallViewer renders final synthesized answer');
  check(agentViewerCode.includes('copyPayload'), 'AgentToolCallViewer provides one-click copy for arguments and results');
  check(agentViewerCode.includes('tc.durationMs'), 'AgentToolCallViewer inspects tool execution duration');

  // ── Group 5: Builder Toolbar & NodePalette Improvements ─────────────────────
  console.log('\nGroup 5: Builder Toolbar & NodePalette Improvements');
  const toolbarPath = path.resolve('frontend/src/components/builder/toolbar/Toolbar.jsx');
  const toolbarCode = fs.readFileSync(toolbarPath, 'utf8');

  check(toolbarCode.includes('showToolsMenu'), 'Toolbar provides Tools dropdown menu for secondary workflow utilities');
  check(toolbarCode.includes('isDirty'), 'Toolbar supports isDirty unsaved changes indicator');
  check(toolbarCode.includes('unsaved-dot'), 'Toolbar renders unsaved-dot indicator when isDirty is true');

  const palettePath = path.resolve('frontend/src/components/builder/palette/NodePalette.jsx');
  const paletteCode = fs.readFileSync(palettePath, 'utf8');

  check(paletteCode.includes('search'), 'NodePalette supports real-time search filtering');
  check(paletteCode.includes('category'), 'NodePalette supports category filtering pills');
  check(paletteCode.includes('isCollapsed'), 'NodePalette supports collapsing on smaller screens');

  // ── Group 6: Native window.confirm Elimination Audit ─────────────────────────
  console.log('\nGroup 6: Elimination of native window.confirm in Key User Flows');
  const dashCode = fs.readFileSync('frontend/src/pages/DashboardPage.jsx', 'utf8');
  const connCode = fs.readFileSync('frontend/src/pages/ConnectionsPage.jsx', 'utf8');
  const varCode = fs.readFileSync('frontend/src/components/VariablesModal.jsx', 'utf8');
  const schedCode = fs.readFileSync('frontend/src/components/ScheduleModal.jsx', 'utf8');

  check(!dashCode.includes('confirm('), 'DashboardPage has zero native window.confirm calls');
  check(!connCode.includes('confirm('), 'ConnectionsPage has zero native window.confirm calls');
  check(!varCode.includes('window.confirm'), 'VariablesModal has zero native window.confirm calls');
  check(!schedCode.includes('window.confirm'), 'ScheduleModal has zero native window.confirm calls');

  check(dashCode.includes('ConfirmDialog'), 'DashboardPage uses ConfirmDialog');
  check(connCode.includes('ConfirmDialog'), 'ConnectionsPage uses ConfirmDialog');
  check(varCode.includes('ConfirmDialog'), 'VariablesModal uses ConfirmDialog');
  check(schedCode.includes('ConfirmDialog'), 'ScheduleModal uses ConfirmDialog');

  // ── Group 7: Responsive Width Verification ──────────────────────────────────
  console.log('\nGroup 7: Responsive Width Verification on Sidebars & Modals');
  const stepSidebarCode = fs.readFileSync('frontend/src/components/StepEditorSidebar.jsx', 'utf8');
  const execPanelCode = fs.readFileSync('frontend/src/components/ExecutionPanel.jsx', 'utf8');
  const varPickerCode = fs.readFileSync('frontend/src/components/VariablePicker.jsx', 'utf8');
  const importModalCode = fs.readFileSync('frontend/src/components/ImportModal.jsx', 'utf8');

  check(
    stepSidebarCode.includes("min(390px, 100vw)") ||
    stepSidebarCode.includes("min(440px, 100%)") ||
    stepSidebarCode.includes("min(440px, 100vw)"),
    'StepEditorSidebar constrains width responsively'
  );
  check(execPanelCode.includes("min(380px, 100vw)"), 'ExecutionPanel constrains width with min(380px, 100vw)');
  check(varPickerCode.includes("min(340px, 92vw)"), 'VariablePicker constrains width with min(340px, 92vw)');
  check(importModalCode.includes("min(480px, 94vw)"), 'ImportModal constrains width with min(480px, 94vw)');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\nUI/UX Audit Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
