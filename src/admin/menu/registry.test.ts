import { Circle } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { defineMenu, type GroupId, type MenuDef } from './defineMenu'
import { buildRegistry, REGISTRY } from './registry'

const def = (o: Partial<MenuDef>) =>
  defineMenu({ id: 'x', group: 'metrics', order: 10, label: 'X', description: '', icon: Circle, load: async () => ({ default: () => null }), ...o })

describe('menu registry', () => {
  it('sorts by group order, then order, then id', () => {
    const r = buildRegistry([
      def({ id: 'b', group: 'ops', order: 100 }),
      def({ id: 'z', group: 'metrics', order: 20 }),
      def({ id: 'c', group: 'metrics', order: 20 }),
      def({ id: 'a', group: 'devtools', order: 100 }),
      def({ id: 'm', group: 'metrics', order: 10 }),
    ], 'm')
    expect(r.menus.map((m) => m.id)).toEqual(['m', 'c', 'z', 'a', 'b'])
  })
  it('omits groups that have no menus', () => {
    const r = buildRegistry([def({ id: 'm' })], 'm')
    expect(r.groups.map((g) => g.id)).toEqual(['metrics'])
    expect(r.groups[0].label).toBe('지표')
  })
  it('throws on a duplicate id and names it', () => {
    expect(() => buildRegistry([def({ id: 'dup' }), def({ id: 'dup', group: 'ops' })])).toThrow(/dup/)
  })
  it('throws on an unknown group', () => {
    expect(() => buildRegistry([def({ group: 'nope' as GroupId })])).toThrow(/nope/)
  })
  it('does not throw when two menus share an order', () => {
    expect(() => buildRegistry([def({ id: 'a' }), def({ id: 'b' })], 'a')).not.toThrow()
  })
  it('throws when the default menu is not one of the menus and names it', () => {
    expect(() => buildRegistry([def({ id: 'a' })], 'missing')).toThrow(/missing/)
    expect(() => buildRegistry([def({ id: 'a' })])).toThrow(/overview/)
  })
  it('does not throw for an empty list', () => {
    expect(() => buildRegistry([])).not.toThrow()
    expect(buildRegistry([]).menus).toEqual([])
  })
  it('lookup answers isMenu, usesPeriod and defaultMenu', () => {
    const r = buildRegistry([def({ id: 'p', usesPeriod: true }), def({ id: 'q' })], 'p')
    expect(r.lookup.defaultMenu).toBe('p')
    expect(r.lookup.isMenu('p')).toBe(true)
    expect(r.lookup.isMenu('nope')).toBe(false)
    expect(r.lookup.usesPeriod('p')).toBe(true)
    expect(r.lookup.usesPeriod('q')).toBe(false)
    expect(r.lookup.usesPeriod('nope')).toBe(false)
  })
  it('the real registry holds the six metrics menus with the spec values', () => {
    expect(REGISTRY.groups.find((g) => g.id === 'metrics')!.menus.map((m) => [m.id, m.label, m.order, !!m.usesPeriod, !!m.usesGa])).toEqual([
      ['overview', '한눈에 보기', 10, true, true],
      ['users', '사용자', 20, true, true],
      ['events', '많이 한 행동', 30, true, true],
      ['retention', '다시 찾아온 사람', 40, true, true],
      ['tech', '기기·지역', 50, true, true],
      ['realtime', '지금 접속 중', 60, false, true],
    ])
    expect(REGISTRY.lookup.defaultMenu).toBe('overview')
  })
})
