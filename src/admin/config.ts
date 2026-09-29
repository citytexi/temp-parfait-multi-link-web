// 스펙 3장 수동 세팅 후 채워요. 비밀값이 아니라 공개 식별자예요.
export const GA_PROPERTY_ID = ''
export const OAUTH_CLIENT_ID = ''

export function isConfigured(): boolean {
  return GA_PROPERTY_ID.trim() !== '' && OAUTH_CLIENT_ID.trim() !== ''
}
