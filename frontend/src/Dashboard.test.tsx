import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from './pages/Dashboard'

// Mock fetch globally
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    // Mock health endpoint (API_BASE.replace('/api/v1', '') + '/health')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'healthy',
        app: 'lumen-lens',
        version: '1.0.0',
        environment: 'test',
      }),
    })
    // Mock sessions endpoint (/api/v1/sessions) - return sessions with mix of statuses
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { id: 'session-1', status: 'running', config: { cwd: '/tmp', target: 'web' } as any, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'session-2', status: 'initializing', config: { cwd: '/home', target: 'android' } as any, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'session-3', status: 'completed', config: { cwd: '/var', target: 'ios' } as any, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]),
    })
  })

  it('renders dashboard with sessions and active count', async () => {
    render(<DashboardPage />)

    // Wait for loading to finish (health and sessions requests)
    await waitFor(() => {
      // Check for Lumen Lens heading (header)
      expect(screen.getByText(/Lumen Lens/)).toBeInTheDocument()
    })

    // Should show active sessions badge with count (2 active: running + initializing)
    const activeBadge = screen.getByText(/2 active/)
    expect(activeBadge).toBeInTheDocument()
    
    // Should NOT show "No sessions yet" since we have sessions
    // The text may be broken up, so check that the sessions table is present instead
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('displays active sessions count badge correctly', async () => {
    render(<DashboardPage />)

    // Wait for loading to finish (health and sessions requests)
    await waitFor(() => {
      expect(screen.getByText(/Lumen Lens/)).toBeInTheDocument()
    })

    // Should show active sessions badge with count
    expect(screen.getByText(/2 active/)).toBeInTheDocument()
  })
})
