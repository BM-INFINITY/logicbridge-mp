import React from 'react';
import { UserCheck, Clock } from 'lucide-react';
import { TextField, SelectField, CodeEditor, NumberField } from '../forms';
import SidebarSection from './SidebarSection';
import SidebarAlert from './SidebarAlert';

export default function ApprovalConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%' }}>
      {/* Informational Banner */}
      <SidebarAlert
        variant="info"
        icon={<UserCheck size={18} style={{ color: 'var(--accent-primary)' }} />}
        title="Human Approval Node"
        message="Pauses workflow execution until an authorized reviewer approves or rejects the request via the dashboard."
      />

      {/* Approval Title */}
      <TextField
        label="Approval Request Title"
        required
        value={data.title || ''}
        onChange={(val) => updateField('title', val)}
        onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('title')}
        placeholder="e.g. Approve Invoice #{{variables.invoiceId}}"
      />

      {/* Description */}
      <TextField
        label="Short Description"
        value={data.description || ''}
        onChange={(val) => updateField('description', val)}
        onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('description')}
        placeholder="e.g. Requested by {{variables.requesterEmail}}"
      />

      {/* Message */}
      <CodeEditor
        label="Approval Message / Context"
        value={data.message || ''}
        onChange={(val) => updateField('message', val)}
        onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('message')}
        placeholder="Context, line items, or rationale for this approval request..."
        minLines={3}
      />

      {/* Approver Role or Assignee */}
      <TextField
        label="Approver Email or Role (Optional)"
        value={data.approver || ''}
        onChange={(val) => updateField('approver', val)}
        onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('approver')}
        placeholder="e.g. finance-leads@company.com or {{variables.managerEmail}}"
        helperText="Leave empty to allow any workflow owner or admin to review."
      />

      {/* Timeout Behavior */}
      <SidebarSection
        title="Timeout & Expiration Policy"
        icon={<Clock size={13} />}
        collapsible
        defaultOpen={true}
      >
        <NumberField
          label="Timeout (Hours)"
          min={1}
          max={720}
          value={data.timeoutHours ?? 72}
          onChange={(val) => updateField('timeoutHours', val)}
          helperText="Maximum wait window before automatic expiration (Default: 72h / 3 days)."
        />

        <SelectField
          label="Action on Timeout Expiry"
          value={data.timeoutAction || 'reject'}
          onChange={(val) => updateField('timeoutAction', val)}
          options={[
            { value: 'reject', label: 'Reject / Cancel Workflow' },
            { value: 'approve', label: 'Auto-Approve (Fallback)' },
            { value: 'fail', label: 'Mark Step as Failed' },
          ]}
        />
      </SidebarSection>
    </div>
  );
}
