import { useState, useEffect, useCallback } from 'react'
import { SessionList } from './components/SessionList'
import { CreateSessionModal } from './components/CreateSessionModal'
import { ToastContainer, useToast, ToastProvider } from './components/Toast'
import type { Session, SessionConfig } from './api/types'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

interface HealthStatus {
  status: string
  app: string
  version: string
  environment: string
}

function AppContent() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const toast = useToast()

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE.replace('/api/v1', '')}/health`)
      if (!res.ok) throw new Error('Health check failed')
      setHealth(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to backend')
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`)
      if (res.status === 401) {
        setSessions([])
        return
      }
      if (!res.ok) throw new Error('Failed to fetch sessions')
      setSessions(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch sessions')
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchHealth(), fetchSessions()])
      setLoading(false)
    }
    init()

    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [fetchHealth, fetchSessions])

  const handleCreateSession = async (config: SessionConfig) => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (res.status === 401) {
        toast.error('Authentication required. Please configure OIDC or enable demo mode.')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to create session')
      }
      const session = await res.json()
      toast.success(`Session ${session.id.slice(0, 8)} created`)
      setShowCreateModal(false)
      await fetchSessions()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create session')
    }
  }

  const handleCloseSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to close session')
      toast.success('Session closed')
      await fetchSessions()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to close session')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="loading">
          <span className="spinner" />
          <span>Loading Lumen Lens...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Lumen Lens
          </h1>
          {health && (
            <span className="badge badge-completed">
              {health.status} · v{health.version}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!health}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Session
          </button>
        </div>
      </header>

      <main className="container" style={{ padding: '1.5rem' }}>
        {error && (
          <div className="card" style={{ borderColor: 'var(--color-error)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-error)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                onClick={() => { setError(null); fetchHealth(); fetchSessions(); }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <SessionList
          sessions={sessions}
          onClose={handleCloseSession}
          onRefresh={fetchSessions}
        />

        <CreateSessionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSession}
        />
      </main>

      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />

      <footer style={{
        padding: '1.5rem',
        borderTop: '1px solid var(--color-border)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.875rem',
      }}>
        Lumen Lens — Next-generation e2e testing framework for web and mobile apps
        <br />
        Alan Vo | AI & Machine Learning · alanvo@gmail.com
      </footer>
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App