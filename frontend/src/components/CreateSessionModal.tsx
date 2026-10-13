import { useState, useEffect, useRef } from 'react'
import { SessionConfig } from '../api/types'

interface CreateSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (config: SessionConfig) => void
}

export function CreateSessionModal({ isOpen, onClose, onSubmit }: CreateSessionModalProps) {
  const [config, setConfig] = useState<SessionConfig>({
    cwd: '.',
    target: 'web',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof SessionConfig, string>>>({})
  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => firstInputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const validate = () => {
    const newErrors: Partial<Record<keyof SessionConfig, string>> = {}
    if (!config.cwd.trim()) newErrors.cwd = 'Working directory is required'
    if (!config.target) newErrors.target = 'Target is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    onSubmit(config)
    setSubmitting(false)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgb(0 0 0 / 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 100,
        animation: 'fadeIn 0.2s ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflow: 'auto',
          animation: 'slideUp 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 id="modal-title" style={{ fontSize: '1.125rem', fontWeight: 600 }}>Create New Session</h2>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.375rem' }}
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="cwd" className="label">Working Directory</label>
            <input
              ref={firstInputRef}
              id="cwd"
              type="text"
              className="input"
              value={config.cwd}
              onChange={(e) => setConfig({ ...config, cwd: e.target.value })}
              placeholder="/path/to/repo"
              disabled={submitting}
              aria-invalid={!!errors.cwd}
              aria-describedby={errors.cwd ? 'cwd-error' : undefined}
            />
            {errors.cwd && (
              <p id="cwd-error" style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.cwd}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="config_path" className="label">Config Path (optional)</label>
            <input
              id="config_path"
              type="text"
              className="input"
              value={config.config_path || ''}
              onChange={(e) => setConfig({ ...config, config_path: e.target.value || undefined })}
              placeholder="e2e.config.ts"
              disabled={submitting}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="target" className="label">Target Platform</label>
            <select
              id="target"
              className="input"
              value={config.target}
              onChange={(e) => setConfig({ ...config, target: e.target.value as SessionConfig['target'] })}
              disabled={submitting}
            >
              <option value="web">Web (Playwright)</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="on_step_webhook" className="label">Step Progress Webhook (optional)</label>
            <input
              id="on_step_webhook"
              type="url"
              className="input"
              value={config.on_step_webhook || ''}
              onChange={(e) => setConfig({ ...config, on_step_webhook: e.target.value || undefined })}
              placeholder="https://example.com/webhook"
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: '1rem', height: '1rem' }} />
                  Creating…
                </>
              ) : (
                'Create Session'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}