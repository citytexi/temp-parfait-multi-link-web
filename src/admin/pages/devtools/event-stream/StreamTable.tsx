import { Star } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { formatNumber } from '../../../lib/format'
import { HIGHLIGHT_TTL_MS } from './config'
import type { EventLine, Highlight } from './report'
import './event-stream.css'

const BAR_WIDTH = 2
const BAR_STEP = 3
const TREND_HEIGHT = 24

function Trend({ values }: { values: readonly number[] }): ReactElement {
  const max = Math.max(...values, 0)
  return (
    <svg
      className="adm-event-stream-trend"
      viewBox={`0 0 ${values.length * BAR_STEP} ${TREND_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      {values.map((v, i) => {
        const h = max === 0 || v === 0 ? 1 : Math.max(2, (v / max) * TREND_HEIGHT)
        return (
          <rect
            key={i}
            x={i * BAR_STEP}
            y={TREND_HEIGHT - h}
            width={BAR_WIDTH}
            height={h}
            opacity={v === 0 ? 0.3 : 1}
          />
        )
      })}
    </svg>
  )
}

const secondsAgo = (now: number, at: number): number => Math.max(0, Math.floor((now - at) / 1000))

export function StreamTable(props: {
  lines: readonly EventLine[]
  highlights: ReadonlyMap<string, Highlight>
  onToggleWatch(name: string): void
  onOpenDictionary(name: string): void
}): ReactElement {
  const { lines, highlights, onToggleWatch, onOpenDictionary } = props
  const [now, setNow] = useState(() => Date.now())
  const active = useMemo(() => [...highlights.values()].some((h) => now - h.at < HIGHLIGHT_TTL_MS), [highlights, now])

  // The ticker runs only while a highlight is on screen.
  useEffect(() => {
    setNow(Date.now())
    if (!active) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [highlights, active])

  return (
    <div className="adm-table adm-event-stream-table">
      <div className="adm-table__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">지켜보기</th>
              <th scope="col">이벤트</th>
              <th scope="col" className="adm-num">
                방금
              </th>
              <th scope="col" className="adm-num">
                5분
              </th>
              <th scope="col" className="adm-num">
                30분
              </th>
              <th scope="col" className="adm-event-stream-trend-col">
                30분 추이
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const h = highlights.get(line.name)
              const hot = h !== undefined && now - h.at < HIGHLIGHT_TTL_MS ? h : undefined
              return (
                <tr key={line.name}>
                  <td>
                    <button
                      type="button"
                      className="adm-button adm-button--ghost adm-event-stream-star"
                      aria-label={`${line.name} 지켜보기`}
                      aria-pressed={line.watched}
                      onClick={() => onToggleWatch(line.name)}
                    >
                      <Star size={18} aria-hidden="true" fill={line.watched ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td>
                    <div className="adm-event-stream-event">
                      {hot && <span key={hot.at} className="adm-event-stream-flash" aria-hidden="true" />}
                      <span className="adm-event-stream-name">
                        {line.inCatalog && line.label !== line.name ? (
                          <>
                            <span className="adm-event-stream-label">{line.label}</span>
                            <span className="adm-event-stream-raw">{line.name}</span>
                          </>
                        ) : (
                          <span className="adm-event-stream-label">{line.name}</span>
                        )}
                      </span>
                      <span className="adm-event-stream-marks">
                        {!line.inCatalog && (
                          <>
                            <span className="adm-tag">사전에 없음</span>
                            <button
                              type="button"
                              className="adm-button adm-button--ghost adm-event-stream-dict"
                              onClick={() => onOpenDictionary(line.name)}
                            >
                              사전에서 보기
                            </button>
                          </>
                        )}
                        {hot?.kind === 'new' && (
                          <span className="adm-tag">{`새로 들어옴 · ${secondsAgo(now, hot.at)}초 전`}</span>
                        )}
                        {hot?.kind === 'up' && hot.delta > 0 && (
                          <span className="adm-event-stream-up">{`▲ +${hot.delta} · ${secondsAgo(now, hot.at)}초 전`}</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="adm-num">{formatNumber(line.now)}</td>
                  <td className="adm-num">{formatNumber(line.last5)}</td>
                  <td className="adm-num">{formatNumber(line.total)}</td>
                  <td className="adm-event-stream-trend-col">
                    <Trend values={line.perMinute} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
