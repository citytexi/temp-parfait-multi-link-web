import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { Card } from '../components/Card'
import { CardState } from '../components/CardState'
import { ChartFrame, chartTheme } from '../components/ChartFrame'
import { CsvButton } from '../components/CsvButton'
import { DataTable } from '../components/DataTable'
import type { Share } from '../ga/reports/tech'
import { useGa } from '../hooks/useGa'
import { cardQuery, useTech } from '../hooks/useReports'
import { formatNumber } from '../lib/format'

const PLATFORM_TITLE = 'Android와 iOS 비율'
const COUNTRY_TITLE = '많이 쓰는 국가 Top 10'
const VERSION_TITLE = '앱 버전별 사람 수'
// Series tokens (each >= 3:1 vs the card surface in both themes, see tokens.css).
// Slices past the fifth cycle through series 2-5 so the accent is never reused.
// The legend always carries the label and share as text.
const SLICE_COLORS = [
  'var(--adm-series-1)',
  'var(--adm-series-2)',
  'var(--adm-series-3)',
  'var(--adm-series-4)',
  'var(--adm-series-5)',
]

const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`
const sliceColor = (i: number): string =>
  i < SLICE_COLORS.length ? SLICE_COLORS[i] : SLICE_COLORS[1 + ((i - 1) % (SLICE_COLORS.length - 1))]

function donutLabel(platforms: Share[]): string {
  if (platforms.length === 0) return `${PLATFORM_TITLE} 도넛 차트`
  return `${PLATFORM_TITLE} 도넛 차트. ${platforms.map((p) => `${p.label} ${percent(p.ratio)}`).join(', ')}`
}

function ShareTable({
  title,
  subtitle,
  labelHeader,
  file,
  shares,
  query,
}: {
  title: string
  subtitle: string
  labelHeader: string
  file: string
  shares: Share[] | undefined
  query: ReturnType<typeof cardQuery>
}) {
  const { ranges } = useGa()
  const columns = [
    { key: 'label', header: labelHeader },
    { key: 'users', header: '사람 수', align: 'right' as const },
    { key: 'ratio', header: '비율', align: 'right' as const },
  ]
  const list = shares ?? []

  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        list.length > 0 &&
        ranges && (
          <CsvButton
            filename={`parfait-${file}-${ranges.current.startDate}_${ranges.current.endDate}.csv`}
            headers={columns.map((c) => c.header)}
            rows={list.map((s) => [s.label, s.users, percent(s.ratio)])}
          />
        )
      }
    >
      <CardState query={query} isEmpty={shares !== undefined && list.length === 0}>
        <DataTable
          columns={columns}
          rows={list.map((s) => ({ label: s.label, users: formatNumber(s.users), ratio: percent(s.ratio) }))}
        />
      </CardState>
    </Card>
  )
}

export function TechPage() {
  const tech = useTech()
  const data = tech.data
  const query = cardQuery(tech)
  const platforms = data?.platforms ?? []

  return (
    <>
      <div className="adm-grid">
        <Card title={PLATFORM_TITLE} subtitle="platform">
          <CardState query={query} isEmpty={data !== undefined && platforms.length === 0}>
            <div className="adm-donut">
              <ChartFrame label={donutLabel(platforms)} height={220}>
                <PieChart accessibilityLayer={false}>
                  <Tooltip {...chartTheme.tooltip} formatter={(v, name) => [`${formatNumber(Number(v))}명`, name]} />
                  <Pie
                    data={platforms}
                    dataKey="users"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="90%"
                    stroke="var(--adm-surface)"
                    strokeWidth={2}
                    rootTabIndex={-1}
                    isAnimationActive={false}
                  >
                    {platforms.map((p, i) => (
                      <Cell key={p.label} fill={sliceColor(i)} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartFrame>
              <ul className="adm-legend">
                {platforms.map((p, i) => (
                  <li key={p.label} className="adm-legend__item">
                    <span className="adm-legend__swatch" style={{ background: sliceColor(i) }} aria-hidden="true" />
                    <span className="adm-legend__label">{p.label}</span>
                    <span className="adm-legend__value adm-num">{percent(p.ratio)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardState>
        </Card>
        <ShareTable
          title={COUNTRY_TITLE}
          subtitle="country"
          labelHeader="국가"
          file="countries"
          shares={data?.countries}
          query={query}
        />
        <ShareTable
          title={VERSION_TITLE}
          subtitle="appVersion"
          labelHeader="앱 버전"
          file="app-versions"
          shares={data?.appVersions}
          query={query}
        />
      </div>
    </>
  )
}
