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
    // Mock sessions endpoint (/api/v1/sessions)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })
  })

  it('renders dashboard and shows session list', async () => {
    render(<DashboardPage />)

    // Wait for loading to finish (health and sessions requests)
    await waitFor(() => {
      // Check for Lumen Lens heading (header)
      expect(screen.getByText(/Lumen Lens/)).toBeInTheDocument()
    })

    // After loading, there should be a "Sessions (0)" heading
    expect(screen.getByRole('heading', { name: /Sessions/ })).toBeInTheDocument()
  })
})
