import type { DateRange } from '../lib/period'
import type { ScreensModel } from '../ga/reports/screens'
import { formatNumber } from '../lib/format'
import { Card } from './Card'
import { CardState } from './CardState'
import { CsvButton } from './CsvButton'
import { DeltaText } from './Delta'

const TITLE = '많이 본 화면'
const SUBTITLE = '페이지 제목 및 화면 이름별 조회수'
const INFO = '앱에서 각 화면이 열린 횟수예요. 같은 사람이 여러 번 열면 모두 세요.'
const FOOTNOTE = '사용자가 적은 항목은 개인정보 보호를 위해 GA가 숨길 수 있어요'
const CSV_HEADERS = ['화면 이름', '조회수', '비율', '직전 기간 조회수']

const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`

type TopScreensProps = {
  query: { isPending: boolean; error: unknown; refetch(): void }
  screens: ScreensModel | undefined
  range: DateRange | undefined
}

export function TopScreens({ query, screens, range }: TopScreensProps) {
  const items = screens?.items ?? []
  const top = items[0]
  const max = top?.views.current ?? 0

  return (
    <Card
      title={TITLE}
      subtitle={SUBTITLE}
      info={INFO}
      action={
        items.length > 0 &&
        range && (
          <CsvButton
            filename={`parfait-screens-${range.startDate}_${range.endDate}.csv`}
            headers={CSV_HEADERS}
            rows={items.map((s) => [s.name, s.views.current, percent(s.ratio), s.views.previous])}
          />
        )
      }
    >
      <CardState query={query} isEmpty={screens !== undefined && items.length === 0}>
        {top && (
          <div className="adm-screens">
            <div className="adm-screens__lead">
              <p className="adm-screens__top" title={top.name}>
                #1 {top.name}
              </p>
              <p className="adm-screens__figures">
                <span className="adm-screens__value">{formatNumber(top.views.current)}</span>
                <span className="adm-screens__share">
                  전체의 <strong>{percent(top.ratio)}</strong>
                </span>
                <DeltaText delta={top.views.delta} />
              </p>
            </div>
            <ol className="adm-screens__list">
              {items.map((s, i) => (
                <li key={i} className="adm-screens__row">
                  <span className="adm-screens__name" title={s.name}>
                    {s.name}
                  </span>
                  <span className="adm-screens__views adm-num">{formatNumber(s.views.current)}</span>
                  <span className="adm-screens__delta adm-num">
                    <DeltaText delta={s.views.delta} />
                  </span>
                  <span className="adm-screens__track" aria-hidden="true">
                    <span
                      className="adm-screens__bar"
                      style={{ width: `${max === 0 ? 0 : (s.views.current / max) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ol>
            <p className="adm-table__footnote">{FOOTNOTE}</p>
          </div>
        )}
      </CardState>
    </Card>
  )
}
