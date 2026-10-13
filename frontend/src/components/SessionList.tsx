import { useState } from 'react'
import { Session } from '../api/types'

interface SessionListProps {
  sessions: Session[]
  onClose: (sessionId: string) => void
  onRefresh: () => void
}

const STATUS_BADGE: Record<Session['status'], string> = {
  initializing: 'badge-initializing',
  running: 'badge-running',
  completed: 'badge-completed',
  failed: 'badge-failed',
  closed: 'badge-closed',
}

const formatDate = (iso: string) => {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SessionList({ sessions, onClose, onRefresh }: SessionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (sessions.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6v6H9z" />
            </svg>
          </div>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text)' }}>No sessions yet</h3>
          <p style={{ marginBottom: '1.5rem' }}>Create your first e2e session to get started</p>
          <button className="btn btn-primary" onClick={onRefresh}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Sessions ({sessions.length})</h2>
        <button className="btn btn-secondary" onClick={onRefresh} style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Status</th>
              <th>ID</th>
              <th>Target</th>
              <th>Working Dir</th>
              <th style={{ width: '180px' }}>Created</th>
              <th style={{ width: '180px' }}>Updated</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <>
                <tr key={session.id}>
                  <td>
                    <span className={`badge ${STATUS_BADGE[session.status]}`}>
                      {session.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                    {session.id.slice(0, 12)}…
                  </td>
                  <td>
                    <code style={{ background: 'var(--color-code-bg)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                      {session.config.target}
                    </code>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {session.config.cwd}
                  </td>
                  <td>{formatDate(session.created_at)}</td>
                  <td>{formatDate(session.updated_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.375rem', fontSize: '0.875rem' }}
                        onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                        aria-expanded={expandedId === session.id}
                        aria-controls={`session-details-${session.id}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {expandedId === session.id ? (
                            <path d="M18 15l-6-6-6 6" />
                          ) : (
                            <path d="M6 9l6 6 6-6" />
                          )}
                        </svg>
                      </button>
                      {session.status === 'running' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}
                          onClick={() => onClose(session.id)}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                <tr id={`session-details-${session.id}`} style={{ display: expandedId === session.id ? '' : 'none' }}>
                  <td colSpan={7} style={{ padding: '0 1rem 1rem' }}>
                    <SessionDetail session={session} />
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SessionDetail({ session }: { session: Session }) {
  return (
    <div style={{
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: '1rem',
      marginTop: '0.5rem',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Session ID</label>
          <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{session.id}</code>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Config Path</label>
          <code style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {session.config.config_path || '—'}
          </code>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Webhook</label>
          <code style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {session.config.on_step_webhook || '—'}
          </code>
        </div>
        {session.error && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Error</label>
            <code style={{ fontSize: '0.8125rem', color: 'var(--color-error)' }}>{session.error}</code>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Session Config</h4>
        <pre style={{
          background: 'var(--color-code-bg)',
          padding: '0.75rem',
          borderRadius: 'var(--radius)',
          overflow: 'auto',
          fontSize: '0.75rem',
          lineHeight: 1.5,
        }}>
          {JSON.stringify(session.config, null, 2)}
        </pre>
      </div>
    </div>
  )
}