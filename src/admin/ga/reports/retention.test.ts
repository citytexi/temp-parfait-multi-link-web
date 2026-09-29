import { describe, expect, it } from 'vitest'
import { buildEngagementRequest, buildRetentionRequest, parseEngagement, parseRetention } from './retention'
import retention from './__fixtures__/retention.json'
import engagement from './__fixtures__/engagement.json'

const r = {
  current: { startDate: '2026-09-15', endDate: '2026-09-21' },
  previous: { startDate: '2026-09-08', endDate: '2026-09-14' },
}
const today = '2026-09-29'

describe('retention', () => {
  it('builds cohorts from the last four completed weeks', () => {
    const req = buildRetentionRequest(today)
    expect(req.dateRanges).toBeUndefined()
    expect(req.dimensions).toEqual([{ name: 'cohort' }, { name: 'cohortNthWeek' }])
    expect(req.metrics).toEqual([{ name: 'cohortActiveUsers' }])
    expect(req.cohortSpec?.cohortsRange).toEqual({ granularity: 'WEEKLY', startOffset: 0, endOffset: 4 })
    expect(req.cohortSpec?.cohorts.map((c) => c.dateRange)).toEqual([
      { startDate: '2026-08-30', endDate: '2026-09-05' },
      { startDate: '2026-09-06', endDate: '2026-09-12' },
      { startDate: '2026-09-13', endDate: '2026-09-19' },
      { startDate: '2026-09-20', endDate: '2026-09-26' },
    ])
    expect(req.cohortSpec?.cohorts.every((c) => c.dimension === 'firstSessionDate')).toBe(true)
    expect(req.cohortSpec?.cohorts[0].name).toBe('2026-08-30~2026-09-05')
  })
  it('does not treat an unfinished week as complete on Saturday and Sunday', () => {
    // 2026-10-03 is Saturday: last completed week ends 09-26
    expect(buildRetentionRequest('2026-10-03').cohortSpec?.cohorts[3].dateRange.endDate).toBe('2026-09-26')
    // 2026-10-04 is Sunday: last completed week ends 10-03
    expect(buildRetentionRequest('2026-10-04').cohortSpec?.cohorts[3].dateRange.endDate).toBe('2026-10-03')
  })
  it('builds engagement request', () => {
    expect(buildEngagementRequest(r)).toEqual({
      dateRanges: [r.current, r.previous],
      metrics: [{ name: 'sessionsPerUser' }, { name: 'userEngagementDuration' }, { name: 'activeUsers' }],
    })
  })
  it('parses retention ratios with null for weeks not yet elapsed', () => {
    const { cohorts } = parseRetention(retention, today)
    expect(cohorts.map((c) => c.label)).toEqual([
      '08.30 ~ 09.05',
      '09.06 ~ 09.12',
      '09.13 ~ 09.19',
      '09.20 ~ 09.26',
    ])
    expect(cohorts[0]).toEqual({ label: '08.30 ~ 09.05', size: 100, weeks: [1, 0.5, 0.4, 0.3, null] })
    expect(cohorts[1].weeks).toEqual([1, 0.45, 0.35, null, null])
    expect(cohorts[3]).toMatchObject({ size: 60, weeks: [1, null, null, null, null] })
  })
  it('gives zeros for empty cohorts and empty for no rows', () => {
    const res = {
      dimensionHeaders: [{ name: 'cohort' }, { name: 'cohortNthWeek' }],
      metricHeaders: [{ name: 'cohortActiveUsers' }],
      rows: [{ dimensionValues: [{ value: '2026-08-30~2026-09-05' }, { value: '0000' }], metricValues: [{ value: '0' }] }],
    }
    expect(parseRetention(res, today).cohorts[0].weeks).toEqual([0, 0, 0, 0, null])
    const empty = parseRetention({}, today).cohorts
    expect(empty).toHaveLength(4)
    expect(empty[0]).toMatchObject({ size: 0, weeks: [0, 0, 0, 0, null] })
    expect(empty[3]).toMatchObject({ size: 0, weeks: [0, null, null, null, null] })
  })
  it('keeps a cohort GA omitted with size 0', () => {
    const rows = retention.rows.filter((row) => row.dimensionValues[0].value !== '2026-09-13~2026-09-19')
    const { cohorts } = parseRetention({ ...retention, rows }, today)
    expect(cohorts).toHaveLength(4)
    expect(cohorts[2]).toEqual({ label: '09.13 ~ 09.19', size: 0, weeks: [0, 0, null, null, null] })
    expect(cohorts[0].size).toBe(100)
  })
  it('parses engagement', () => {
    const m = parseEngagement(engagement)
    expect(m.sessionsPerUser).toMatchObject({ current: 3.5, previous: 3 })
    expect(m.sessionsPerUser.delta.text).toBe('▲ 17%')
    expect(m.avgEngagementSec).toMatchObject({ current: 200, previous: 150 })
    const empty = parseEngagement({})
    expect(empty.sessionsPerUser.current).toBe(0)
    expect(empty.avgEngagementSec.current).toBe(0)
  })
})
