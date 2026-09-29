export const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export type GisErrorKind = 'popup_closed' | 'popup_blocked' | 'denied' | 'unknown'

interface GisTokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GisOauth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (resp: GisTokenResponse) => void
    error_callback: (err: { type?: string }) => void
  }): GisTokenClient
  hasGrantedAllScopes?(resp: GisTokenResponse, ...scopes: string[]): boolean
  revoke(token: string, done: (resp: { error?: string }) => void): void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } }
  }
}

function getOauth2(): GisOauth2 | undefined {
  return window.google?.accounts?.oauth2
}

export function loadGis(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (getOauth2()) return resolve()
      if (Date.now() - start >= timeoutMs) return reject(new Error('GIS load timeout'))
      setTimeout(check, 50)
    }
    check()
  })
}

export function createTokenClient(opts: {
  clientId: string
  onToken: (t: { accessToken: string; expiresIn: number }) => void
  onError: (kind: GisErrorKind) => void
}): { request(): void } {
  const oauth2 = getOauth2()
  if (!oauth2) throw new Error('GIS not loaded')
  const client = oauth2.initTokenClient({
    client_id: opts.clientId,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) {
        opts.onError(resp.error === 'access_denied' ? 'denied' : 'unknown')
        return
      }
      if (!resp.access_token) {
        opts.onError('unknown')
        return
      }
      if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(resp, SCOPE)) {
        opts.onError('denied')
        return
      }
      opts.onToken({ accessToken: resp.access_token, expiresIn: Number(resp.expires_in) || 0 })
    },
    error_callback: (err) => {
      if (err.type === 'popup_closed') opts.onError('popup_closed')
      else if (err.type === 'popup_failed_to_open') opts.onError('popup_blocked')
      else opts.onError('unknown')
    },
  })
  return { request: () => client.requestAccessToken() }
}

export function revokeToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    const oauth2 = getOauth2()
    if (!oauth2) return resolve()
    try {
      oauth2.revoke(token, () => resolve())
    } catch {
      resolve()
    }
  })
}
