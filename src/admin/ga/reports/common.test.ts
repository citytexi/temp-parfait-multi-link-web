import { describe, expect, it } from 'vitest'
import { displayDim, splitByDateRange, toRows } from './common'
import events from './__fixtures__/events.json'

describe('common', () => {
  it('toRows converts strings to numbers and handles empty', () => {
    expect(toRows({})).toEqual([])
    const rows = toRows({
      dimensionHeaders: [{ name: 'a' }],
      metricHeaders: [{ name: 'm' }, { name: 'n' }],
      rows: [{ dimensionValues: [{ value: 'x' }], metricValues: [{ value: '12' }, { value: 'NaN' }] }],
    })
    expect(rows).toEqual([{ dims: { a: 'x' }, mets: { m: 12, n: 0 } }])
  })
  it('splitByDateRange splits on dateRange dimension', () => {
    const { current, previous } = splitByDateRange(events)
    expect(current.every((r) => r.dims.dateRange === 'date_range_0')).toBe(true)
    expect(current).toHaveLength(12)
    expect(previous).toHaveLength(11)
    expect(splitByDateRange({})).toEqual({ current: [], previous: [] })
  })
  it('displayDim maps unset and other', () => {
    expect(displayDim('(not set)')).toBe('알 수 없음')
    expect(displayDim('')).toBe('알 수 없음')
    expect(displayDim('(other)')).toBe('기타')
    expect(displayDim('iOS')).toBe('iOS')
  })
})
