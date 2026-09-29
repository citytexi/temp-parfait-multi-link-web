// 스펙 3장 수동 세팅 후 채워요. 비밀값이 아니라 공개 식별자예요.
export const GA_PROPERTY_ID = '543897329'
export const OAUTH_CLIENT_ID = '774115496627-cufgr2gbvvd68agic0i4ciuu09tr1itu.apps.googleusercontent.com'

export function isConfigured(): boolean {
  return GA_PROPERTY_ID.trim() !== '' && OAUTH_CLIENT_ID.trim() !== ''
}
