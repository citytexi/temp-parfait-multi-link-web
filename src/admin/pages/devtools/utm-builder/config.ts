/** One place to post a link. A null source or medium is typed in by the user. */
export type Channel = { id: string; label: string; source: string | null; medium: string | null }

export const CHANNELS: readonly Channel[] = [
  { id: 'instagram', label: '인스타그램', source: 'instagram', medium: 'social' },
  { id: 'kakaotalk', label: '카카오톡', source: 'kakaotalk', medium: 'social' },
  { id: 'threads', label: '스레드', source: 'threads', medium: 'social' },
  { id: 'x', label: 'X', source: 'x', medium: 'social' },
  { id: 'youtube', label: '유튜브', source: 'youtube', medium: 'video' },
  { id: 'naver_blog', label: '네이버 블로그', source: 'naver_blog', medium: 'referral' },
  { id: 'newsletter', label: '이메일', source: 'newsletter', medium: 'email' },
  { id: 'offline', label: '오프라인 QR', source: 'offline', medium: 'qr' },
  { id: 'paid', label: '유료 광고', source: null, medium: 'cpc' },
  { id: 'custom', label: '직접 입력', source: null, medium: null },
]

/** Format every utm_* value must follow. */
export const UTM_VALUE = /^[a-z0-9][a-z0-9_-]{0,49}$/
export const CAMPAIGN_EXAMPLE = '202610-launch'
export const RECENT_KEY = 'parfait-admin:utm-builder:recent'
export const RECENT_MAX = 20
