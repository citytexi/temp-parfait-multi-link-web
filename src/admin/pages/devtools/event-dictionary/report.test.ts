import { describe, expect, it } from 'vitest'
import {
  buildObservedRequest, buildRecentRequest, parseMetadata, parseObserved, parseRecent,
} from './report'
import observed from './__fixtures__/observed.json'
import recent from './__fixtures__/recent.json'
import metadata from './__fixtures__/metadata.json'

describe('event dictionary report', () => {
  it('builds the observed request for the current range only', () => {
    expect(buildObservedRequest({ startDate: '2026-10-01', endDate: '2026-10-07' })).toEqual({
      dateRanges: [{ startDate: '2026-10-01', endDate: '2026-10-07' }],
      dimensions: [{ name: 'eventName' }, { name: 'platform' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      limit: 10000,
    })
  })
  it('sums platforms per event', () => {
    const o = parseObserved(observed)
    expect(o.get('screen_view')).toEqual({
      count: 160, users: 65,
      byPlatform: [{ platform: 'Android', count: 100, users: 40 }, { platform: 'iOS', count: 60, users: 25 }],
    })
    expect(o.size).toBe(4)
  })
  it('builds the recent request', () => {
    expect(buildRecentRequest()).toEqual({
      dimensions: [{ name: 'eventName' }, { name: 'platform' }],
      metrics: [{ name: 'eventCount' }],
      minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
      limit: 10000,
    })
  })
  it('parses recent events by platform', () => {
    expect(parseRecent(recent).get('today_only')).toEqual([{ platform: 'iOS', count: 1 }])
  })
  it('survives empty responses', () => {
    expect(parseObserved({}).size).toBe(0)
    expect(parseRecent({}).size).toBe(0)
    expect(parseMetadata({})).toEqual([])
  })
  it('picks customEvent params from both dimensions and metrics', () => {
    expect(parseMetadata(metadata)).toEqual([
      { name: 'item_id', uiName: '상품 ID', description: '', kind: 'dimension' },
      { name: 'price', uiName: '가격', description: '', kind: 'metric' },
    ])
  })
})
