import { describe, expect, it } from 'vitest'
import { eventLabel } from './eventLabels'

describe('eventLabel', () => {
  it('translates registered events', () => {
    expect(eventLabel('first_open')).toEqual({ label: '처음 앱 열기', registered: true })
    expect(eventLabel('app_exception')).toEqual({ label: '앱 오류', registered: true })
  })
  it('passes unregistered names through', () => {
    expect(eventLabel('custom_x')).toEqual({ label: 'custom_x', registered: false })
    expect(eventLabel('toString')).toEqual({ label: 'toString', registered: false })
  })
})
