import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { FullScreenState } from './components/FullScreenState'
import { Shell } from './components/Shell'
import { isConfigured } from './config'
import { GaError } from './ga/errors'
import { GaProvider, gaQueryDefaults } from './hooks/useGa'

const SETUP_BODY =
  'src/admin/config.ts에 GA 속성 ID와 OAuth 클라이언트 ID를 넣어 주세요.\n자세한 방법은 README의 "어드민 대시보드 설정"을 봐 주세요.'

export function App() {
  const { status, login, loginError, authErrorDetail } = useAuth()

  if (!isConfigured()) return <FullScreenState title="설정이 필요해요" body={SETUP_BODY} />

  const loginButton = (label: string, opts?: { selectAccount: true }) => (
    <button type="button" className="adm-button adm-button--primary" onClick={() => (opts ? login(opts) : login())}>
      {label}
    </button>
  )

  switch (status) {
    case 'loading':
      return <FullScreenState title="불러오는 중이에요" />
    case 'signedOut':
      return (
        <FullScreenState
          title="파르페 대시보드"
          body="팀 Google 계정으로 로그인해 주세요."
          actions={
            <>
              {loginButton('Google 계정으로 로그인')}
              {loginError && (
                <p className="adm-fullscreen__error" role="alert">
                  {loginError}
                </p>
              )}
            </>
          }
        />
      )
    case 'expired':
      return <FullScreenState title="로그인이 만료됐어요" actions={loginButton('다시 로그인')} />
    case 'forbidden':
      return (
        <FullScreenState
          title="이 계정은 파르페 GA를 볼 권한이 없어요"
          body="관리자에게 GA 속성 뷰어 권한을 요청해 주세요. (GA 관리 → 속성 액세스 관리)"
          detail={authErrorDetail}
          actions={loginButton('다른 계정으로 로그인', { selectAccount: true })}
        />
      )
    case 'signedIn':
      return <SignedInApp />
  }
}

/**
 * Owns the QueryClient for one sign-in. Leaving signedIn unmounts it, which drops every
 * cached GA response and stops any polling.
 */
function SignedInApp() {
  const { reportAuthError } = useAuth()
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (e) => {
            if (e instanceof GaError && (e.kind === 'auth' || e.kind === 'forbidden')) reportAuthError(e.kind, e.message)
          },
        }),
        defaultOptions: { queries: gaQueryDefaults },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <GaProvider>
        <Shell />
      </GaProvider>
    </QueryClientProvider>
  )
}
