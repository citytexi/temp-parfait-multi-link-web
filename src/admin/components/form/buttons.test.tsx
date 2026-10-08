import { StrictMode } from 'react'
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusRegion } from './StatusRegion'
import { CopyButton } from './CopyButton'
import { ConfirmButton } from './ConfirmButton'

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const flush = () => act(async () => { await Promise.resolve() })

function setClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CopyButton', () => {
  it('copies, shows 복사했어요 for 2 seconds and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    render(<StatusRegion><CopyButton label="링크 복사" text="abc" /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(writeText).toHaveBeenCalledWith('abc')
    expect(screen.getByRole('button')).toHaveTextContent('복사했어요')
    expect(screen.getByRole('status')).toHaveTextContent('복사했어요')
    advance(1999)
    expect(screen.getByRole('button')).toHaveTextContent('복사했어요')
    advance(1)
    expect(screen.getByRole('button')).toHaveTextContent('링크 복사')
  })

  it('restarts the timing when pressed again', async () => {
    setClipboard(vi.fn().mockResolvedValue(undefined))
    render(<StatusRegion><CopyButton label="링크 복사" text="abc" /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    advance(1500)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    advance(1999)
    expect(screen.getByRole('button')).toHaveTextContent('복사했어요')
    advance(1)
    expect(screen.getByRole('button')).toHaveTextContent('링크 복사')
  })

  it('reads a text function at click time and calls onCopy once per click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    let current = 'one'
    const onCopy = vi.fn()
    render(<StatusRegion><CopyButton label="복사" text={() => current} onCopy={onCopy} /></StatusRegion>)
    current = 'two'
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(writeText).toHaveBeenCalledWith('two')
    expect(onCopy).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(onCopy).toHaveBeenCalledTimes(2)
  })

  it('keeps the accessible name when one is given', () => {
    setClipboard(vi.fn().mockResolvedValue(undefined))
    render(<StatusRegion><CopyButton label="복사" name="Google Play에서 다운로드 주소 복사" text="abc" /></StatusRegion>)
    expect(screen.getByRole('button', { name: 'Google Play에서 다운로드 주소 복사' })).toBeInTheDocument()
  })

  it('shows a selected read-only text box when the clipboard is missing', async () => {
    const onCopy = vi.fn()
    render(<StatusRegion><CopyButton label="복사" text="abc" onCopy={onCopy} /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    const box = screen.getByLabelText('복사할 내용') as HTMLTextAreaElement
    expect(box.value).toBe('abc')
    expect(box.readOnly).toBe(true)
    expect(box.selectionStart).toBe(0)
    expect(box.selectionEnd).toBe(3)
    expect(screen.getAllByText('복사하지 못했어요. 아래 내용을 직접 복사해 주세요.').length).toBeGreaterThan(0)
    expect(screen.getByRole('status')).toHaveTextContent('복사하지 못했어요. 아래 내용을 직접 복사해 주세요.')
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('shows the text box when writeText rejects, and removes it after a later success', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
    setClipboard(writeText)
    const onCopy = vi.fn()
    render(<StatusRegion><CopyButton label="복사" text="abc" onCopy={onCopy} /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(screen.getByLabelText('복사할 내용')).toBeInTheDocument()
    expect(onCopy).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(screen.queryByLabelText('복사할 내용')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('복사했어요')
  })

  it('clears its timer on unmount and runs one under StrictMode', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    setClipboard(vi.fn().mockResolvedValue(undefined))
    const first = render(<StatusRegion><CopyButton label="복사" text="abc" /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    first.unmount()
    expect(vi.getTimerCount()).toBe(0)
    advance(5000)

    render(<StrictMode><StatusRegion><CopyButton label="링크 복사" text="abc" /></StatusRegion></StrictMode>)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(vi.getTimerCount()).toBe(1)
    advance(2000)
    expect(screen.getByRole('button')).toHaveTextContent('링크 복사')
    expect(error).not.toHaveBeenCalled()
  })
})

describe('CopyButton late and throwing results', () => {
  it('ignores a clipboard result that settles after unmount', async () => {
    let resolve!: () => void
    setClipboard(vi.fn(() => new Promise<void>((r) => { resolve = r })))
    const view = render(<StatusRegion><CopyButton label="복사" text="abc" /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    view.unmount()
    resolve()
    await flush()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores an older click that rejects after a newer one succeeded', async () => {
    let reject!: (e: Error) => void
    const writeText = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((_, r) => { reject = r }))
      .mockResolvedValue(undefined)
    setClipboard(writeText)
    render(<StatusRegion><CopyButton label="복사" text="abc" /></StatusRegion>)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    await flush()
    reject(new Error('slow'))
    await flush()
    expect(screen.getByRole('button')).toHaveTextContent('복사했어요')
    expect(screen.queryByLabelText('복사할 내용')).not.toBeInTheDocument()
  })

  it('takes the fallback path when text() throws, without a text box', async () => {
    setClipboard(vi.fn().mockResolvedValue(undefined))
    const onCopy = vi.fn()
    render(
      <StatusRegion>
        <CopyButton label="복사" text={() => { throw new Error('boom') }} onCopy={onCopy} />
      </StatusRegion>,
    )
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('복사하지 못했어요. 아래 내용을 직접 복사해 주세요.').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('복사할 내용')).not.toBeInTheDocument()
  })
})

describe('ConfirmButton', () => {
  function setup(extra: { name?: string } = {}) {
    const onConfirm = vi.fn()
    render(
      <StatusRegion>
        <ConfirmButton label="기록 지우기" confirmLabel="정말 지울까요?" onConfirm={onConfirm} {...extra} />
      </StatusRegion>,
    )
    return { onConfirm, button: () => screen.getByRole('button') }
  }

  it('asks first and runs on the second press after the guard', () => {
    const { onConfirm, button } = setup()
    fireEvent.click(button())
    expect(button()).toHaveTextContent('정말 지울까요?')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('정말 지울까요?')
    advance(400)
    fireEvent.click(button())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(button()).toHaveTextContent('기록 지우기')
  })

  it('ignores a second press inside 400ms', () => {
    const { onConfirm, button } = setup()
    fireEvent.click(button())
    advance(399)
    fireEvent.click(button())
    expect(onConfirm).not.toHaveBeenCalled()
    expect(button()).toHaveTextContent('정말 지울까요?')
    advance(1)
    fireEvent.click(button())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not time out', () => {
    const { button } = setup()
    fireEvent.click(button())
    advance(10 * 60 * 1000)
    expect(button()).toHaveTextContent('정말 지울까요?')
  })

  it('disarms on Escape and on blur', () => {
    const { onConfirm, button } = setup()
    fireEvent.click(button())
    fireEvent.keyDown(button(), { key: 'Escape' })
    expect(button()).toHaveTextContent('기록 지우기')
    expect(screen.getByRole('status')).toHaveTextContent('취소했어요')
    fireEvent.click(button())
    advance(400)
    fireEvent.blur(button())
    expect(button()).toHaveTextContent('기록 지우기')
    fireEvent.click(button())
    expect(onConfirm).not.toHaveBeenCalled()
    expect(button()).toHaveTextContent('정말 지울까요?')
  })

  it('takes focus on the first press', () => {
    const { button } = setup()
    fireEvent.click(button())
    expect(document.activeElement).toBe(button())
  })

  it('uses the name only while idle', () => {
    const { button } = setup({ name: '내 링크 Figma 삭제' })
    expect(screen.getByRole('button', { name: '내 링크 Figma 삭제' })).toBeInTheDocument()
    fireEvent.click(button())
    expect(screen.getByRole('button', { name: '정말 지울까요?' })).toBeInTheDocument()
  })

  it('swallows held Enter repeats but not a fresh Enter', () => {
    const { onConfirm, button } = setup()
    fireEvent.click(button())
    advance(500)
    const repeat = createEvent.keyDown(button(), { key: 'Enter', repeat: true })
    fireEvent(button(), repeat)
    expect(repeat.defaultPrevented).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
    const fresh = createEvent.keyDown(button(), { key: 'Enter' })
    fireEvent(button(), fresh)
    expect(fresh.defaultPrevented).toBe(false)
  })

  it('stops Escape propagation only while armed', () => {
    const parent = vi.fn()
    render(
      <StatusRegion>
        <div onKeyDown={parent}>
          <ConfirmButton label="기록 지우기" confirmLabel="정말 지울까요?" onConfirm={() => {}} />
        </div>
      </StatusRegion>,
    )
    const b = screen.getByRole('button')
    const idle = createEvent.keyDown(b, { key: 'Escape' })
    fireEvent(b, idle)
    expect(parent).toHaveBeenCalledTimes(1)
    expect(idle.defaultPrevented).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('')
    fireEvent.click(b)
    fireEvent.keyDown(b, { key: 'Escape' })
    expect(parent).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('취소했어요')
  })
})
