import { describe, expect, it } from 'vitest'
import { CHECKLIST, type ChecklistSection } from './template'
import { isChecked, newRelease, normalizePlatforms, parseReleases, platformsLabel, progress, releaseText, toggleItem, validateName, visibleSections, type Release } from './release'
import { decodeShare, encodeShare, shareUrl } from './share'

describe('release checklist', () => {
const ALL_IDS = CHECKLIST.flatMap((s) => s.items.map((i) => i.id))
const rel = (o: Partial<Parameters<typeof newRelease>[0]> = {}): Release =>
  newRelease({ id: 'r1', name: '1.5.0', platforms: ['android', 'ios'], now: '2026-10-08T00:00:00.000Z', ...o })
const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

it('has 22 items with unique ids in the spec sections', () => {
  expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length)
  expect(CHECKLIST.map((s) => [s.id, s.title, s.items.length])).toEqual([
    ['prepare', '준비', 4], ['verify', '확인', 4], ['android', 'Android', 5], ['ios', 'iOS', 5], ['after', '출시 후', 4],
  ])
  expect(CHECKLIST.find((s) => s.id === 'android')!.items.every((i) => i.platforms?.join() === 'android')).toBe(true)
  expect(CHECKLIST.find((s) => s.id === 'ios')!.items.every((i) => i.platforms?.join() === 'ios')).toBe(true)
  const withMenu = CHECKLIST.flatMap((s) => s.items).filter((i) => i.menu).map((i) => [i.id, i.menu])
  expect(withMenu).toEqual([['landing-links', 'ua-tester'], ['version-adoption', 'tech']])
  expect(CHECKLIST[0].items[0]).toMatchObject({ id: 'version-bumped', label: '버전 이름과 빌드 번호를 올렸어요' })
})
it('validates a version name', () => {
  expect(validateName('  1.5.0 ')).toEqual({ ok: true, name: '1.5.0' })
  expect(validateName('🍨'.repeat(40))).toMatchObject({ ok: true })
  expect(validateName('  ')).toEqual({ ok: false, error: '버전 이름을 넣어 주세요' })
  expect(validateName('a'.repeat(41))).toEqual({ ok: false, error: '버전 이름은 40자까지 쓸 수 있어요' })
  for (const bad of ['1.5\n.0', '1.5.0\n', 'a\u0007b', 'a\u2028b']) {
    expect(validateName(bad)).toEqual({ ok: false, error: '버전 이름에 줄바꿈이나 제어 문자는 쓸 수 없어요' })
  }
})
it('normalises platforms', () => {
  expect(normalizePlatforms(['ios', 'android', 'ios'])).toEqual(['android', 'ios'])
  for (const bad of [[], ['web'], ['android', 'web'], 'android', null, [1]]) expect(normalizePlatforms(bad)).toBeNull()
  expect(platformsLabel(['android', 'ios'])).toBe('Android, iOS')
  expect(platformsLabel(['ios'])).toBe('iOS')
})
it('shows the sections and items of the release platforms', () => {
  const both = visibleSections(rel())
  expect(both.map((s) => s.id)).toEqual(['prepare', 'verify', 'android', 'ios', 'after'])
  expect(progress(both)).toEqual({ done: 0, total: 22 })
  const android = visibleSections(rel({ platforms: ['android'] }))
  expect(android.map((s) => s.id)).toEqual(['prepare', 'verify', 'android', 'after'])
  expect(progress(android)).toEqual({ done: 0, total: 17 })
  expect(progress(visibleSections(rel({ platforms: ['ios'] })))).toEqual({ done: 0, total: 17 })
})
it('toggles an item and counts progress per section', () => {
  let r = toggleItem(rel(), 'version-bumped', '2026-10-08T01:00:00.000Z')
  expect(r.checked['version-bumped']).toBe('2026-10-08T01:00:00.000Z')
  expect(isChecked(r, 'version-bumped')).toBe(true)
  expect(visibleSections(r)[0].done).toBe(1)
  expect(progress(visibleSections(r))).toEqual({ done: 1, total: 22 })
  r = toggleItem(r, 'version-bumped', '2026-10-08T02:00:00.000Z')
  expect(isChecked(r, 'version-bumped')).toBe(false)
})
it('survives a template change', () => {
  const r = rel({ checked: ['version-bumped', 'removed-item', 'ios-submitted'], platforms: ['android'] })
  // 없어진 항목과 보이지 않는 플랫폼의 체크는 세지 않는다
  expect(progress(visibleSections(r))).toEqual({ done: 1, total: 17 })
  const template: ChecklistSection[] = [{ id: 's', title: 'S', items: [{ id: 'version-bumped', label: 'a' }, { id: 'brand-new', label: 'b' }] }]
  expect(visibleSections(r, template)).toEqual([{ id: 's', title: 'S', items: template[0].items, done: 1 }])
})
it('does not read inherited keys as checks', () => {
  const template: ChecklistSection[] = [{ id: 's', title: 'S', items: [{ id: 'constructor', label: 'a' }, { id: 'toString', label: 'b' }] }]
  expect(visibleSections(rel(), template)[0].done).toBe(0)
  expect(isChecked({ checked: {} }, 'toString')).toBe(false)
})
it('keeps valid stored releases and drops broken ones without throwing', () => {
  const good = { id: 'a', name: '1.5.0', platforms: ['android'], checked: { 'version-bumped': 't' }, createdAt: 't' }
  const junk = JSON.parse('{"id":"p","name":"1.4.0","platforms":["ios"],"checked":{"__proto__":"x","toString":"y","n":3},"createdAt":"t"}')
  const out = parseReleases([
    good, junk,
    { ...good, id: 'b', name: 'a'.repeat(41) }, { ...good, id: 'c', platforms: ['web'] }, { ...good, id: 'd', platforms: [] },
    { ...good, id: 'e', name: '1\n2' }, { ...good, id: 'a', name: 'dup' }, { ...good, id: '' }, { ...good, id: 'f', checked: 'x' }, null, 7,
  ])!
  expect(out.map((r) => r.id)).toEqual(['a', 'p', 'f'])
  expect(isChecked(out[0], 'version-bumped')).toBe(true)
  expect(Object.keys(out[1].checked).sort()).toEqual(['__proto__', 'toString'])
  expect(isChecked(out[1], 'n')).toBe(false)
  expect(progress(visibleSections(out[1]))).toEqual({ done: 0, total: 17 })
  expect(out[2].checked).toEqual({})
  expect(parseReleases({})).toBeNull()
  expect(parseReleases(Array.from({ length: 35 }, (_, i) => ({ ...good, id: `r${i}` })))).toHaveLength(30)
})
it('writes the progress text', () => {
  const r = rel({ platforms: ['android'], checked: ['version-bumped', 'release-notes', 'server-order', 'remote-config', 'core-flows'] })
  const lines = releaseText(r).split('\n')
  expect(lines.slice(0, 8)).toEqual([
    '파르페 1.5.0 릴리즈 (Android) 5 / 17', '',
    '준비 4/4', '✅ 버전 이름과 빌드 번호를 올렸어요', '✅ 릴리즈 노트를 썼어요', '✅ 서버 배포가 먼저 필요한지 확인했어요', '✅ Remote Config 값을 확인했어요',
    '확인 1/4',
  ])
  expect(lines[8]).toBe('✅ 가입, 로그인, 사진 올리기, 캔버스 공유, 알림을 직접 해 봤어요')
  expect(lines[9]).toBe('⬜ 새로 넣은 이벤트가 GA에 들어오는지 봤어요')
  expect(lines).toHaveLength(2 + 4 + 17)
  expect(releaseText(r).endsWith('\n')).toBe(false)
})
it('round-trips a share value, also through URLSearchParams and with Korean and emoji', () => {
  const r = rel({ name: '1.5.0 핫픽스 🍨', platforms: ['ios'], checked: ['ios-testflight', 'version-bumped', 'gone'] })
  const value = encodeShare(r)
  expect(value).toMatch(/^[A-Za-z0-9_-]+$/)
  const viaUrl = new URLSearchParams(new URL(shareUrl(r, { origin: 'https://a.b', pathname: '/admin/' })).search)
  expect(viaUrl.get('menu')).toBe('release-checklist')
  expect(viaUrl.get('share')).toBe(value)
  expect(decodeShare(viaUrl.get('share')!)).toEqual({ name: '1.5.0 핫픽스 🍨', platforms: ['ios'], checked: ['version-bumped', 'ios-testflight'] })
  expect(shareUrl(r, { origin: 'https://a.b', pathname: '/admin/' }).startsWith('https://a.b/admin/?menu=release-checklist&share=')).toBe(true)
})
it('carries no timestamps', () => {
  expect(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodeShare(rel({ checked: ['no-crash'] })).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))))
    .toEqual({ v: 1, name: '1.5.0', platforms: ['android', 'ios'], checked: ['no-crash'] })
})
it('stays under 4,000 characters with every item checked and the longest name', () => {
  for (const name of ['가'.repeat(40), '🍨'.repeat(40)]) {
    const r = rel({ name, checked: ALL_IDS })
    expect(encodeShare(r).length).toBeLessThanOrEqual(4000)
    expect(shareUrl(r, { origin: 'https://citytexi.github.io', pathname: '/temp-parfait-multi-link-web/admin/' }).length).toBeLessThanOrEqual(4000)
    expect(decodeShare(encodeShare(r))?.checked).toEqual(ALL_IDS)
  }
})
it.each([
  ['an empty string', ''],
  ['characters outside base64url', 'a+b/c='],
  ['broken base64', 'a'],
  ['bytes that are not UTF-8', 'wyg'],
  ['text that is not JSON', b64url('hello')],
  ['a JSON array', b64url('[]')],
  ['JSON null', b64url('null')],
  ['another version', b64url(JSON.stringify({ v: 2, name: 'x', platforms: ['ios'], checked: [] }))],
  ['a missing name', b64url(JSON.stringify({ v: 1, platforms: ['ios'], checked: [] }))],
  ['a 41-character name', b64url(JSON.stringify({ v: 1, name: 'a'.repeat(41), platforms: ['ios'], checked: [] }))],
  ['a name with a line break', b64url(JSON.stringify({ v: 1, name: 'a\nb', platforms: ['ios'], checked: [] }))],
  ['a name with outer spaces', b64url(JSON.stringify({ v: 1, name: ' a ', platforms: ['ios'], checked: [] }))],
  ['an unknown platform', b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['web'], checked: [] }))],
  ['no platform', b64url(JSON.stringify({ v: 1, name: 'x', platforms: [], checked: [] }))],
  ['checked that is not an array of strings', b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios'], checked: [1] }))],
])('rejects %s', (_name, param) => {
  expect(decodeShare(param)).toBeNull()
})
it('rejects a well-formed value longer than 4,000 characters before decoding it', () => {
  // 'A'.repeat(4001) 같은 값은 base64가 깨져서 길이 검사 없이도 거절된다. 길이 검사를 묶으려면 풀리는 값을 쓴다
  const long = b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios'], checked: Array(400).fill('no-crash') }))
  expect(long.length).toBeGreaterThan(4000)
  expect(decodeShare(long)).toBeNull()
})
it('merges duplicate platforms and drops unknown and repeated item ids', () => {
  const param = b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios', 'ios', 'android'], checked: ['nope', 'no-crash', 'no-crash', '__proto__'] }))
  expect(decodeShare(param)).toEqual({ name: 'x', platforms: ['android', 'ios'], checked: ['no-crash'] })
})
it('rejects direction-override, zero-width and ill-formed names', () => {
  const error = '버전 이름에 줄바꿈이나 제어 문자는 쓸 수 없어요'
  for (const bad of ['\u200b', '\u200d', '\u200f', '\u202a', '\u202e', '\u2066', '\u2069', '\ufeff']) {
    expect(validateName(`1.5${bad}.0`)).toEqual({ ok: false, error })
  }
  expect(validateName('\ufeff1.5.0')).toEqual({ ok: false, error })
  for (const bad of ['a\ud800', '\udc00a', 'a\ud800b', '\udc00\ud800']) expect(validateName(bad)).toEqual({ ok: false, error })
  expect(validateName('1.5.0 🍨')).toEqual({ ok: true, name: '1.5.0 🍨' })
  const good = { id: 'a', name: '1.5.0', platforms: ['android'], checked: {}, createdAt: 't' }
  expect(parseReleases([{ ...good, name: '1.5\u202e.0' }, { ...good, id: 'b', name: 'a\ud800' }, { ...good, id: 'c' }])!.map((r) => r.id)).toEqual(['c'])
})
it('reads a stored checked that is an array as empty', () => {
  const out = parseReleases([{ id: 'a', name: '1.5.0', platforms: ['android'], checked: ['version-bumped', 'a'], createdAt: 't' }])!
  expect(out).toHaveLength(1)
  expect(Object.keys(out[0].checked)).toEqual([])
})
it.each([
  ['a direction override (U+202E)', '1.5\u202e.0'],
  ['a zero-width space', '1.5\u200b.0'],
  ['a lone surrogate', 'a\ud800'],
])('rejects a shared name with %s', (_name, name) => {
  expect(decodeShare(b64url(JSON.stringify({ v: 1, name, platforms: ['ios'], checked: [] })))).toBeNull()
})
})
