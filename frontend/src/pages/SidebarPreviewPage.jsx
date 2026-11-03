import React, { useState, useEffect } from 'react';
import StepEditorSidebar from '../components/StepEditorSidebar';
import { DefaultNodeData } from '../constants/DefaultNodeData';
import { NodeTypes } from '../constants/NodeTypes';
import {
  Button,
  IconButton,
  Badge,
  StatusIndicator,
  Card,
  Panel,
  Modal,
  Tabs,
  SkeletonLoader,
  EmptyState,
  Alert,
  Tooltip,
  Popover,
  Checkbox,
  FieldGroup,
  FormSection,
} from '../components/ui';
import {
  Sparkles,
  Play,
  Trash2,
  Settings,
  Info,
  FolderOpen,
} from 'lucide-react';

const PREVIEW_NODES = [
  { type: NodeTypes.ACTION_AI_AGENT, label: 'AI Agent' },
  { type: NodeTypes.ACTION_HTTP, label: 'HTTP Request' },
  { type: NodeTypes.ACTION_POSTGRES, label: 'PostgreSQL Database' },
  { type: NodeTypes.TRIGGER_WEBHOOK, label: 'Webhook Trigger' },
  { type: NodeTypes.ACTION_LOOP, label: 'Loop Controller' },
  { type: NodeTypes.ACTION_APPROVAL, label: 'Human Approval' },
  { type: NodeTypes.ACTION_TRANSFORM, label: 'Transform Data' },
  { type: NodeTypes.ACTION_CONDITION, label: 'Condition' },
  { type: NodeTypes.ACTION_AI_GENERATE, label: 'AI Generate' },
  { type: NodeTypes.ACTION_SLACK, label: 'Slack Message' },
];

export default function SidebarPreviewPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialType = searchParams.get('node') || NodeTypes.ACTION_AI_AGENT;
  const initialWidth = parseInt(searchParams.get('width'), 10) || 440;
  const initialTheme = searchParams.get('theme') || 'dark';
  const initialTab = searchParams.get('view') || 'sidebar'; // 'sidebar' | 'design-system'

  const [activeView, setActiveView] = useState(initialTab);
  const [selectedType, setSelectedType] = useState(initialType);
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  const [theme, setTheme] = useState(initialTheme);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoCheckbox, setDemoCheckbox] = useState(true);
  const [demoTab, setDemoTab] = useState('tab1');
  const [nodeData, setNodeData] = useState(() => ({
    ...(DefaultNodeData[initialType] || {}),
    label: PREVIEW_NODES.find((p) => p.type === initialType)?.label || initialType,
  }));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleSelectType = (type) => {
    setSelectedType(type);
    setNodeData({
      ...(DefaultNodeData[type] || {}),
      label: PREVIEW_NODES.find((p) => p.type === type)?.label || type,
    });
  };

  const mockNode = {
    id: 'preview_node_1',
    type: selectedType,
    data: nodeData,
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Testbed Navigation & Showcase Area */}
      <div
        id="preview-nav"
        style={{
          flex: 1,
          padding: 24,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          borderRight: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
              LogicBridge Design System Testbed
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Interactive testbed for design tokens, reusable UI components, and node sidebars.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              id="view-sidebar-btn"
              onClick={() => setActiveView('sidebar')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '0.8rem',
                fontWeight: activeView === 'sidebar' ? 600 : 400,
                border: activeView === 'sidebar' ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: activeView === 'sidebar' ? 'rgba(108, 99, 255, 0.2)' : 'var(--bg-elevated)',
                color: activeView === 'sidebar' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Node Sidebars
            </button>
            <button
              id="view-components-btn"
              onClick={() => setActiveView('design-system')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '0.8rem',
                fontWeight: activeView === 'design-system' ? 600 : 400,
                border: activeView === 'design-system' ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: activeView === 'design-system' ? 'rgba(108, 99, 255, 0.2)' : 'var(--bg-elevated)',
                color: activeView === 'design-system' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Component Gallery
            </button>
            <button
              id="toggle-theme-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>

        {activeView === 'sidebar' ? (
          <>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Select Node Type ({PREVIEW_NODES.length}):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PREVIEW_NODES.map((n) => (
                  <button
                    key={n.type}
                    id={`select-node-${n.type}`}
                    onClick={() => handleSelectType(n.type)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      fontSize: '0.78rem',
                      fontWeight: selectedType === n.type ? 600 : 400,
                      border: selectedType === n.type ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: selectedType === n.type ? 'rgba(108, 99, 255, 0.2)' : 'var(--bg-elevated)',
                      color: selectedType === n.type ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Target Sidebar Width:
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[360, 390, 420, 460, 520].map((w) => (
                  <button
                    key={w}
                    id={`width-btn-${w}`}
                    onClick={() => setContainerWidth(w)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      fontSize: '0.78rem',
                      fontWeight: containerWidth === w ? 600 : 400,
                      border: containerWidth === w ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: containerWidth === w ? 'rgba(108, 99, 255, 0.2)' : 'var(--bg-elevated)',
                      color: containerWidth === w ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Active Width: <strong>{containerWidth}px</strong> | Node: <code>{selectedType}</code> | Theme: <code>{theme}</code>
            </div>
          </>
        ) : (
          /* Design System Component Gallery */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Buttons */}
            <Card title="Button & IconButton" subtitle="Variants: primary, secondary, ghost, danger, outline; sizes: xs, sm, md, lg">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <Button variant="primary" icon={<Sparkles size={14} />}>Primary</Button>
                <Button variant="secondary" icon={<Settings size={14} />}>Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger" icon={<Trash2 size={14} />}>Danger</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="secondary" disabled>Disabled</Button>
                <IconButton icon={<Play size={15} />} variant="primary" title="Run Step" />
                <IconButton icon={<Settings size={15} />} variant="secondary" title="Configure" />
                <IconButton icon={<Trash2 size={15} />} variant="danger" title="Delete" />
              </div>
            </Card>

            {/* Badges & Status Indicators */}
            <Card title="Badge & StatusIndicator" subtitle="Semantic states: primary, success, warning, danger, info, muted">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <Badge variant="primary">Primary</Badge>
                <Badge variant="success" dot>Success</Badge>
                <Badge variant="warning" dot>Warning</Badge>
                <Badge variant="danger" dot>Danger</Badge>
                <Badge variant="info" dot>Info</Badge>
                <Badge variant="muted">Muted</Badge>
                <Badge variant="outline">Outline</Badge>
                <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                <StatusIndicator status="active" />
                <StatusIndicator status="running" pulse />
                <StatusIndicator status="failed" />
                <StatusIndicator status="waiting" pulse />
                <StatusIndicator status="draft" />
              </div>
            </Card>

            {/* Alerts */}
            <Card title="Alert & Feedback Banners" subtitle="Accessible alert banners with consistent contrast in dark and light mode">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Alert variant="info" title="Information Note" message="LogicBridge auto-detects input parameter types and runs type validation." />
                <Alert variant="success" title="Success" message="Workflow execution completed in 242ms with 0 errors." dismissible />
                <Alert variant="warning" title="Warning" message="OpenAI API key expires in 5 days." />
                <Alert variant="danger" title="Error" message="PostgreSQL connection timed out on port 5432." />
              </div>
            </Card>

            {/* Tabs & Controls */}
            <Card title="Tabs, Popover, Tooltip & Checkbox">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Tabs
                  tabs={[
                    { id: 'tab1', label: 'Underline Tabs', badge: 3 },
                    { id: 'tab2', label: 'Inputs & Forms' },
                    { id: 'tab3', label: 'Settings' },
                  ]}
                  activeTab={demoTab}
                  onChange={setDemoTab}
                />

                <Tabs
                  tabs={[
                    { id: 'req', label: 'Request' },
                    { id: 'auth', label: 'Auth' },
                    { id: 'body', label: 'Body' },
                  ]}
                  activeTab="req"
                  onChange={() => {}}
                  variant="segmented"
                  size="sm"
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Checkbox
                    checked={demoCheckbox}
                    onChange={setDemoCheckbox}
                    label="Enable automatic workflow retry"
                    helperText="Retries failed steps up to 3 times with exponential backoff."
                  />

                  <Tooltip content="Tooltip helper text on hover or focus" position="top">
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Info size={14} /> Hover for Tooltip
                    </span>
                  </Tooltip>

                  <Popover
                    trigger={<Button size="sm" variant="secondary">Open Popover</Button>}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      <strong>Popover Content</strong>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
                        Accessible popover dismissible via Escape or clicking outside.
                      </p>
                    </div>
                  </Popover>

                  <Button size="sm" variant="secondary" onClick={() => setDemoModalOpen(true)}>
                    Preview Modal
                  </Button>
                </div>
              </div>
            </Card>

            {/* Panels & Form Groups */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Panel
                title="Sidebar Panel Container"
                icon={<Settings size={14} />}
                action={<Badge size="sm" variant="success">Online</Badge>}
              >
                <FieldGroup
                  label="Field Group Label"
                  required
                  helperText="Standardized helper text below input."
                  action={<span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>+ Variable</span>}
                >
                  <input
                    type="text"
                    className="form-input"
                    defaultValue="Sample input inside standardized FieldGroup"
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                  />
                </FieldGroup>
              </Panel>

              <Panel title="Form Section Container" icon={<Info size={14} />}>
                <FormSection
                  title="Collapsible Form Section"
                  collapsible
                  defaultOpen={true}
                  badge={<Badge size="sm" variant="info">New</Badge>}
                >
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Standardized collapsible form section maintaining consistent padding and border radius.
                  </p>
                </FormSection>
              </Panel>
            </div>

            {/* Skeleton & Empty State */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Skeleton Loader">
                <SkeletonLoader variant="title" />
                <SkeletonLoader variant="text" count={3} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <SkeletonLoader variant="circle" />
                  <div style={{ flex: 1 }}><SkeletonLoader variant="text" count={2} /></div>
                </div>
              </Card>

              <Card title="Empty State">
                <EmptyState
                  compact
                  icon={<FolderOpen size={24} />}
                  title="No executions recorded"
                  description="Run this workflow or trigger a test execution to inspect runtime state."
                  action={<Button size="sm" variant="primary">Run Workflow</Button>}
                />
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Test Frame */}
      {activeView === 'sidebar' && (
        <div
          id="sidebar-test-container"
          style={{
            width: containerWidth,
            maxWidth: '100vw',
            height: '100%',
            position: 'relative',
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <StepEditorSidebar
            node={mockNode}
            nodes={[mockNode]}
            edges={[]}
            onUpdate={(_id, updatedData) => setNodeData(updatedData)}
            onDelete={() => {}}
            onClose={() => {}}
            workflowId="test_wf_1"
          />
        </div>
      )}

      {/* Demo Modal */}
      <Modal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title="Standard Modal Dialog"
        subtitle="Accessible dialog with keyboard trap and focus restoration"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDemoModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setDemoModalOpen(false)}>Confirm Action</Button>
          </>
        }
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          This modal dialog follows WAI-ARIA dialog practices with role="dialog", aria-modal="true",
          Escape key listener, backdrop blur, and theme-token styling.
        </p>
      </Modal>
    </div>
  );
}
