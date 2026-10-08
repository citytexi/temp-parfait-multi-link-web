import type { ReactElement } from 'react'
import { Card } from '../../../components/Card'
import { ConfirmButton } from '../../../components/form/ConfirmButton'
import { recentTitle, type RecentLink } from './link'

const dayFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })

/** createdAt comes from storage and may be any string; one that is not a date shows nothing. */
function formatDay(createdAt: string): string {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : dayFormat.format(date)
}

export function RecentLinks({
  items,
  onReopen,
  onClear,
  persisted,
}: {
  items: readonly RecentLink[]
  onReopen(item: RecentLink): void
  onClear(): void
  persisted: boolean
}): ReactElement {
  return (
    <Card
      title="최근 만든 링크"
      action={
        items.length > 0 ? (
          <ConfirmButton label="기록 지우기" confirmLabel="정말 지울까요?" onConfirm={onClear} />
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <p className="adm-utm-builder-text">아직 만든 링크가 없어요</p>
      ) : (
        <ul className="adm-utm-builder-recent">
          {items.map((item, index) => {
            const title = recentTitle(item)
            return (
              // Keyed by position: hand-edited storage may hold the same link twice.
              <li key={index} className="adm-utm-builder-recent__row">
                <span className="adm-utm-builder-recent__title">{title}</span>
                <span className="adm-utm-builder-recent__day">{formatDay(item.createdAt)}</span>
                <button
                  type="button"
                  className="adm-button adm-button--ghost adm-utm-builder-recent__open"
                  aria-label={`${title} 다시 열기`}
                  onClick={() => onReopen(item)}
                >
                  다시 열기
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!persisted && (
        <p className="adm-utm-builder-text adm-utm-builder-text--warn">
          이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.
        </p>
      )}
    </Card>
  )
}
