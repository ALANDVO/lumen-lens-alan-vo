import type { Session, SessionConfig, StepRecord, HealthStatus } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new Error('Authentication required')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE.replace('/api/v1', '')}/health`)
  return handleResponse(res)
}

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions`)
  return handleResponse(res)
}

export async function createSession(config: SessionConfig): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  })
  return handleResponse(res)
}

export async function closeSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  })
  await handleResponse(res)
}

export async function fetchSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`)
  return handleResponse(res)
}

export async function fetchSessionSteps(sessionId: string): Promise<StepRecord[]> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/steps`)
  return handleResponse(res)
}

export function createSessionEventSource(sessionId: string): EventSource {
  const url = `${API_BASE}/sessions/${sessionId}/events`
  return new EventSource(url)
}

export function exportSessionSteps(session: Session, steps: StepRecord[]): void {
  const data = {
    session: {
      id: session.id,
      status: session.status,
      config: session.config,
      created_at: session.created_at,
      updated_at: session.updated_at,
      closed_at: session.closed_at,
      error: session.error,
    },
    steps: steps.map((step) => ({
      id: step.id,
      step_number: step.step_number,
      action: step.action,
      status: step.status,
      started_at: step.started_at,
      completed_at: step.completed_at,
      artifacts: step.artifacts,
      error: step.error,
    })),
    exported_at: new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `session-${session.id.slice(0, 8)}-steps.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
// Test edit
