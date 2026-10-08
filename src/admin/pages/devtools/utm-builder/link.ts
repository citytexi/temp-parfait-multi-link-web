import type { Parser } from '../../../lib/localStore'
import { LANDING_URL } from '../../../lib/siteUrls'
import { CHANNELS, RECENT_MAX, UTM_VALUE, type Channel } from './config'

export type UtmValues = { source: string; medium: string; campaign: string; content: string }
export type UtmField = keyof UtmValues
/** What the fields hold, as typed. */
export type UtmInput = { channel: string | null } & UtmValues
export type UtmResult =
  | { ok: true; values: UtmValues; url: string }
  | { ok: false; errors: Partial<Record<UtmField, string>>; hint: string }

export function findChannel(id: string | null): Channel | undefined {
  return id === null ? undefined : CHANNELS.find((c) => c.id === id)
}

/** Trim, lower-case, inner whitespace runs to one hyphen. Nothing else is touched. */
export function normalizeUtm(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

export function utmError(normalized: string): string | null {
  if (normalized === '') return null
  if (!/^[a-z0-9_-]+$/.test(normalized)) return '영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요'
  if (/^[-_]/.test(normalized)) return '영문 소문자나 숫자로 시작해야 해요'
  if (normalized.length > 50) return '50자까지 쓸 수 있어요'
  return null
}

const FIELDS: readonly UtmField[] = ['source', 'medium', 'campaign', 'content']

export function buildCampaign(input: UtmInput): UtmResult {
  const channel = findChannel(input.channel)
  const values: UtmValues = {
    source: normalizeUtm(channel?.source ?? input.source),
    medium: normalizeUtm(channel?.medium ?? input.medium),
    campaign: normalizeUtm(input.campaign),
    content: normalizeUtm(input.content),
  }
  const errors: Partial<Record<UtmField, string>> = {}
  for (const f of FIELDS) {
    const e = utmError(values[f])
    if (e) errors[f] = e
  }
  let hint: string | null = null
  if (!channel) hint = '어디에 올릴지 고르면 링크가 만들어져요'
  else if (!values.source) hint = '출처를 넣으면 링크가 만들어져요'
  else if (!values.medium) hint = '매체를 넣으면 링크가 만들어져요'
  else if (!values.campaign) hint = '캠페인 이름을 넣으면 링크가 만들어져요'
  else if (Object.keys(errors).length > 0) hint = '입력한 값을 고치면 링크가 만들어져요'
  if (hint !== null) return { ok: false, errors, hint }
  const tail = values.content ? `&utm_content=${values.content}` : ''
  const url = `${LANDING_URL}?utm_source=${values.source}&utm_medium=${values.medium}&utm_campaign=${values.campaign}${tail}`
  return { ok: true, values, url }
}

export function qrFilename(values: UtmValues, ext: 'png' | 'svg'): string {
  return `parfait-qr-${values.source}-${values.campaign}${values.content ? `-${values.content}` : ''}.${ext}`
}

export type RecentLink = UtmValues & { channel: string; createdAt: string }

/** Stored records are untrusted: keep only well-formed items, at most RECENT_MAX. */
export const parseRecent: Parser<RecentLink[]> = (raw) => {
  if (!Array.isArray(raw)) return null
  const out: RecentLink[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const { channel, createdAt, source, medium, campaign, content } = r
    if (typeof channel !== 'string' || typeof createdAt !== 'string') continue
    if (typeof source !== 'string' || !UTM_VALUE.test(source)) continue
    if (typeof medium !== 'string' || !UTM_VALUE.test(medium)) continue
    if (typeof campaign !== 'string' || !UTM_VALUE.test(campaign)) continue
    if (typeof content !== 'string' || (content !== '' && !UTM_VALUE.test(content))) continue
    out.push({ channel, source, medium, campaign, content, createdAt })
    if (out.length === RECENT_MAX) break
  }
  return out
}

export function addRecent(list: readonly RecentLink[], item: RecentLink): RecentLink[] {
  const same = (r: RecentLink) =>
    r.source === item.source && r.medium === item.medium && r.campaign === item.campaign && r.content === item.content
  return [item, ...list.filter((r) => !same(r))].slice(0, RECENT_MAX)
}

export function recentTitle(item: RecentLink): string {
  const channel = findChannel(item.channel)
  let head: string
  if (!channel) head = `${item.source} / ${item.medium}`
  else if (channel.source !== null) head = channel.label
  else head = `${channel.label} (${item.source})`
  return `${head} · ${item.campaign}${item.content ? ` · ${item.content}` : ''}`
}

export function reopenParams(item: RecentLink): { ch: string; src: string; med: string; camp: string; content: string } {
  const channel = findChannel(item.channel)
  const fits =
    channel !== undefined &&
    (channel.source === null || channel.source === item.source) &&
    (channel.medium === null || channel.medium === item.medium)
  if (!fits) return { ch: 'custom', src: item.source, med: item.medium, camp: item.campaign, content: item.content }
  return {
    ch: channel.id,
    src: channel.source === null ? item.source : '',
    med: channel.medium === null ? item.medium : '',
    camp: item.campaign,
    content: item.content,
  }
}
