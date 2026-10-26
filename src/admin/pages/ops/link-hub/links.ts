import { LANDING_URL } from '../../../lib/siteUrls'
import { APP_STORE_URL, PLAY_WEB_URL } from '../../../../landing/ua'

export type LinkGroupId = 'analytics' | 'store' | 'dev' | 'docs'
export type TeamLink = { id: string; group: LinkGroupId; label: string; description: string; url: string }

export const LINK_GROUPS: readonly { id: LinkGroupId; label: string }[] = [
  { id: 'analytics', label: '분석' },
  { id: 'store', label: '스토어' },
  { id: 'dev', label: '개발' },
  { id: 'docs', label: '디자인·문서' },
]

export const TEAM_LINKS: readonly TeamLink[] = [
  {
    id: 'firebase-console',
    group: 'analytics',
    label: 'Firebase 콘솔',
    description: '앱 설정과 Remote Config를 봐요',
    url: 'https://console.firebase.google.com/project/parfait-5934b/overview',
  },
  {
    id: 'google-analytics',
    group: 'analytics',
    label: 'Google Analytics',
    description: 'GA 보고서를 직접 열어요',
    url: 'https://analytics.google.com/analytics/web/#/p543897329/reports/intelligenthome',
  },
  {
    id: 'play-console',
    group: 'store',
    label: 'Play Console',
    description: 'Android 출시와 심사를 관리해요',
    url: 'https://play.google.com/console',
  },
  {
    id: 'app-store-connect',
    group: 'store',
    label: 'App Store Connect',
    description: 'iOS 출시와 심사를 관리해요',
    url: 'https://appstoreconnect.apple.com/apps',
  },
  {
    id: 'play-store-page',
    group: 'store',
    label: 'Play 스토어 페이지',
    description: '사용자에게 보이는 Android 스토어 화면이에요',
    url: PLAY_WEB_URL,
  },
  {
    id: 'app-store-page',
    group: 'store',
    label: 'App Store 페이지',
    description: '사용자에게 보이는 iOS 스토어 화면이에요',
    url: APP_STORE_URL,
  },
  {
    id: 'github-repo',
    group: 'dev',
    label: '이 레포 (GitHub)',
    description: '랜딩과 이 대시보드의 코드예요',
    url: 'https://github.com/citytexi/temp-parfait-multi-link-web',
  },
  {
    id: 'gcp-console',
    group: 'dev',
    label: 'Google Cloud 콘솔',
    description: 'OAuth 클라이언트와 API 설정을 봐요',
    url: 'https://console.cloud.google.com/apis/credentials?project=parfait-5934b',
  },
  {
    id: 'landing',
    group: 'dev',
    label: '랜딩 페이지',
    description: '앱 설치로 보내는 멀티링크 페이지예요',
    url: LANDING_URL,
  },
]
