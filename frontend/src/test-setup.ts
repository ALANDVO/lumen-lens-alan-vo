import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock EventSource for jsdom test environment
global.EventSource = vi.fn().mockImplementation(function(this: any, url: string) {
  this.url = url
  this.readyState = EventSource.CONNECTING
  this.onmessage = null
  this.onerror = null
  this.close = vi.fn()
  this.addEventListener = vi.fn()
  this.removeEventListener = vi.fn()
  this.dispatchEvent = vi.fn()
  
  // Simulate immediate message event for testing
  setTimeout(() => {
    this.readyState = EventSource.OPEN
    this.dispatchEvent({ type: 'message', data: JSON.stringify({ type: 'test' }) })
  }, 0)
})

// Define EventSource constants
;(EventSource as any).CONNECTING = 0
;(EventSource as any).OPEN = 1
;(EventSource as any).CLOSED = 2
