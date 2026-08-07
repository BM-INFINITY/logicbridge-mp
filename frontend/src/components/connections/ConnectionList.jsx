import React from 'react';
import { Link2Off } from 'lucide-react';
import ConnectionCard from './ConnectionCard';

/**
 * ConnectionList — renders the grid of ConnectionCards or an empty state.
 */
export default function ConnectionList({ connections, onVerify, onDelete, verifyingId }) {
  if (connections.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', gap: 16, color: 'var(--text-muted)', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Link2Off size={28} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 6 }}>
            No connections yet
          </div>
          <div style={{ fontSize: '0.85rem', maxWidth: 280 }}>
            Add your first connection to start sending emails and connecting services.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 16,
    }}>
      {connections.map((conn) => (
        <ConnectionCard
          key={conn._id}
          connection={conn}
          onVerify={onVerify}
          onDelete={onDelete}
          verifying={verifyingId === conn._id}
        />
      ))}
    </div>
  );
}
