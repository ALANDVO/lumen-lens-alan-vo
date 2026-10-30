import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

// Mock fetch globally
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<App />)

    expect(screen.getByText('Loading Lumen Lens...')).toBeInTheDocument()
  })

  it('displays health status when fetch succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', app: 'lumen-lens', version: '1.0.0', environment: 'development' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('healthy'))).toBeInTheDocument()
    })
  })

  it('shows error when health check fails', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })

  it('shows empty state when no sessions', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', app: 'lumen-lens', version: '1.0.0', environment: 'development' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('No sessions yet')).toBeInTheDocument()
    })
  })

  it('opens create session modal when button clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', app: 'lumen-lens', version: '1.0.0', environment: 'development' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('New Session')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Session'))

    expect(screen.getByText('Create New Session')).toBeInTheDocument()
  })

  it('closes modal on cancel', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', app: 'lumen-lens', version: '1.0.0', environment: 'development' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    render(<App />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Session'))
    })

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Create New Session')).not.toBeInTheDocument()
  })
})