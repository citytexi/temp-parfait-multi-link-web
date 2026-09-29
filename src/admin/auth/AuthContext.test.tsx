import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

type Cfg = {
  client_id: string
  scope: string
  callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void
  error_callback: (e: { type?: string }) => void
}

let cfg: Cfg
let revoke: ReturnType<typeof vi.fn>
let requestAccessToken: ReturnType<typeof vi.fn>

function installGis() {
  revoke = vi.fn((_t: string, done: () => void) => done())
  requestAccessToken = vi.fn()
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (c: Cfg) => {
          cfg = c
          return { requestAccessToken }
        },
        hasGrantedAllScopes: () => true,
        revoke,
      },
    },
  } as unknown as Window['google']
}

let auth: ReturnType<typeof useAuth>
function Probe() {
  auth = useAuth()
  return null
}

function mount(now?: () => number) {
  return render(
    <AuthProvider clientId="cid" now={now}>
      <Probe />
    </AuthProvider>,
  )
}

async function signIn() {
  await waitFor(() => expect(auth.status).toBe('signedOut'))
  act(() => auth.login())
  act(() => cfg.callback({ access_token: 't', expires_in: 3600 }))
}

describe('AuthProvider', () => {
  beforeEach(installGis)
  afterEach(() => {
    delete window.google
  })

  it('starts loading, then signedOut once GIS is ready', async () => {
    mount()
    expect(auth.status).toBe('loading')
    await waitFor(() => expect(auth.status).toBe('signedOut'))
    expect(auth.loginError).toBeNull()
  })

  it('configures the token client with the client id and the read-only GA scope only', async () => {
    mount()
    await waitFor(() => expect(auth.status).toBe('signedOut'))
    expect(cfg.client_id).toBe('cid')
    expect(cfg.scope).toBe('https://www.googleapis.com/auth/analytics.readonly')
  })

  it('signs in with the token from the client callback', async () => {
    mount()
    await signIn()
    expect(requestAccessToken).toHaveBeenCalledWith()
    expect(auth.status).toBe('signedIn')
    expect(auth.token).toBe('t')
    expect(auth.getToken()).toBe('t')
  })

  it('expires the token lazily after expiry minus margin', async () => {
    let t = 1_000_000
    mount(() => t)
    await signIn()
    t += 3600 * 1000
    let got: string | null = 'x'
    act(() => {
      got = auth.getToken()
    })
    expect(got).toBeNull()
    expect(auth.status).toBe('expired')
    expect(auth.token).toBeNull()
  })

  it('keeps the token until 60s before expiry, then drops it', async () => {
    const start = 1_000_000
    let t = start
    mount(() => t)
    await signIn()
    t = start + 3500 * 1000
    let got: string | null = null
    act(() => {
      got = auth.getToken()
    })
    expect(got).toBe('t')
    expect(auth.status).toBe('signedIn')
    t = start + 3540 * 1000
    act(() => {
      got = auth.getToken()
    })
    expect(got).toBeNull()
    expect(auth.status).toBe('expired')
  })

  it('asks GIS for the account chooser when logging in with another account', async () => {
    mount()
    await waitFor(() => expect(auth.status).toBe('signedOut'))
    act(() => auth.login({ selectAccount: true }))
    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: 'select_account' })
  })

  it('reportAuthError maps to expired / forbidden', async () => {
    mount()
    await signIn()
    act(() => auth.reportAuthError('forbidden'))
    expect(auth.status).toBe('forbidden')
    act(() => auth.reportAuthError('auth'))
    expect(auth.status).toBe('expired')
  })

  it('revokes the dropped token when access turns out to be forbidden', async () => {
    mount()
    await signIn()
    act(() => auth.reportAuthError('forbidden'))
    expect(revoke).toHaveBeenCalledWith('t', expect.any(Function))
    expect(auth.token).toBeNull()
  })

  it('does not revoke on an expired token', async () => {
    mount()
    await signIn()
    act(() => auth.reportAuthError('auth'))
    expect(revoke).not.toHaveBeenCalled()
  })

  it('never throws when revoking a forbidden token fails', async () => {
    mount()
    await signIn()
    revoke.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => act(() => auth.reportAuthError('forbidden'))).not.toThrow()
    expect(auth.status).toBe('forbidden')
  })

  it('keeps the GA error message as a detail for the forbidden screen', async () => {
    mount()
    await signIn()
    expect(auth.authErrorDetail).toBeNull()
    act(() => auth.reportAuthError('forbidden', 'Google Analytics Data API has not been used'))
    expect(auth.authErrorDetail).toBe('Google Analytics Data API has not been used')
    act(() => auth.login())
    act(() => cfg.callback({ access_token: 't2', expires_in: 3600 }))
    expect(auth.status).toBe('signedIn')
    expect(auth.authErrorDetail).toBeNull()
  })

  it('has no detail when forbidden without a message or when expired', async () => {
    mount()
    await signIn()
    act(() => auth.reportAuthError('forbidden'))
    expect(auth.authErrorDetail).toBeNull()
    act(() => auth.reportAuthError('auth', 'Request had invalid authentication credentials'))
    expect(auth.authErrorDetail).toBeNull()
  })

  it('logout revokes the token and signs out', async () => {
    mount()
    await signIn()
    await act(() => auth.logout())
    expect(revoke).toHaveBeenCalledWith('t', expect.any(Function))
    expect(auth.status).toBe('signedOut')
    expect(auth.token).toBeNull()
    expect(auth.getToken()).toBeNull()
  })

  it('maps GIS errors to Korean messages', async () => {
    mount()
    await waitFor(() => expect(auth.status).toBe('signedOut'))
    act(() => cfg.error_callback({ type: 'popup_closed' }))
    expect(auth.loginError).toBe('로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요.')
    act(() => cfg.error_callback({ type: 'popup_failed_to_open' }))
    expect(auth.loginError).toBe('로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요.')
    act(() => cfg.callback({ error: 'access_denied' }))
    expect(auth.loginError).toBe('권한 허용이 필요해요. 다시 로그인해 주세요.')
    act(() => cfg.error_callback({ type: 'other' }))
    expect(auth.loginError).toBe('로그인하지 못했어요. 잠시 후 다시 시도해 주세요.')
    expect(auth.status).toBe('signedOut')
    act(() => auth.login())
    expect(auth.loginError).toBeNull()
  })

  it('treats a token without the granted scope as denied', async () => {
    mount()
    await waitFor(() => expect(auth.status).toBe('signedOut'))
    window.google!.accounts!.oauth2!.hasGrantedAllScopes = () => false
    act(() => cfg.callback({ access_token: 't', expires_in: 3600 }))
    expect(auth.status).toBe('signedOut')
    expect(auth.token).toBeNull()
    expect(auth.loginError).toBe('권한 허용이 필요해요. 다시 로그인해 주세요.')
  })

  it('reports a load failure when GIS never appears', async () => {
    delete window.google
    vi.useFakeTimers()
    try {
      mount()
      await act(() => vi.advanceTimersByTimeAsync(10_100))
    } finally {
      vi.useRealTimers()
    }
    expect(auth.status).toBe('signedOut')
    expect(auth.loginError).toBe('로그인 도구를 불러오지 못했어요. 새로고침해 주세요.')
    act(() => auth.login())
    expect(auth.loginError).toBe('로그인 도구를 불러오지 못했어요. 새로고침해 주세요.')
  })

  it('never persists anything in browser storage', async () => {
    mount()
    await signIn()
    await act(() => auth.logout())
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.cookie).toBe('')
  })
})
