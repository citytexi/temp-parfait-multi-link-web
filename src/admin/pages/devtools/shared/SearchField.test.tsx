import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEARCH_COMMIT_DELAY_MS, SearchField } from './SearchField'

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

function setup(value: string | null = null) {
  const onCommit = vi.fn()
  const view = render(<SearchField label="이벤트 검색" value={value} onCommit={onCommit} />)
  const input = screen.getByLabelText('이벤트 검색') as HTMLInputElement
  const type = (text: string) => fireEvent.change(input, { target: { value: text } })
  const rerender = (next: string | null) =>
    view.rerender(<SearchField label="이벤트 검색" value={next} onCommit={onCommit} />)
  return { onCommit, input, type, rerender, unmount: view.unmount }
}

describe('SearchField', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('commits 300ms after the last keystroke, once', () => {
    const { onCommit, type } = setup()
    type('a')
    advance(100)
    type('ab')
    advance(100)
    type('abc')
    advance(SEARCH_COMMIT_DELAY_MS - 1)
    expect(onCommit).not.toHaveBeenCalled()
    advance(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('abc')
    advance(1000)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('commits at once on Enter and on blur, and not again when the timer fires', () => {
    const { onCommit, input, type } = setup()
    type('abc')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenLastCalledWith('abc')
    advance(1000)
    expect(onCommit).toHaveBeenCalledTimes(1)

    type('abcd')
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenLastCalledWith('abcd')
    advance(1000)
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('commits null for an empty box', () => {
    const { onCommit, type } = setup('abc')
    type('')
    advance(SEARCH_COMMIT_DELAY_MS)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(null)
  })

  it('does not commit during IME composition, then commits after it ends', () => {
    const { onCommit, input, type } = setup()
    fireEvent.compositionStart(input)
    type('ㅎ')
    advance(500)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    type('한')
    advance(SEARCH_COMMIT_DELAY_MS - 1)
    expect(onCommit).not.toHaveBeenCalled()
    advance(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('한')
  })

  it('takes an external value change', () => {
    const { onCommit, input, rerender } = setup('a')
    expect(input.value).toBe('a')
    rerender('b')
    expect(input.value).toBe('b')
    advance(1000)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps what the user is typing when the parent echoes the committed value', () => {
    const { onCommit, input, type, rerender } = setup()
    type('ab')
    advance(SEARCH_COMMIT_DELAY_MS)
    expect(onCommit).toHaveBeenCalledWith('ab')
    type('abc')
    rerender('ab')
    expect(input.value).toBe('abc')
    advance(SEARCH_COMMIT_DELAY_MS)
    expect(onCommit).toHaveBeenLastCalledWith('abc')
  })

  it('clears its timer on unmount', () => {
    const { onCommit, type, unmount } = setup()
    type('abc')
    unmount()
    advance(1000)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('has a visible label', () => {
    setup()
    expect(screen.getByLabelText('이벤트 검색')).toHaveAttribute('type', 'search')
    expect(screen.getByText('이벤트 검색')).toBeVisible()
  })
})
