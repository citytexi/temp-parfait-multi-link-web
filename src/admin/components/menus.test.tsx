import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Circle } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readCollapsed, writeCollapsed } from '../menu/collapsed'
import { defineMenu, type MenuDef } from '../menu/defineMenu'
import { buildRegistry } from '../menu/registry'
import { MobileMenu } from './MobileMenu'
import { SideMenu } from './SideMenu'

const def = (id: string, group: MenuDef['group'], order: number, label: string) =>
  defineMenu({
    id,
    group,
    order,
    label,
    description: label,
    icon: Circle,
    load: () => Promise.reject(new Error('not used')),
  })

const { groups } = buildRegistry([
  def('overview', 'metrics', 1, '한눈에 보기'),
  def('users', 'metrics', 2, '사용자'),
  def('dict', 'devtools', 1, '이벤트 사전'),
  def('links', 'ops', 1, '링크 허브'),
])

const labelsIn = (name: string) =>
  within(screen.getByRole('list', { name }))
    .getAllByRole('button')
    .map((b) => b.textContent)

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('SideMenu', () => {
  it('lists every group with its menus and marks the active one', () => {
    render(<SideMenu groups={groups} active="users" onSelect={() => {}} />)
    const nav = screen.getByRole('navigation', { name: '메뉴' })
    expect(within(nav).getByRole('list', { name: '지표' })).toBeInTheDocument()
    expect(labelsIn('지표')).toEqual(['한눈에 보기', '사용자'])
    expect(labelsIn('개발자 도구')).toEqual(['이벤트 사전'])
    expect(labelsIn('팀 운영')).toEqual(['링크 허브'])
    expect(screen.getByRole('button', { name: '사용자' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '한눈에 보기' })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect with the menu id', async () => {
    const onSelect = vi.fn()
    render(<SideMenu groups={groups} active="overview" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: '링크 허브' }))
    expect(onSelect).toHaveBeenCalledWith('links')
  })

  it('collapses and expands a group and persists it', async () => {
    render(<SideMenu groups={groups} active="overview" onSelect={() => {}} />)
    const head = screen.getByRole('button', { name: '개발자 도구' })
    await userEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: '개발자 도구' })).toBeNull()
    expect(readCollapsed()).toEqual(['devtools'])
    await userEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(readCollapsed()).toEqual([])
  })

  it('restores the collapsed state on mount', () => {
    writeCollapsed(['ops'])
    render(<SideMenu groups={groups} active="overview" onSelect={() => {}} />)
    expect(screen.queryByRole('list', { name: '팀 운영' })).toBeNull()
  })

  it('expands the active group on mount and on navigation, and removes it from storage', () => {
    writeCollapsed(['ops', 'devtools'])
    const { rerender } = render(<SideMenu groups={groups} active="links" onSelect={() => {}} />)
    expect(screen.getByRole('list', { name: '팀 운영' })).toBeInTheDocument()
    expect(readCollapsed()).toEqual(['devtools'])
    rerender(<SideMenu groups={groups} active="dict" onSelect={() => {}} />)
    expect(screen.getByRole('list', { name: '개발자 도구' })).toBeInTheDocument()
    expect(readCollapsed()).toEqual([])
  })

  it('lets the user collapse the active group', async () => {
    render(<SideMenu groups={groups} active="overview" onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: '지표' }))
    expect(screen.queryByRole('list', { name: '지표' })).toBeNull()
  })

  it('renders only groups that have menus', () => {
    render(<SideMenu groups={groups.filter((g) => g.id === 'metrics')} active="overview" onSelect={() => {}} />)
    expect(screen.queryByRole('button', { name: '개발자 도구' })).toBeNull()
    expect(screen.getByRole('button', { name: '지표' })).toBeInTheDocument()
  })

  it('does not write storage when the collapsed list does not change', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<SideMenu groups={groups} active="overview" onSelect={() => {}} />)
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('MobileMenu', () => {
  it('shows the tabs of the active group only', () => {
    render(<MobileMenu groups={groups} active="dict" onSelect={() => {}} />)
    expect(labelsIn('개발자 도구')).toEqual(['이벤트 사전'])
    expect(screen.queryByRole('button', { name: '한눈에 보기' })).toBeNull()
  })

  it('switches the tab list without navigating when a group is pressed', async () => {
    const onSelect = vi.fn()
    render(<MobileMenu groups={groups} active="dict" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: '지표' }))
    expect(labelsIn('지표')).toEqual(['한눈에 보기', '사용자'])
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '지표' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('follows the active menu to its group', () => {
    const { rerender } = render(<MobileMenu groups={groups} active="overview" onSelect={() => {}} />)
    rerender(<MobileMenu groups={groups} active="links" onSelect={() => {}} />)
    expect(screen.getByRole('list', { name: '팀 운영' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '팀 운영' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides the group switch when there is one group', () => {
    render(<MobileMenu groups={groups.filter((g) => g.id === 'metrics')} active="overview" onSelect={() => {}} />)
    expect(screen.queryByRole('group', { name: '메뉴 그룹' })).toBeNull()
  })

  it('scrolls the active tab into view', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<MobileMenu groups={groups} active="users" onSelect={() => {}} />)
    expect(spy).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
  })
})
