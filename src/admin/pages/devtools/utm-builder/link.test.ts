import { describe, expect, it } from 'vitest'
import { CHANNELS, UTM_VALUE } from './config'
import { addRecent, buildCampaign, normalizeUtm, parseRecent, qrFilename, recentTitle, reopenParams, utmError, type RecentLink, type UtmInput } from './link'

const URL0 = 'https://citytexi.github.io/temp-parfait-multi-link-web/'
const base: UtmInput = { channel: 'instagram', source: '', medium: '', campaign: '202610-launch', content: 'story' }
const recent = (o: Partial<RecentLink> = {}): RecentLink =>
  ({ channel: 'instagram', source: 'instagram', medium: 'social', campaign: 'c', content: '', createdAt: '2026-10-08T00:00:00.000Z', ...o })

describe('campaign link rules', () => {
  it('lists the channels with the spec values', () => {
    expect(CHANNELS.map((c) => [c.id, c.label, c.source, c.medium])).toEqual([
      ['instagram', '인스타그램', 'instagram', 'social'], ['kakaotalk', '카카오톡', 'kakaotalk', 'social'],
      ['threads', '스레드', 'threads', 'social'], ['x', 'X', 'x', 'social'], ['youtube', '유튜브', 'youtube', 'video'],
      ['naver_blog', '네이버 블로그', 'naver_blog', 'referral'], ['newsletter', '이메일', 'newsletter', 'email'],
      ['offline', '오프라인 QR', 'offline', 'qr'], ['paid', '유료 광고', null, 'cpc'], ['custom', '직접 입력', null, null],
    ])
    for (const c of CHANNELS) for (const v of [c.source, c.medium]) if (v !== null) expect(v).toMatch(UTM_VALUE)
  })
  it('normalises pasted text without dropping characters', () => {
    expect(normalizeUtm('  Summer  Sale\n')).toBe('summer-sale')
    expect(normalizeUtm('A\tB')).toBe('a-b')
    expect(normalizeUtm('한글 캠페인')).toBe('한글-캠페인')
    expect(normalizeUtm('   ')).toBe('')
  })
  it('explains what is wrong with a value', () => {
    expect(utmError('')).toBeNull()
    expect(utmError('202610-launch')).toBeNull()
    expect(utmError('a'.repeat(50))).toBeNull()
    expect(utmError('한글')).toBe('영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요')
    expect(utmError('a.b')).toBe('영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요')
    expect(utmError('-a')).toBe('영문 소문자나 숫자로 시작해야 해요')
    expect(utmError('a'.repeat(51))).toBe('50자까지 쓸 수 있어요')
  })
  it('builds the link in a fixed param order', () => {
    expect(buildCampaign(base)).toEqual({
      ok: true,
      values: { source: 'instagram', medium: 'social', campaign: '202610-launch', content: 'story' },
      url: `${URL0}?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story`,
    })
    expect(buildCampaign({ ...base, content: '' })).toMatchObject({ url: `${URL0}?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch` })
  })
  it('ignores typed source and medium when the channel fixes them', () => {
    expect(buildCampaign({ ...base, source: 'x', medium: 'y' })).toEqual(buildCampaign(base))
  })
  it('takes source for paid and both for custom', () => {
    expect(buildCampaign({ ...base, channel: 'paid', source: 'Google', content: '' }))
      .toMatchObject({ url: `${URL0}?utm_source=google&utm_medium=cpc&utm_campaign=202610-launch` })
    expect(buildCampaign({ ...base, channel: 'custom', source: 'partner', medium: 'affiliate', content: '' }))
      .toMatchObject({ url: `${URL0}?utm_source=partner&utm_medium=affiliate&utm_campaign=202610-launch` })
  })
  it('makes the link from normalised values', () => {
    expect(buildCampaign({ ...base, campaign: '  Summer  Sale ', content: '' }))
      .toMatchObject({ ok: true, url: `${URL0}?utm_source=instagram&utm_medium=social&utm_campaign=summer-sale` })
  })
  it('says what is missing, first thing first', () => {
    const hint = (i: Partial<UtmInput>) => { const r = buildCampaign({ ...base, ...i }); return r.ok ? null : r.hint }
    expect(hint({ channel: null })).toBe('어디에 올릴지 고르면 링크가 만들어져요')
    expect(hint({ channel: 'nope' })).toBe('어디에 올릴지 고르면 링크가 만들어져요')
    expect(hint({ channel: 'paid' })).toBe('출처를 넣으면 링크가 만들어져요')
    expect(hint({ channel: 'custom', source: 's' })).toBe('매체를 넣으면 링크가 만들어져요')
    expect(hint({ campaign: ' ' })).toBe('캠페인 이름을 넣으면 링크가 만들어져요')
    expect(hint({ content: '스토리' })).toBe('입력한 값을 고치면 링크가 만들어져요')
  })
  it('reports format errors per field and never for an empty one', () => {
    expect(buildCampaign({ ...base, campaign: '', content: 'a b!' })).toEqual({
      ok: false, errors: { content: '영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요' }, hint: '캠페인 이름을 넣으면 링크가 만들어져요',
    })
  })
  it('names QR files by source, campaign and content', () => {
    const v = { source: 'instagram', medium: 'social', campaign: '202610-launch', content: 'story' }
    expect(qrFilename(v, 'png')).toBe('parfait-qr-instagram-202610-launch-story.png')
    expect(qrFilename({ ...v, source: 'kakaotalk', content: '' }, 'svg')).toBe('parfait-qr-kakaotalk-202610-launch.svg')
  })
  it('moves a repeated link to the top and keeps 20', () => {
    const list = Array.from({ length: 20 }, (_, i) => recent({ campaign: `c${i}` }))
    const again = recent({ campaign: 'c5', channel: 'custom', createdAt: '2026-10-09T00:00:00.000Z' })
    const out = addRecent(list, again)
    expect(out).toHaveLength(20)
    expect(out[0]).toEqual(again)
    expect(out.filter((r) => r.campaign === 'c5')).toHaveLength(1)
    expect(addRecent(list, recent({ campaign: 'new' })).map((r) => r.campaign).slice(-1)).toEqual(['c18'])
  })
  it('drops stored items that are malformed or break the format, and keeps the rest', () => {
    expect(parseRecent('nope')).toBeNull()
    expect(parseRecent([recent(), { ...recent(), campaign: 'A B' }, { ...recent(), source: 'javascript:x' }, { source: 's' }, null, 3]))
      .toEqual([recent()])
    expect(parseRecent(Array.from({ length: 25 }, (_, i) => recent({ campaign: `c${i}` })))).toHaveLength(20)
  })
  it('titles a record', () => {
    expect(recentTitle(recent({ campaign: '202610-launch', content: 'story' }))).toBe('인스타그램 · 202610-launch · story')
    expect(recentTitle(recent({ channel: 'paid', source: 'google', medium: 'cpc' }))).toBe('유료 광고 (google) · c')
    expect(recentTitle(recent({ channel: 'gone', source: 's', medium: 'm' }))).toBe('s / m · c')
  })
  it('reopens a record so it gives the same link', () => {
    expect(reopenParams(recent({ content: 'story' }))).toEqual({ ch: 'instagram', src: '', med: '', camp: 'c', content: 'story' })
    expect(reopenParams(recent({ channel: 'paid', source: 'google', medium: 'cpc' }))).toEqual({ ch: 'paid', src: 'google', med: '', camp: 'c', content: '' })
    expect(reopenParams(recent({ channel: 'gone', source: 's', medium: 'm' }))).toEqual({ ch: 'custom', src: 's', med: 'm', camp: 'c', content: '' })
    // 채널은 남아 있지만 규칙이 바뀐 경우
    expect(reopenParams(recent({ channel: 'instagram', source: 'ig', medium: 'social' }))).toEqual({ ch: 'custom', src: 'ig', med: 'social', camp: 'c', content: '' })
  })
})
