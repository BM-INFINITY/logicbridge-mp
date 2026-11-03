import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import design tokens
import { tokens } from '../tokens/designTokens.js';

describe('Iteration 38 — Design System & Reusable Component Standardization', () => {
  describe('Group 1: Design Tokens Architecture', () => {
    it('defines consolidated color tokens for all surface elevations', () => {
      assert.ok(tokens.colors.bg.base, 'bg.base defined');
      assert.ok(tokens.colors.bg.surface, 'bg.surface defined');
      assert.ok(tokens.colors.bg.elevated, 'bg.elevated defined');
      assert.ok(tokens.colors.bg.card, 'bg.card defined');
      assert.ok(tokens.colors.bg.overlay, 'bg.overlay defined');
    });

    it('defines text hierarchy tokens with accessible contrast roles', () => {
      assert.ok(tokens.colors.text.primary, 'text.primary defined');
      assert.ok(tokens.colors.text.secondary, 'text.secondary defined');
      assert.ok(tokens.colors.text.muted, 'text.muted defined');
      assert.ok(tokens.colors.text.disabled, 'text.disabled defined');
      assert.ok(tokens.colors.text.accent, 'text.accent defined');
      assert.ok(tokens.colors.text.inverse, 'text.inverse defined');
    });

    it('defines semantic state tokens for success, warning, danger, and info', () => {
      const states = ['success', 'warning', 'danger', 'info'];
      for (const state of states) {
        const item = tokens.colors.status[state];
        assert.ok(item, `status.${state} exists`);
        assert.ok(item.color, `${state}.color defined`);
        assert.ok(item.bg, `${state}.bg defined`);
        assert.ok(item.border, `${state}.border defined`);
        assert.ok(item.text, `${state}.text defined`);
      }
    });

    it('defines standardized spacing scale', () => {
      const expectedKeys = ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
      for (const key of expectedKeys) {
        assert.ok(tokens.spacing[key], `spacing.${key} exists`);
      }
    });

    it('defines standardized typography scale', () => {
      const expectedSizes = ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'];
      for (const size of expectedSizes) {
        assert.ok(tokens.typography.sizes[size], `typography.sizes.${size} exists`);
      }
    });

    it('defines standardized border radii, shadows, and focus indicator', () => {
      assert.ok(tokens.radii.xs, 'radii.xs exists');
      assert.ok(tokens.radii.sm, 'radii.sm exists');
      assert.ok(tokens.radii.md, 'radii.md exists');
      assert.ok(tokens.radii.lg, 'radii.lg exists');
      assert.ok(tokens.radii.full, 'radii.full exists');

      assert.ok(tokens.shadows.sm, 'shadows.sm exists');
      assert.ok(tokens.shadows.md, 'shadows.md exists');
      assert.ok(tokens.shadows.lg, 'shadows.lg exists');
      assert.ok(tokens.shadows.glow, 'shadows.glow exists');

      assert.ok(tokens.focus.ring, 'focus.ring exists');
      assert.ok(tokens.transitions.fast, 'transitions.fast exists');
    });
  });

  describe('Group 2: CSS Custom Properties & Dark/Light Theme Integrity', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    it('defines core tokens in :root in index.css', () => {
      assert.ok(cssContent.includes('--bg-base:'), ':root defines --bg-base');
      assert.ok(cssContent.includes('--bg-surface:'), ':root defines --bg-surface');
      assert.ok(cssContent.includes('--bg-elevated:'), ':root defines --bg-elevated');
      assert.ok(cssContent.includes('--bg-card:'), ':root defines --bg-card');
      assert.ok(cssContent.includes('--accent-primary:'), ':root defines --accent-primary');
      assert.ok(cssContent.includes('--color-success:'), ':root defines --color-success');
      assert.ok(cssContent.includes('--color-warning:'), ':root defines --color-warning');
      assert.ok(cssContent.includes('--color-danger:'), ':root defines --color-danger');
      assert.ok(cssContent.includes('--color-info:'), ':root defines --color-info');
      assert.ok(cssContent.includes('--space-sm:'), ':root defines --space-sm');
      assert.ok(cssContent.includes('--font-md:'), ':root defines --font-md');
      assert.ok(cssContent.includes('--focus-ring:'), ':root defines --focus-ring');
    });

    it('provides light theme overrides for surfaces and semantic colors', () => {
      const lightThemeIdx = cssContent.indexOf('[data-theme="light"]');
      assert.ok(lightThemeIdx !== -1, '[data-theme="light"] block exists');

      const lightBlock = cssContent.slice(lightThemeIdx, lightThemeIdx + 1200);
      assert.ok(lightBlock.includes('--bg-base: #f8fafc;'), 'light mode defines --bg-base');
      assert.ok(lightBlock.includes('--bg-surface: #ffffff;'), 'light mode defines --bg-surface');
      assert.ok(lightBlock.includes('--text-primary: #0f172a;'), 'light mode defines --text-primary');
      assert.ok(lightBlock.includes('--color-success:'), 'light mode overrides --color-success');
      assert.ok(lightBlock.includes('--color-warning:'), 'light mode overrides --color-warning');
      assert.ok(lightBlock.includes('--color-danger:'), 'light mode overrides --color-danger');
      assert.ok(lightBlock.includes('--color-info:'), 'light mode overrides --color-info');
    });

    it('defines standardized CSS utility classes for alerts, button sizes, and badge variants', () => {
      assert.ok(cssContent.includes('.alert {'), '.alert class defined');
      assert.ok(cssContent.includes('.alert-success {'), '.alert-success class defined');
      assert.ok(cssContent.includes('.alert-warning {'), '.alert-warning class defined');
      assert.ok(cssContent.includes('.alert-danger'), '.alert-danger class defined');
      assert.ok(cssContent.includes('.alert-info {'), '.alert-info class defined');
      assert.ok(cssContent.includes('.btn-xs {'), '.btn-xs class defined');
      assert.ok(cssContent.includes('.btn-icon {'), '.btn-icon class defined');
      assert.ok(cssContent.includes('.badge-outline {'), '.badge-outline class defined');
      assert.ok(cssContent.includes('.badge-dot {'), '.badge-dot class defined');
    });
  });

  describe('Group 3: Reusable UI Component Standardization & Exports', () => {
    const uiIndexPath = path.resolve(__dirname, '../components/ui/index.js');
    const uiIndexContent = fs.readFileSync(uiIndexPath, 'utf8');

    it('exports all 17 standardized reusable UI components from ui/index.js', () => {
      const components = [
        'Button',
        'IconButton',
        'Badge',
        'StatusIndicator',
        'Card',
        'Panel',
        'Modal',
        'ConfirmDialog',
        'Tabs',
        'SkeletonLoader',
        'EmptyState',
        'Alert',
        'Tooltip',
        'Popover',
        'Checkbox',
        'FieldGroup',
        'FormSection',
        'Dropdown',
      ];

      for (const comp of components) {
        assert.ok(
          uiIndexContent.includes(comp),
          `ui/index.js exports ${comp}`
        );
      }
    });

    it('re-exports form inputs for seamless backward compatibility', () => {
      const formInputs = [
        'TextField',
        'NumberField',
        'SelectField',
        'SwitchField',
        'KeyValueTable',
        'CodeEditor',
      ];

      for (const input of formInputs) {
        assert.ok(
          uiIndexContent.includes(input),
          `ui/index.js re-exports ${input}`
        );
      }
    });

    it('verifies component source files exist on disk', () => {
      const expectedFiles = [
        'Button.jsx',
        'IconButton.jsx',
        'Badge.jsx',
        'StatusIndicator.jsx',
        'Card.jsx',
        'Panel.jsx',
        'Modal.jsx',
        'ConfirmDialog.jsx',
        'Tabs.jsx',
        'SkeletonLoader.jsx',
        'EmptyState.jsx',
        'Alert.jsx',
        'Tooltip.jsx',
        'Popover.jsx',
        'Checkbox.jsx',
        'FieldGroup.jsx',
        'FormSection.jsx',
        'Dropdown.jsx',
      ];

      for (const file of expectedFiles) {
        const filePath = path.resolve(__dirname, `../components/ui/${file}`);
        assert.ok(fs.existsSync(filePath), `Component file exists: ${file}`);
      }
    });
  });

  describe('Group 4: Node Configuration Design System', () => {
    const sidebarIndexPath = path.resolve(__dirname, '../components/sidebar/index.js');
    const sidebarIndexContent = fs.readFileSync(sidebarIndexPath, 'utf8');

    it('exports SidebarSection, SidebarFieldGroup, and SidebarAlert from sidebar/index.js', () => {
      assert.ok(sidebarIndexContent.includes('SidebarSection'), 'SidebarSection exported');
      assert.ok(sidebarIndexContent.includes('SidebarFieldGroup'), 'SidebarFieldGroup exported');
      assert.ok(sidebarIndexContent.includes('SidebarAlert'), 'SidebarAlert exported');
      assert.ok(sidebarIndexContent.includes('SidebarHeader'), 'SidebarHeader exported');
      assert.ok(sidebarIndexContent.includes('SidebarTabs'), 'SidebarTabs exported');
    });

    it('eliminates low-contrast hardcoded white rgba in sidebar hint callouts', () => {
      const sidebarsDir = path.resolve(__dirname, '../components/sidebar');
      const files = fs.readdirSync(sidebarsDir).filter((f) => f.endsWith('.jsx'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(sidebarsDir, file), 'utf8');
        assert.ok(
          !content.includes("'rgba(255,255,255,0.03)'") &&
          !content.includes("'rgba(255, 255, 255, 0.03)'") &&
          !content.includes("'rgba(255,255,255,0.04)'") &&
          !content.includes("'rgba(255, 255, 255, 0.04)'"),
          `No low-contrast white rgba in ${file}`
        );
      }
    });

    it('AgentConfig adopts design system SidebarSection and Badge', () => {
      const agentConfigPath = path.resolve(__dirname, '../components/sidebar/AgentConfig.jsx');
      const content = fs.readFileSync(agentConfigPath, 'utf8');

      assert.ok(content.includes('SidebarSection'), 'AgentConfig imports SidebarSection');
      assert.ok(content.includes('Badge'), 'AgentConfig imports Badge');
      assert.ok(content.includes('title="Structured Response Schema"'), 'Structured Schema uses SidebarSection');
      assert.ok(content.includes('title="Execution Limits & Parameters"'), 'Execution Limits uses SidebarSection');
    });

    it('HttpConfig adopts design system segmented Tabs component', () => {
      const httpConfigPath = path.resolve(__dirname, '../components/sidebar/HttpConfig.jsx');
      const content = fs.readFileSync(httpConfigPath, 'utf8');

      assert.ok(content.includes('Tabs'), 'HttpConfig imports Tabs');
      assert.ok(content.includes('variant="segmented"'), 'HttpConfig uses segmented Tabs');
    });

    it('ApprovalConfig adopts design system SidebarAlert and SidebarSection', () => {
      const approvalConfigPath = path.resolve(__dirname, '../components/sidebar/ApprovalConfig.jsx');
      const content = fs.readFileSync(approvalConfigPath, 'utf8');

      assert.ok(content.includes('SidebarAlert'), 'ApprovalConfig imports SidebarAlert');
      assert.ok(content.includes('SidebarSection'), 'ApprovalConfig imports SidebarSection');
      assert.ok(content.includes('title="Timeout & Expiration Policy"'), 'ApprovalConfig uses SidebarSection for timeout');
    });
  });

  describe('Group 5: Accessibility & WAI-ARIA Conformance', () => {
    it('Modal conforms to WAI-ARIA dialog specification', () => {
      const modalContent = fs.readFileSync(path.resolve(__dirname, '../components/ui/Modal.jsx'), 'utf8');
      assert.ok(modalContent.includes('role="dialog"'), 'Modal defines role="dialog"');
      assert.ok(modalContent.includes('aria-modal="true"'), 'Modal defines aria-modal="true"');
      assert.ok(modalContent.includes('Escape'), 'Modal listens for Escape key dismissal');
    });

    it('Tabs conform to WAI-ARIA tablist and tab roles', () => {
      const tabsContent = fs.readFileSync(path.resolve(__dirname, '../components/ui/Tabs.jsx'), 'utf8');
      assert.ok(tabsContent.includes('role="tablist"'), 'Tabs define role="tablist"');
      assert.ok(tabsContent.includes('role="tab"'), 'Tab items define role="tab"');
      assert.ok(tabsContent.includes('aria-selected='), 'Tab items define aria-selected');
      assert.ok(tabsContent.includes('ArrowRight') && tabsContent.includes('ArrowLeft'), 'Tabs support arrow key navigation');
    });

    it('Checkbox conforms to WAI-ARIA checkbox specification', () => {
      const checkboxContent = fs.readFileSync(path.resolve(__dirname, '../components/ui/Checkbox.jsx'), 'utf8');
      assert.ok(checkboxContent.includes('role="checkbox"'), 'Checkbox defines role="checkbox"');
      assert.ok(checkboxContent.includes('aria-checked='), 'Checkbox defines aria-checked');
      assert.ok(checkboxContent.includes('tabIndex='), 'Checkbox supports tabIndex keyboard focus');
    });

    it('Alert conforms to WAI-ARIA status and alert roles', () => {
      const alertContent = fs.readFileSync(path.resolve(__dirname, '../components/ui/Alert.jsx'), 'utf8');
      assert.ok(alertContent.includes("role={normalizedVariant === 'error' ? 'alert' : 'status'}"), 'Alert dynamically sets alert or status role');
    });
  });
});

