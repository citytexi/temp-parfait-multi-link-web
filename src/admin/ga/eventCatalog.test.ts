import { describe, expect, it } from 'vitest'
import { EVENT_CATALOG, findEvent, targetPlatforms } from './eventCatalog'

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

describe('eventCatalog', () => {
  it('has unique, valid event names', () => {
    const names = EVENT_CATALOG.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(NAME)
  })
  it('has unique, valid param names inside each event', () => {
    for (const e of EVENT_CATALOG) {
      const names = e.params.map((p) => p.name)
      expect(new Set(names).size).toBe(names.length)
      for (const n of names) expect(n).toMatch(NAME)
    }
  })
  it('carries the ten auto-collected events with a label and a description', () => {
    const auto = EVENT_CATALOG.filter((e) => e.kind === 'auto')
    expect(auto.map((e) => e.name).sort()).toEqual(
      ['app_exception', 'app_remove', 'app_update', 'first_open', 'notification_open',
       'notification_receive', 'os_update', 'screen_view', 'session_start', 'user_engagement'],
    )
    for (const e of auto) {
      expect(e.label).not.toBe('')
      expect(e.description).toMatch(/요\.?$/)
    }
  })
  it('finds by name and ignores inherited object keys', () => {
    expect(findEvent('first_open')?.label).toBe('처음 앱 열기')
    expect(findEvent('toString')).toBeUndefined()
    expect(findEvent('nope')).toBeUndefined()
  })
  it('defaults target platforms to both', () => {
    expect(targetPlatforms({ name: 'x', label: '', description: '', kind: 'app', params: [] })).toEqual(['Android', 'iOS'])
    expect(targetPlatforms({ name: 'x', label: '', description: '', kind: 'app', params: [], platforms: ['iOS'] })).toEqual(['iOS'])
  })
})
