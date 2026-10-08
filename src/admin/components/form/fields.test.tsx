import { StrictMode, createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatusRegion, useAnnounce } from './StatusRegion'
import { TextField } from './TextField'
import { SelectField } from './SelectField'
import { CheckboxField } from './CheckboxField'
import { NotSavedNote } from './NotSavedNote'

function Probe({ message }: { message: string }) {
  const announce = useAnnounce()
  return <button onClick={() => announce(message)}>알리기</button>
}

describe('StatusRegion', () => {
  it('renders an empty status region from the start and writes announcements into it', () => {
    render(
      <StatusRegion>
        <Probe message="복사했어요" />
      </StatusRegion>,
    )
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')
    fireEvent.click(screen.getByText('알리기'))
    expect(region).toHaveTextContent('복사했어요')
  })

  it('changes the text when the same message is announced twice', () => {
    render(
      <StatusRegion>
        <Probe message="a" />
      </StatusRegion>,
    )
    const region = screen.getByRole('status')
    fireEvent.click(screen.getByText('알리기'))
    expect(region.textContent).toBe('a')
    const first = region.firstChild
    fireEvent.click(screen.getByText('알리기'))
    expect(region.textContent).not.toBe('a')
    expect(region).toHaveTextContent('a')
    expect(region.firstChild).not.toBe(first)
  })

  it('gives a no-op announcer outside a region', () => {
    let announce: (m: string) => void = () => {}
    function Grab() {
      announce = useAnnounce()
      return null
    }
    render(<Grab />)
    expect(() => act(() => announce('x'))).not.toThrow()
  })
})

describe('TextField', () => {
  it('labels the input and reports changes as strings', () => {
    const onChange = vi.fn()
    render(<TextField label="캠페인 이름" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('캠페인 이름'), { target: { value: 'a' } })
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('connects help and error and marks the input invalid', () => {
    const { rerender } = render(
      <TextField label="이름" value="" onChange={() => {}} help="예: 202610-launch" error="영문 소문자만" />,
    )
    const input = screen.getByLabelText('이름')
    expect(input).toHaveAccessibleDescription('예: 202610-launch 영문 소문자만')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    rerender(<TextField label="이름" value="" onChange={() => {}} help="예: 202610-launch" error={null} />)
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription('예: 202610-launch')

    rerender(<TextField label="이름" value="" onChange={() => {}} />)
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('passes input attributes and the ref through', () => {
    const ref = createRef<HTMLInputElement>()
    const onBlur = vi.fn()
    render(
      <TextField
        label="주소"
        value=""
        onChange={() => {}}
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        onBlur={onBlur}
        ref={ref}
      />,
    )
    const input = screen.getByLabelText('주소')
    expect(input).toHaveAttribute('inputmode', 'url')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('spellcheck', 'false')
    fireEvent.blur(input)
    expect(onBlur).toHaveBeenCalled()
    expect(ref.current).toBe(input)
  })
})

describe('TextField className', () => {
  it('is refused by the type, because the field sets its own class', () => {
    // @ts-expect-error a className would be dropped without a word
    render(<TextField label="이름" value="" onChange={() => {}} className="mine" />)
    expect(screen.getByLabelText('이름').className).toBe('adm-field__input')
  })
})

describe('SelectField', () => {
  it('renders a select with a placeholder option and reports the picked value', () => {
    const onChange = vi.fn()
    render(
      <SelectField
        label="채널"
        value=""
        placeholder="골라 주세요"
        options={[
          { value: 'instagram', label: '인스타그램' },
          { value: 'kakao', label: '카카오' },
        ]}
        onChange={onChange}
      />,
    )
    const select = screen.getByLabelText('채널')
    const options = select.querySelectorAll('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveValue('')
    expect(options[0]).toHaveTextContent('골라 주세요')
    fireEvent.change(select, { target: { value: 'instagram' } })
    expect(onChange).toHaveBeenCalledWith('instagram')
  })
})

describe('CheckboxField', () => {
  it('toggles a checkbox from its label', () => {
    const onChange = vi.fn()
    render(<CheckboxField label="Android" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByText('Android'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('NotSavedNote', () => {
  const NOT_SAVED = '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
  const note = (persisted: boolean) => (
    <StatusRegion>
      <NotSavedNote persisted={persisted} />
    </StatusRegion>
  )
  const onPage = () => screen.queryByText(NOT_SAVED, { selector: 'p' })

  it('shows the sentence and announces it once when persisted turns false', () => {
    const { rerender } = render(note(true))
    const region = screen.getByRole('status')
    expect(onPage()).toBeNull()
    expect(region.textContent).toBe('')

    rerender(note(false))
    expect(onPage()).toBeInTheDocument()
    expect(region.textContent).toBe(NOT_SAVED)
    const first = region.firstChild
    rerender(note(false))
    rerender(note(false))
    // Every announcement draws a new node, so the same node means nothing was announced again.
    expect(region.firstChild).toBe(first)

    rerender(note(true))
    expect(onPage()).toBeNull()
    expect(region.firstChild).toBe(first)
    rerender(note(false))
    expect(onPage()).toBeInTheDocument()
    expect(region.firstChild).not.toBe(first)
    expect(region).toHaveTextContent(NOT_SAVED)
  })

  it('shows the sentence without announcing when it starts unsaved', () => {
    render(note(false))
    expect(onPage()).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('announces once under StrictMode', () => {
    const { rerender } = render(<StrictMode>{note(true)}</StrictMode>)
    rerender(<StrictMode>{note(false)}</StrictMode>)
    // A second announcement of the same text would carry a trailing no-break space.
    expect(screen.getByRole('status').textContent).toBe(NOT_SAVED)
  })

  it('renders outside a status region', () => {
    const { rerender } = render(<NotSavedNote persisted />)
    rerender(<NotSavedNote persisted={false} />)
    expect(onPage()).toBeInTheDocument()
  })
})
