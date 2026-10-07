import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Circle } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineMenu, type MenuDef } from '../menu/defineMenu'
import { buildRegistry } from '../menu/registry'
import { CommandMenu, matchesQuery } from './CommandMenu'

const def = (
  id: string,
  group: MenuDef['group'],
  order: number,
  label: string,
  extra: Partial<MenuDef> = {},
) =>
  defineMenu({
    id,
    group,
    order,
    label,
    description: label,
    icon: Circle,
    load: () => Promise.reject(new Error('not used')),
    ...extra,
  })

const dict = def('dict', 'devtools', 1, '이벤트 사전', {
  description: '이벤트 이름과 뜻을 찾아요',
  keywords: ['event', 'GA'],
})

const { groups } = buildRegistry([
  def('overview', 'metrics', 1, '한눈에 보기'),
  def('users', 'metrics', 2, '사용자'),
  dict,
  def('links', 'ops', 1, '링크 허브'),
])

/** Controlled host with an outside button that owns focus before the menu opens. */
function Host({
  initialOpen = false,
  onSelect = () => {},
  onOpenChange = () => {},
}: {
  initialOpen?: boolean
  onSelect?: (id: string) => void
  onOpenChange?: (open: boolean) => void
}): ReactElement {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <CommandMenu
        groups={groups}
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          setOpen(next)
        }}
        onSelect={onSelect}
      />
    </>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('matchesQuery', () => {
  it.each([
    ['', true],
    ['  ', true],
    ['이벤', true],
    ['사전', true],
    ['EVENT', true],
    ['ga', true],
    ['뜻을', true],
    ['링크', false],
  ])('query %j → %s', (q, expected) => expect(matchesQuery(dict, q)).toBe(expected))
})

describe('CommandMenu', () => {
  const renderMenu = (open: boolean, onOpenChange = vi.fn(), onSelect = vi.fn()) => {
    render(<CommandMenu groups={groups} open={open} onOpenChange={onOpenChange} onSelect={onSelect} />)
    return { onOpenChange, onSelect }
  }

  it('opens on Cmd+K and Ctrl+K, prevents the default, and closes on a second press', () => {
    const closed = renderMenu(false)
    const meta = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true })
    fireEvent(window, meta)
    expect(closed.onOpenChange).toHaveBeenCalledWith(true)
    expect(meta.defaultPrevented).toBe(true)

    const ctrl = new KeyboardEvent('keydown', { key: 'K', ctrlKey: true, cancelable: true })
    fireEvent(window, ctrl)
    expect(closed.onOpenChange).toHaveBeenCalledTimes(2)
    expect(ctrl.defaultPrevented).toBe(true)
  })

  it('closes on a second press when open', () => {
    const { onOpenChange } = renderMenu(true)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ignores K without a modifier', () => {
    const { onOpenChange } = renderMenu(false)
    const event = new KeyboardEvent('keydown', { key: 'k', cancelable: true })
    fireEvent(window, event)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('opens when the key is a Hangul jamo but the code is KeyK', () => {
    const { onOpenChange } = renderMenu(false)
    fireEvent.keyDown(window, { key: 'ㅏ', code: 'KeyK', metaKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('opens from a focused text input without typing into it', async () => {
    const onOpenChange = vi.fn()
    render(
      <>
        <input aria-label="바깥 입력" />
        <CommandMenu groups={groups} open={false} onOpenChange={onOpenChange} onSelect={() => {}} />
      </>,
    )
    const input = screen.getByLabelText('바깥 입력')
    input.focus()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(input).toHaveValue('')
  })

  it('lists menus under their group headings when open', () => {
    renderMenu(true)
    const dialog = screen.getByRole('dialog', { name: '빠른 이동' })
    expect(within(dialog).getByText('지표')).toBeInTheDocument()
    expect(within(dialog).getByText('개발자 도구')).toBeInTheDocument()
    expect(within(dialog).getByText('팀 운영')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('option')).toHaveLength(4)
  })

  it('filters by partial Korean input and by keyword', async () => {
    renderMenu(true)
    const input = screen.getByPlaceholderText('메뉴 이름으로 찾기')
    await userEvent.type(input, '이벤')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('이벤트 사전'),
    ])
    await userEvent.clear(input)
    await userEvent.type(input, 'ga')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option')).toHaveTextContent('이벤트 사전')
  })

  it('shows the empty message', async () => {
    renderMenu(true)
    await userEvent.type(screen.getByPlaceholderText('메뉴 이름으로 찾기'), '없는메뉴')
    expect(screen.getByText('찾는 메뉴가 없어요')).toBeInTheDocument()
  })

  it('selects with Enter and closes', async () => {
    const { onSelect, onOpenChange } = renderMenu(true)
    await userEvent.type(screen.getByPlaceholderText('메뉴 이름으로 찾기'), '링크')
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('links')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not select on Enter during IME composition', () => {
    const { onSelect } = renderMenu(true)
    const input = screen.getByPlaceholderText('메뉴 이름으로 찾기')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes on Escape and returns focus to the opener', async () => {
    const onOpenChange = vi.fn()
    render(<Host onOpenChange={onOpenChange} />)
    const opener = screen.getByRole('button', { name: '열기' })
    opener.focus()
    await userEvent.click(opener)
    await screen.findByRole('dialog', { name: '빠른 이동' })
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('does not return focus to the opener after a selection', async () => {
    const onSelect = vi.fn()
    render(<Host onSelect={onSelect} />)
    const opener = screen.getByRole('button', { name: '열기' })
    opener.focus()
    await userEvent.click(opener)
    await userEvent.click(await screen.findByRole('option', { name: /링크 허브/ }))
    expect(onSelect).toHaveBeenCalledWith('links')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).not.toHaveFocus()
  })

  it('clears the query after closing', async () => {
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: '열기' }))
    await userEvent.type(await screen.findByPlaceholderText('메뉴 이름으로 찾기'), '링크')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '열기' }))
    expect(await screen.findByPlaceholderText('메뉴 이름으로 찾기')).toHaveValue('')
  })
})
