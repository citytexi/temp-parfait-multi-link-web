import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createTokenClient, loadGis, revokeToken, type GisErrorKind } from './gis'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'expired' | 'forbidden'

interface AuthValue {
  status: AuthStatus
  token: string | null
  loginError: string | null
  login(): void
  logout(): Promise<void>
  getToken(): string | null
  reportAuthError(kind: 'auth' | 'forbidden'): void
}

const LOGIN_ERRORS: Record<GisErrorKind, string> = {
  popup_closed: '로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요.',
  popup_blocked: '로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요.',
  denied: '권한 허용이 필요해요. 다시 로그인해 주세요.',
  unknown: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
}
const LOAD_ERROR = '로그인 도구를 불러오지 못했어요. 새로고침해 주세요.'
const EXPIRY_MARGIN_MS = 60_000

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({
  clientId,
  now = Date.now,
  children,
}: {
  clientId: string
  now?: () => number
  children: ReactNode
}) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [token, setToken] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const expiresAtRef = useRef(0)
  const clientRef = useRef<{ request(): void } | null>(null)
  const nowRef = useRef(now)
  nowRef.current = now

  const clearToken = useCallback(() => {
    tokenRef.current = null
    expiresAtRef.current = 0
    setToken(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled) return
        clientRef.current = createTokenClient({
          clientId,
          onToken: ({ accessToken, expiresIn }) => {
            tokenRef.current = accessToken
            expiresAtRef.current = nowRef.current() + expiresIn * 1000 - EXPIRY_MARGIN_MS
            setToken(accessToken)
            setLoginError(null)
            setStatus('signedIn')
          },
          onError: (kind) => setLoginError(LOGIN_ERRORS[kind]),
        })
        setStatus('signedOut')
      })
      .catch(() => {
        if (cancelled) return
        setLoginError(LOAD_ERROR)
        setStatus('signedOut')
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const login = useCallback(() => {
    if (!clientRef.current) return
    setLoginError(null)
    clientRef.current.request()
  }, [])

  const getToken = useCallback(() => {
    if (!tokenRef.current) return null
    if (nowRef.current() >= expiresAtRef.current) {
      clearToken()
      setStatus('expired')
      return null
    }
    return tokenRef.current
  }, [clearToken])

  const logout = useCallback(async () => {
    const current = tokenRef.current
    clearToken()
    setStatus('signedOut')
    if (current) await revokeToken(current)
  }, [clearToken])

  const reportAuthError = useCallback(
    (kind: 'auth' | 'forbidden') => {
      clearToken()
      setStatus(kind === 'auth' ? 'expired' : 'forbidden')
    },
    [clearToken],
  )

  const value = useMemo(
    () => ({ status, token, loginError, login, logout, getToken, reportAuthError }),
    [status, token, loginError, login, logout, getToken, reportAuthError],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
