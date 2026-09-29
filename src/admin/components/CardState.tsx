import type { ReactNode } from 'react'
import { GaError } from '../ga/errors'

type CardStateProps = {
  query: { isPending: boolean; error: unknown; refetch(): void }
  isEmpty: boolean
  children: ReactNode
}

const QUOTA_MESSAGE = '오늘 조회 한도를 다 썼어요. 한 시간 뒤나 내일 다시 시도해 주세요.'
const GENERIC_MESSAGE = '불러오지 못했어요'
const EMPTY_MESSAGE = '이 기간에는 데이터가 없어요'

export function CardState({ query, isEmpty, children }: CardStateProps) {
  const { error } = query

  if (error) {
    // auth/forbidden are handled by the app shell, not per card.
    if (error instanceof GaError && (error.kind === 'auth' || error.kind === 'forbidden')) return null
    const message = error instanceof GaError && error.kind === 'quota' ? QUOTA_MESSAGE : GENERIC_MESSAGE
    return (
      <div className="adm-state adm-state--error" role="alert">
        <p className="adm-state__text">{message}</p>
        <button type="button" className="adm-button adm-button--secondary" onClick={() => query.refetch()}>
          다시 시도
        </button>
      </div>
    )
  }

  if (query.isPending) {
    return (
      <div className="adm-state adm-skeleton" role="status" aria-label="불러오는 중">
        <span className="adm-skeleton__bar adm-skeleton__bar--wide" />
        <span className="adm-skeleton__bar" />
        <span className="adm-skeleton__bar adm-skeleton__bar--short" />
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="adm-state adm-state--empty">
        <p className="adm-state__text">{EMPTY_MESSAGE}</p>
      </div>
    )
  }

  return <>{children}</>
}
