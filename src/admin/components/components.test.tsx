import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../ga/errors'
import { downloadCsv } from '../lib/csv'
import { CardState } from './CardState'
import { CsvButton } from './CsvButton'
import { DeltaText } from './Delta'
import { InfoTip } from './InfoTip'

vi.mock('../lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/csv')>()
  return { ...actual, downloadCsv: vi.fn() }
})

function query(over: Partial<{ isPending: boolean; error: unknown; refetch: () => void }> = {}) {
  return { isPending: false, error: null, refetch: vi.fn(), ...over }
}

describe('DeltaText', () => {
  it('renders the delta text as is', () => {
    render(<DeltaText delta={{ ratio: 0.12, text: '▲ 12%', tone: 'up' }} />)
    expect(screen.getByText('▲ 12%')).toBeInTheDocument()
  })
})

describe('InfoTip', () => {
  it('shows the text on focus and hides it on Escape', async () => {
    const user = userEvent.setup()
    render(<InfoTip text="하루 동안 방문한 사람 수예요" />)
    const button = screen.getByRole('button', { name: '설명 보기' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.tab()
    expect(button).toHaveFocus()
    const tip = screen.getByRole('tooltip')
    expect(tip).toBeVisible()
    expect(tip).toHaveTextContent('하루 동안 방문한 사람 수예요')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-describedby', tip.id)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on click', async () => {
    const user = userEvent.setup()
    render(<InfoTip text="설명" />)
    const button = screen.getByRole('button', { name: '설명 보기' })
    await user.click(button)
    expect(screen.getByRole('tooltip')).toBeVisible()
  })
})

describe('CardState', () => {
  it('shows the quota message', () => {
    render(
      <CardState query={query({ error: new GaError('quota') })} isEmpty={false}>
        <p>내용</p>
      </CardState>,
    )
    expect(
      screen.getByText('오늘 조회 한도를 다 썼어요. 한 시간 뒤나 내일 다시 시도해 주세요.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('내용')).not.toBeInTheDocument()
  })

  it('shows a generic error with a retry button that calls refetch', async () => {
    const user = userEvent.setup()
    const q = query({ error: new GaError('server') })
    render(
      <CardState query={q} isEmpty={false}>
        <p>내용</p>
      </CardState>,
    )
    expect(screen.getByText('불러오지 못했어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(q.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty message', () => {
    render(
      <CardState query={query()} isEmpty>
        <p>내용</p>
      </CardState>,
    )
    expect(screen.getByText('이 기간에는 데이터가 없어요')).toBeInTheDocument()
    expect(screen.queryByText('내용')).not.toBeInTheDocument()
  })

  it('renders nothing for auth and forbidden errors', () => {
    const { container, rerender } = render(
      <CardState query={query({ error: new GaError('auth') })} isEmpty={false}>
        <p>내용</p>
      </CardState>,
    )
    expect(container).toBeEmptyDOMElement()
    rerender(
      <CardState query={query({ error: new GaError('forbidden') })} isEmpty={false}>
        <p>내용</p>
      </CardState>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a loading skeleton while pending, then children', () => {
    const { rerender } = render(
      <CardState query={query({ isPending: true })} isEmpty={false}>
        <p>내용</p>
      </CardState>,
    )
    expect(screen.getByRole('status')).toHaveAccessibleName('불러오는 중')
    expect(screen.queryByText('내용')).not.toBeInTheDocument()
    rerender(
      <CardState query={query()} isEmpty={false}>
        <p>내용</p>
      </CardState>,
    )
    expect(screen.getByText('내용')).toBeInTheDocument()
  })
})

describe('CsvButton', () => {
  beforeEach(() => vi.mocked(downloadCsv).mockClear())

  it('downloads a BOM-prefixed csv on click', async () => {
    const user = userEvent.setup()
    render(<CsvButton filename="dau.csv" headers={['날짜', '방문자']} rows={[['2026-09-28', 120]]} />)
    await user.click(screen.getByRole('button', { name: 'CSV 받기' }))
    expect(downloadCsv).toHaveBeenCalledWith('dau.csv', '\uFEFF날짜,방문자\r\n2026-09-28,120')
  })
})
