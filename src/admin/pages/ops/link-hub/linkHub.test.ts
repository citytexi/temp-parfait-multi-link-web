import { describe, expect, it } from 'vitest'
import { APP_STORE_URL, PLAY_WEB_URL } from '../../../../landing/ua'
import { LANDING_URL } from '../../../lib/siteUrls'
import { LINK_GROUPS, TEAM_LINKS } from './links'
import { hostOf, matchesQuery, parsePersonal, validatePersonal } from './personal'

describe('link hub rules', () => {
  it('lists the team links with unique ids, https urls and the spec addresses', () => {
    expect(new Set(TEAM_LINKS.map((l) => l.id)).size).toBe(TEAM_LINKS.length)
    for (const l of TEAM_LINKS) {
      expect(new URL(l.url).protocol).toBe('https:')
      expect(l.description).toMatch(/요$/)
      expect(LINK_GROUPS.some((g) => g.id === l.group)).toBe(true)
    }
    expect(TEAM_LINKS.map((l) => [l.id, l.group, l.label, l.url])).toEqual([
      ['firebase-console', 'analytics', 'Firebase 콘솔', 'https://console.firebase.google.com/project/parfait-5934b/overview'],
      ['google-analytics', 'analytics', 'Google Analytics', 'https://analytics.google.com/analytics/web/#/p543897329/reports/intelligenthome'],
      ['play-console', 'store', 'Play Console', 'https://play.google.com/console'],
      ['app-store-connect', 'store', 'App Store Connect', 'https://appstoreconnect.apple.com/apps'],
      ['play-store-page', 'store', 'Play 스토어 페이지', PLAY_WEB_URL],
      ['app-store-page', 'store', 'App Store 페이지', APP_STORE_URL],
      ['github-repo', 'dev', '이 레포 (GitHub)', 'https://github.com/citytexi/temp-parfait-multi-link-web'],
      ['gcp-console', 'dev', 'Google Cloud 콘솔', 'https://console.cloud.google.com/apis/credentials?project=parfait-5934b'],
      ['landing', 'dev', '랜딩 페이지', LANDING_URL],
    ])
    expect(LINK_GROUPS.map((g) => [g.id, g.label])).toEqual([['analytics', '분석'], ['store', '스토어'], ['dev', '개발'], ['docs', '디자인·문서']])
  })
  it('accepts a trimmed name and an https url, and stores the parsed url', () => {
    expect(validatePersonal({ label: '  Figma ', url: ' https://figma.com/file/x?y=1 ' })).toEqual({ ok: true, label: 'Figma', url: 'https://figma.com/file/x?y=1' })
    expect(validatePersonal({ label: '가'.repeat(40), url: 'https://a.b' })).toMatchObject({ ok: true, url: 'https://a.b/' })
  })
  it.each([
    ['javascript:alert(1)'], ['http://a.b'], ['data:text/html,x'], ['a.b'], ['https://'], ['//a.b'],
    ['blob:https://a.b/1'], ['file:///etc/passwd'], ['/relative/path'], ['\u0000javascript:alert(1)'], ['\u0001https://a.b'], ['java\nscript:alert(1)'],
  ])('rejects the url %j', (url) => {
    expect(validatePersonal({ label: 'x', url })).toEqual({ ok: false, errors: { url: 'https://로 시작하는 주소만 넣을 수 있어요' } })
  })
  it('rejects an empty or long name and an empty url', () => {
    expect(validatePersonal({ label: '  ', url: '' })).toEqual({ ok: false, errors: { label: '이름을 넣어 주세요', url: '주소를 넣어 주세요' } })
    expect(validatePersonal({ label: '가'.repeat(41), url: 'https://a.b' })).toEqual({ ok: false, errors: { label: '이름은 40자까지 쓸 수 있어요' } })
  })
  it('checks stored links again and keeps the valid ones', () => {
    const good = { id: '1', label: 'Figma', url: 'https://figma.com/' }
    expect(parsePersonal({})).toBeNull()
    expect(parsePersonal([
      good, { id: '2', label: 'x', url: 'javascript:alert(1)' }, { id: '3', label: '', url: 'https://a.b/' },
      { id: '1', label: 'dup', url: 'https://a.b/' }, { label: 'no id', url: 'https://a.b/' }, null, 'x',
    ])).toEqual([good])
    expect(parsePersonal(Array.from({ length: 60 }, (_, i) => ({ id: String(i), label: 'x', url: 'https://a.b/' })))).toHaveLength(50)
  })
  it('never lets a stored non-https address through', () => {
    const urls = ['javascript:alert(1)', 'data:text/html,x', 'http://a.b/', 'blob:https://a.b/1', 'file:///x', '//a.b', '/x', ' javascript:alert(1)']
    const stored = urls.map((url, i) => ({ id: String(i), label: 'x', url }))
    expect(parsePersonal(stored)).toEqual([])
  })
  it('rejects an address longer than 2,000 characters, typed or after parsing', () => {
    const tooLong = { ok: false, errors: { url: '주소는 2,000자까지 쓸 수 있어요' } }
    const fits = `https://a.b/${'x'.repeat(2000 - 'https://a.b/'.length)}`
    expect(fits).toHaveLength(2000)
    expect(validatePersonal({ label: 'x', url: `  ${fits}  ` })).toEqual({ ok: true, label: 'x', url: fits })
    expect(validatePersonal({ label: 'x', url: `${fits}x` })).toEqual(tooLong)
    // Not an address at all, but the length is checked before parsing.
    expect(validatePersonal({ label: 'x', url: 'x'.repeat(2001) })).toEqual(tooLong)
    // 300 typed characters that percent-encoding grows past the limit: it would not survive the next read.
    expect(validatePersonal({ label: 'x', url: `https://a.b/${'가'.repeat(300)}` })).toEqual(tooLong)
  })
  it('rejects an address with a username or a password', () => {
    const credentials = { ok: false, errors: { url: '아이디나 비밀번호가 들어간 주소는 넣을 수 없어요' } }
    expect(validatePersonal({ label: 'x', url: 'https://evil@good.com' })).toEqual(credentials)
    expect(validatePersonal({ label: 'x', url: 'https://user:pw@good.com/path' })).toEqual(credentials)
    expect(validatePersonal({ label: 'x', url: 'https://:pw@good.com' })).toEqual(credentials)
    expect(validatePersonal({ label: 'x', url: 'https://good.com/@evil' })).toMatchObject({ ok: true })
  })
  it('drops stored links that are too long or carry credentials', () => {
    const good = { id: '1', label: 'ok', url: 'https://a.b/' }
    expect(parsePersonal([
      { id: '2', label: 'long', url: `https://a.b/${'x'.repeat(2000)}` },
      { id: '3', label: 'user', url: 'https://evil@good.com/' },
      { id: '4', label: 'password', url: 'https://user:pw@good.com/' },
      good,
    ])).toEqual([good])
  })
  it('searches name, description and url literally', () => {
    const link = { label: 'Firebase 콘솔', description: '앱 설정을 봐요', url: 'https://console.firebase.google.com/x' }
    expect(matchesQuery(link, '')).toBe(true)
    expect(matchesQuery(link, '  FIREBASE ')).toBe(true)
    expect(matchesQuery(link, '설정')).toBe(true)
    expect(matchesQuery(link, 'google.com')).toBe(true)
    expect(matchesQuery(link, 'figma')).toBe(false)
    expect(() => matchesQuery(link, '([\\.')).not.toThrow()
    expect(matchesQuery(link, '.*')).toBe(false)
  })
  it('reads the host name', () => {
    expect(hostOf('https://console.firebase.google.com/project/x')).toBe('console.firebase.google.com')
    expect(hostOf('nope')).toBe('')
  })
})
