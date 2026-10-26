import type { CSSProperties } from 'react'
import { Card } from '../components/Card'
import { CardState } from '../components/CardState'
import { CsvButton } from '../components/CsvButton'
import { StatSlot } from '../components/StatCard'
import type { RetentionCohort } from '../ga/reports/retention'
import { useGa } from '../hooks/useGa'
import { cardQuery, useEngagement, useRetention } from '../hooks/useReports'
import { formatDuration } from '../lib/format'

const NOTE = '기간 필터와 관계없이 최근 4주 기준이에요.'
const TABLE_TITLE = '주별로 다시 찾아온 비율'
const TABLE_INFO = '그 주에 처음 온 사람 중 몇 %가 그 뒤 주에도 앱을 썼는지 보여줘요.'
const FOOTNOTE = '— 는 아직 지나지 않은 주예요.'
const INFO_VISITS = '이 기간에 한 사람이 앱을 평균 몇 번 열었는지예요.'
const INFO_AVG = '앱이 화면에 떠 있던 시간을 사람 수로 나눈 값이에요.'
const WEEK_HEADERS = ['첫 주', '1주 후', '2주 후', '3주 후', '4주 후']
const NOT_YET = '—'
/** Strongest tint (at 100%). Keeps --adm-text-1 at ≥ 6.9:1 in both themes (tokens.css). */
const MAX_TINT = 40

const visitsFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`

function RetentionCell({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <td className="adm-num adm-heat adm-heat--none">{NOT_YET}</td>
  const style = { '--adm-heat': `${Math.round(Math.min(ratio, 1) * MAX_TINT)}%` } as CSSProperties
  return (
    <td className="adm-num adm-heat" style={style}>
      {percent(ratio)}
    </td>
  )
}

function RetentionTable({ cohorts }: { cohorts: RetentionCohort[] }) {
  return (
    <div className="adm-table">
      <div className="adm-table__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">처음 온 주</th>
              {WEEK_HEADERS.map((header) => (
                <th key={header} scope="col" className="adm-num">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.label}>
                <th scope="row">{cohort.label}</th>
                {cohort.weeks.map((ratio, n) => (
                  <RetentionCell key={n} ratio={ratio} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="adm-table__footnote">{FOOTNOTE}</p>
    </div>
  )
}

export function RetentionPage() {
  const { today } = useGa()
  const retention = useRetention()
  const engagement = useEngagement()
  const cohorts = retention.data?.cohorts ?? []
  const isEmpty = retention.data !== undefined && cohorts.every((c) => c.size === 0)

  return (
    <>
      <p className="adm-page__note">{NOTE}</p>
      <div className="adm-grid adm-grid--stats">
        <StatSlot
          query={engagement}
          title="한 사람당 방문 횟수"
          subtitle="세션/사용자"
          info={INFO_VISITS}
          value={(d) => `${visitsFormat.format(d.sessionsPerUser.current)}회`}
          delta={(d) => d.sessionsPerUser.delta}
        />
        <StatSlot
          query={engagement}
          title="한 사람당 평균 이용 시간"
          subtitle="평균 참여 시간"
          info={INFO_AVG}
          value={(d) => formatDuration(d.avgEngagementSec.current)}
          delta={(d) => d.avgEngagementSec.delta}
        />
      </div>
      <Card
        title={TABLE_TITLE}
        subtitle="코호트 리텐션"
        info={TABLE_INFO}
        action={
          !isEmpty &&
          cohorts.length > 0 && (
            <CsvButton
              filename={`parfait-retention-${today}.csv`}
              headers={['처음 온 주', ...WEEK_HEADERS]}
              rows={cohorts.map((c) => [c.label, ...c.weeks.map((r) => (r === null ? NOT_YET : percent(r)))])}
            />
          )
        }
      >
        <CardState query={cardQuery(retention)} isEmpty={isEmpty}>
          <RetentionTable cohorts={cohorts} />
        </CardState>
      </Card>
    </>
  )
}
