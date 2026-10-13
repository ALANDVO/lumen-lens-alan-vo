export interface SessionConfig {
  cwd: string
  config_path?: string
  config?: Record<string, unknown>
  target: 'web' | 'android' | 'ios'
  on_step_webhook?: string
}

export interface Session {
  id: string
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'closed'
  config: SessionConfig
  created_at: string
  updated_at: string
  closed_at?: string
  error?: string
}

export interface StepRecord {
  id: string
  session_id: string
  step_number: number
  action: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  artifacts: Record<string, unknown>
  error?: string
}

export interface User {
  id: string
  email: string
  roles: string[]
}

export interface HealthStatus {
  status: string
  app: string
  version: string
  environment: string
}