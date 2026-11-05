import { useState, useEffect, useCallback, useRef } from 'react'
import { Session, StepRecord } from '../api/types'
import { fetchSessionSteps, createSessionEventSource, exportSessionSteps } from '../api/client'
import { useToast } from './Toast'

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


const STEP_STATUS_BADGE: Record<StepRecord['status'], string> = {
  pending: 'badge-initializing',
  running: 'badge-running',
  completed: 'badge-completed',
  failed: 'badge-failed',
}

const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function StepArtifactsModal({
  step,
  onClose,
}: {
  step: StepRecord | null
  onClose: () => void
}) {
  if (!step) return null

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="artifacts-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <h3 id="artifacts-title" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            Artifacts: Step {step.step_number} - {step.action}
          </h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.25rem 0.5rem' }}>
            Close
          </button>
        </div>
        <div style={{ padding: '1.5rem', overflow: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
          <pre style={{ fontSize: '0.75rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)' }}>
            {JSON.stringify(step.artifacts, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export function SessionDetail({ session }: { session: Session }) {
  const [steps, setSteps] = useState<StepRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sseConnected, setSseConnected] = useState(false)
  const [selectedArtifacts, setSelectedArtifacts] = useState<StepRecord | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const toast = useToast()

  const loadSteps = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchSessionSteps(session.id)
      setSteps(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load steps')
    } finally {
      setLoading(false)
    }
  }, [session.id])

  useEffect(() => {
    loadSteps()

    const es = createSessionEventSource(session.id)
    eventSourceRef.current = es

    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)

    es.addEventListener('step', (event) => {
      try {
        const step = JSON.parse(event.data) as StepRecord
        setSteps((prev) => {
          const idx = prev.findIndex((s) => s.id === step.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = step
            return updated
          }
          return [...prev, step].sort((a, b) => a.step_number - b.step_number)
        })
      } catch {
      }
    })

    es.addEventListener('session', (event) => {
    })

    return () => {
      es.close()
      setSseConnected(false)
    }
  }, [session.id, loadSteps])

  const handleExport = () => {
    try {
      exportSessionSteps(session, steps)
      toast.success('Session steps exported')
    } catch (e) {
      toast.error('Failed to export session')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div className="loading" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="spinner" />
          <span>Loading steps...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: 'var(--color-error)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.375rem 0.75rem' }} onClick={loadSteps}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Steps ({steps.length})</h3>
          <span className={`badge ${sseConnected ? 'badge-completed' : 'badge-closed'}`} style={{ fontSize: '0.6875rem' }}>
            {sseConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={loadSteps}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={handleExport} disabled={steps.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
            </svg>
          </div>
          <p style={{ color: 'var(--color-text-muted)' }}>No steps recorded yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {steps.map((step) => (
            <div
              key={step.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                background: 'var(--color-surface)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--color-surface-hover)' }}>
                <span
                  className={`badge ${STEP_STATUS_BADGE[step.status]}`}
                  style={{
                    minWidth: '80px',
                    textAlign: 'center',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {step.status}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', flex: 1 }}>
                  #{step.step_number} {step.action}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {formatDateTime(step.started_at)}
                </span>
                {step.completed_at && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    \u2192 {formatDateTime(step.completed_at)}
                  </span>
                )}
                {Object.keys(step.artifacts).length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => setSelectedArtifacts(step)}
                  >
                    View Artifacts
                  </button>
                )}
              </div>
              {step.error && (
                <div style={{ padding: '0.5rem 1rem 1rem', background: 'rgba(239, 68, 68, 0.08)', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-error)', marginBottom: '0.25rem' }}>
                    Error
                  </div>
                  <pre style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-error)' }}>
                    {step.error}
                  </pre>
                </div>
              )}
              {Object.keys(step.artifacts).length > 0 && !step.error && (
                <div style={{ padding: '0.75rem 1rem 1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <span style={{ fontWeight: 500 }}>Artifacts:</span>{' '}
                  {Object.keys(step.artifacts).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <StepArtifactsModal
        step={selectedArtifacts}
        onClose={() => setSelectedArtifacts(null)}
      />
    </div>
  )
}