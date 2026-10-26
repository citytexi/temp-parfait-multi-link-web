import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useState, type ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusRequest } from './useFocusRequest'

function Probe({ ready = true }: { ready?: boolean }): ReactElement {
  const [rows, setRows] = useState<string[]>([])
  const focus = useFocusRequest<string>((id) => document.getElementById(id), ready)
  return (
    <>
      <button
        onClick={() => {
          setRows((prev) => [...prev, `row-${prev.length}`])
          focus(`row-${rows.length}`)
        }}
      >
        추가
      </button>
      <button onClick={() => focus('row-0')}>첫 줄로</button>
      <button onClick={() => focus('nowhere')}>없는 곳으로</button>
      {rows.map((id) => (
        <button key={id} id={id}>
          {id}
        </button>
      ))}
    </>
  )
}

const press = (name: string) => {
  const target = screen.getByRole('button', { name })
  target.focus()
  fireEvent.click(target)
}

describe('useFocusRequest', () => {
  it('focuses an element the same render adds', () => {
    render(<Probe />)
    press('추가')
    expect(screen.getByRole('button', { name: 'row-0' })).toHaveFocus()
  })

  it('runs again for the same target', () => {
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    )
    press('추가')
    press('첫 줄로')
    expect(screen.getByRole('button', { name: 'row-0' })).toHaveFocus()
    act(() => screen.getByRole('button', { name: '추가' }).focus())
    press('첫 줄로')
    expect(screen.getByRole('button', { name: 'row-0' })).toHaveFocus()
  })

  it('leaves focus alone when there is nothing to focus', () => {
    render(<Probe />)
    press('없는 곳으로')
    expect(screen.getByRole('button', { name: '없는 곳으로' })).toHaveFocus()
  })

  it('waits until it is ready, then runs once', () => {
    const { rerender } = render(<Probe ready={false} />)
    press('추가')
    expect(screen.getByRole('button', { name: '추가' })).toHaveFocus()
    rerender(<Probe />)
    expect(screen.getByRole('button', { name: 'row-0' })).toHaveFocus()

    act(() => screen.getByRole('button', { name: '추가' }).focus())
    rerender(<Probe ready={false} />)
    rerender(<Probe />)
    expect(screen.getByRole('button', { name: '추가' })).toHaveFocus()
  })
})
