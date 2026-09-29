export type GaErrorKind = 'auth' | 'forbidden' | 'quota' | 'network' | 'server' | 'bad_request'

export class GaError extends Error {
  kind: GaErrorKind
  status?: number

  constructor(kind: GaErrorKind, message?: string, status?: number) {
    super(message ?? kind)
    Object.setPrototypeOf(this, GaError.prototype)
    this.name = 'GaError'
    this.kind = kind
    this.status = status
  }
}

export function isRetryable(e: unknown): boolean {
  return e instanceof GaError && (e.kind === 'network' || e.kind === 'server')
}

export function classifyStatus(status: number, gaStatus?: string): GaErrorKind {
  if (gaStatus === 'RESOURCE_EXHAUSTED') return 'quota'
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'quota'
  if (status >= 500) return 'server'
  return 'bad_request'
}
