import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, Key, Database } from 'lucide-react';
import { SelectField, TextField, SwitchField } from '../forms';
import API from '../../api/client';

const OPERATIONS = [
  { value: 'upload',       label: 'Upload File',        hint: 'Upload content or a previous file reference to storage' },
  { value: 'download',     label: 'Download File',      hint: 'Download an object from storage into workflow context' },
  { value: 'list',         label: 'List Files',         hint: 'List objects matching an optional key prefix' },
  { value: 'delete',       label: 'Delete File',        hint: 'Remove an object from storage' },
  { value: 'get_metadata', label: 'Get Metadata',       hint: 'Inspect object size, content type, etag, and timestamps' },
];

const PROVIDERS = [
  { value: 'local',  label: 'Local Persistent Storage' },
  { value: 'aws_s3', label: 'AWS S3 / S3-Compatible' },
];

const DOWNLOAD_FORMATS = [
  { value: 'text',   label: 'Text (UTF-8)' },
  { value: 'json',   label: 'JSON (Parsed object/array)' },
  { value: 'csv',    label: 'CSV (Parsed records)' },
  { value: 'binary', label: 'Binary (Base64)' },
];

export default function StorageConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const provider = data.provider || 'local';
  const operation = data.operation || 'upload';
  const isS3 = provider === 'aws_s3' || provider === 's3';
  const selectedOp = OPERATIONS.find((o) => o.value === operation);

  useEffect(() => {
    if (isS3) {
      setLoadingConns(true);
      API.get('/api/connections')
        .then(({ data: res }) => {
          const list = Array.isArray(res) ? res : (res.data || []);
          const s3Conns = list.filter((c) => c.provider === 'aws_s3' || c.provider === 's3');
          setConnections(s3Conns);
        })
        .catch(() => setConnections([]))
        .finally(() => setLoadingConns(false));
    }
  }, [isS3]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Storage Provider */}
      <SelectField
        label="Storage Provider"
        value={provider}
        onChange={(val) => updateField('provider', val)}
        options={PROVIDERS}
      />

      {/* S3 Connection Binding */}
      {isS3 && (
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={13} style={{ color: 'var(--accent-primary)' }} />
            AWS S3 Connection
          </label>
          <select
            className="form-input"
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
          >
            <option value="">— Select an encrypted S3 Connection —</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.email ? `(${c.email})` : ''}
              </option>
            ))}
          </select>
          {loadingConns && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>Loading connections…</div>}
          {!loadingConns && connections.length === 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-warning)', marginTop: 4 }}>
              No AWS S3 connection found. Create one under the Connections tab or configure manual keys.
            </div>
          )}
        </div>
      )}

      {/* S3 Bucket Name */}
      {isS3 && (
        <TextField
          label="S3 Bucket"
          placeholder="e.g. my-company-data or {{ trigger.body.bucket }}"
          value={data.bucket || ''}
          onChange={(val) => updateField('bucket', val)}
          onInsertVariable={() => onOpenVariablePicker('bucket')}
          helperText="Leave empty to use connection's default bucket."
        />
      )}

      {/* Operation */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATIONS.map((o) => ({ value: o.value, label: o.label }))}
      />

      {/* Operation Hint */}
      {selectedOp && (
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', borderLeft: '2px solid var(--accent-primary)' }}>
          {selectedOp.hint}
        </div>
      )}

      {/* Key / Path (for upload, download, delete, get_metadata) */}
      {operation !== 'list' && (
        <TextField
          label={isS3 ? 'Object Key' : 'File Path / Key'}
          placeholder={isS3 ? 'e.g. exports/report_2026.csv or {{ steps.file_1.filename }}' : 'e.g. data/backup.json'}
          value={data.key || data.path || ''}
          onChange={(val) => {
            updateField('key', val);
            updateField('path', val);
          }}
          onInsertVariable={() => onOpenVariablePicker('key')}
        />
      )}

      {/* Upload Operation Content */}
      {operation === 'upload' && (
        <>
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Content / File Reference</label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onOpenVariablePicker('content')}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                + Variable
              </button>
            </div>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Text content or reference e.g. {{ steps.file_1 }} or {{ steps.csv_1 }}"
              value={data.content || data.file || ''}
              onChange={(e) => updateField('content', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Passes strings, JSON/CSV data, or full file reference objects from preceding steps.
            </div>
          </div>

          <TextField
            label="Content-Type Override (optional)"
            placeholder="e.g. text/csv, application/json (auto-detected from key if blank)"
            value={data.contentType || ''}
            onChange={(val) => updateField('contentType', val)}
          />
        </>
      )}

      {/* Download Operation Format */}
      {operation === 'download' && (
        <SelectField
          label="Parse Output Format"
          value={data.format || 'text'}
          onChange={(val) => updateField('format', val)}
          options={DOWNLOAD_FORMATS}
        />
      )}

      {/* List Operation Prefix & Limit */}
      {operation === 'list' && (
        <>
          <TextField
            label="Key Prefix (optional)"
            placeholder="e.g. reports/ or daily_backups/"
            value={data.prefix || ''}
            onChange={(val) => updateField('prefix', val)}
            onInsertVariable={() => onOpenVariablePicker('prefix')}
          />
          <TextField
            label="Max Results Limit"
            placeholder="100"
            value={data.limit || '100'}
            onChange={(val) => updateField('limit', val)}
          />
        </>
      )}

      {/* Security & Credentials Notice */}
      <div style={{
        marginTop: 6,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255, 153, 0, 0.06)',
        border: '1px solid rgba(255, 153, 0, 0.2)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}>
        <Cloud size={15} style={{ color: '#ff9900', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          <strong>Encrypted & Redacted Storage:</strong> AWS Access Keys and SigV4 signatures are encrypted at rest with AES-256-GCM and redacted from all logs, error messages, and execution replays.
        </div>
      </div>
    </div>
  );
}

