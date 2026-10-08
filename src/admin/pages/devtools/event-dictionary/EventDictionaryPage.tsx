import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Card } from '../../../components/Card'
import { CardState } from '../../../components/CardState'
import { CsvButton } from '../../../components/CsvButton'
import { EVENT_CATALOG } from '../../../ga/eventCatalog'
import { usePageParam } from '../../../menu/NavContext'
import { SearchField } from '../shared/SearchField'
import {
  CSV_HEADERS,
  STATUS_LABEL,
  filterEntries,
  parseStatus,
  statusCounts,
  toCsvRows,
  unlistedParams,
  type ProblemStatus,
} from './dictionary'
import { DictionaryTable, ListSkeleton, type PinnedRow } from './DictionaryTable'
import type { GaParam } from './report'
import { useEventDictionary } from './useEventDictionary'
import './event-dictionary.css'

const STATUS_BUTTONS: readonly ProblemStatus[] = ['unknown', 'missing', 'partial', 'undocumented']
const KIND_LABEL: Record<GaParam['kind'], string> = { dimension: '측정기준', metric: '측정항목' }
const UNKNOWN_COUNT = '—'

function ParamTable({ params }: { params: readonly GaParam[] }): ReactElement {
  const unlisted = useMemo(() => unlistedParams(params, EVENT_CATALOG), [params])
  return (
    <div className="adm-table adm-event-dictionary-params">
      <div className="adm-table__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">파라미터</th>
              <th scope="col">표시 이름</th>
              <th scope="col">종류</th>
              <th scope="col">설명</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={`${p.kind}:${p.name}`}>
                <td>
                  <div className="adm-event-dictionary-param">
                    <span>{p.name}</span>
                    {unlisted.has(p.name) && <span className="adm-tag">{STATUS_LABEL.unknown}</span>}
                  </div>
                </td>
                <td>{p.uiName}</td>
                <td>{KIND_LABEL[p.kind]}</td>
                <td className="adm-event-dictionary-params__desc">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function EventDictionaryPage(): ReactElement {
  const [q, setQ] = usePageParam('q')
  const [statusParam, setStatus] = usePageParam('status')
  const [eventParam, setEvent] = usePageParam('event')
  const expanded = eventParam || null
  const { entries, observed, recentFailed, retryObserved, range, params, registeredParams } =
    useEventDictionary(expanded)

  const status = parseStatus(statusParam)
  const counts = useMemo(() => statusCounts(entries, observed === 'ready'), [entries, observed])
  const filtered = useMemo(() => filterEntries(entries, { q: (q ?? '').trim(), status }), [entries, q, status])

  // A status that cannot be judged yet has no list: an empty one would read as "no problems".
  const unjudged = status !== null && counts[status] === null
  const listed = unjudged ? [] : filtered

  let pinned: PinnedRow | null = null
  if (expanded !== null && !listed.some((e) => e.name === expanded)) {
    const entry = entries.find((e) => e.name === expanded)
    pinned = entry ? { kind: 'filtered', entry } : { kind: 'unlisted', name: expanded }
  }

  // Where focus goes once a control that held it has left the page; `seq` makes each request run once.
  const toolbar = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [focusRequest, setFocusRequest] = useState<{ target: 'list' | 'search'; seq: number } | null>(null)
  const requestFocus = (target: 'list' | 'search') =>
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }))
  const focusSearch = () => toolbar.current?.querySelector<HTMLElement>('input[type="search"]')?.focus()
  useEffect(() => {
    if (focusRequest === null) return
    if (focusRequest.target === 'search') {
      focusSearch()
      return
    }
    // The first listed row, or the chosen status button when nothing is listed.
    const target =
      grid.current?.querySelector<HTMLElement>('.adm-event-dictionary-toggle') ??
      toolbar.current?.querySelector<HTMLElement>('.adm-event-dictionary-status[aria-pressed="true"]')
    target?.focus()
  }, [focusRequest])

  // The event a link or the stream opened is brought into view once it is judged, and again when its row
  // leaves the top for its sorted place. A row the user opened in the list is already in view.
  const linked = useRef(expanded)
  const scrolledWhile = useRef<'pinned' | 'listed' | null>(null)
  const placement = pinned === null ? 'listed' : 'pinned'
  useEffect(() => {
    if (expanded === null || expanded !== linked.current || observed !== 'ready') return
    const before = scrolledWhile.current
    if (before === 'listed' || before === placement) return
    scrolledWhile.current = placement
    // `auto` does not animate: the page sets no smooth scrolling.
    grid.current
      ?.querySelector('.adm-event-dictionary-toggle[aria-expanded="true"]')
      ?.closest('tr')
      ?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [expanded, observed, placement])

  // A retry the user started keeps the notice, and the button under their focus, on the page.
  const [retrying, setRetrying] = useState(false)
  const [failures, setFailures] = useState(0)
  const retryLeftError = useRef(false)
  useEffect(() => {
    if (!retrying) return
    if (observed === 'pending') {
      retryLeftError.current = true
      return
    }
    // Still the failure the retry was pressed on: the request has not started yet.
    if (!retryLeftError.current) return
    setRetrying(false)
    if (observed === 'error') setFailures((n) => n + 1)
    // The notice is gone; focus is moved only if it was on the notice's button.
    else if (document.activeElement === null || document.activeElement === document.body) focusSearch()
  }, [observed, retrying])
  const retry = () => {
    if (retrying) return
    retryLeftError.current = false
    setRetrying(true)
    retryObserved()
  }
  const showFailure = observed === 'error' || (retrying && observed === 'pending')

  const toggle = (name: string) => {
    linked.current = null
    if (name !== expanded) {
      setEvent(name)
      return
    }
    setEvent(null)
    // A pinned row leaves with its button.
    if (pinned !== null) requestFocus('list')
  }

  const chooseStatus = (next: ProblemStatus | null) => {
    if (next === status) return
    setStatus(next)
    setEvent(null)
  }
  const clearFilters = () => {
    setQ(null)
    setStatus(null)
    setEvent(null)
    requestFocus('search')
  }

  return (
    <>
      <div className="adm-event-dictionary-toolbar" ref={toolbar}>
        <div className="adm-event-dictionary-statuses" role="group" aria-label="상태">
          <button
            type="button"
            className="adm-event-dictionary-status"
            aria-pressed={status === null}
            onClick={() => chooseStatus(null)}
          >
            {`전체 ${counts.all}`}
          </button>
          {STATUS_BUTTONS.map((s) => (
            <button
              key={s}
              type="button"
              className="adm-event-dictionary-status"
              aria-pressed={status === s}
              onClick={() => chooseStatus(status === s ? null : s)}
            >
              {`${STATUS_LABEL[s]} ${counts[s] ?? UNKNOWN_COUNT}`}
            </button>
          ))}
        </div>
        <div className="adm-event-dictionary-tools">
          <SearchField
            label="검색"
            placeholder="이벤트 이름이나 설명"
            value={q}
            onCommit={(value) => {
              setQ(value)
              setEvent(null)
            }}
          />
          {/* An unjudged list would be exported with blank counts and every entry as 정상. */}
          {observed === 'ready' && range && (
            <CsvButton
              filename={`parfait-event-dictionary-${range.startDate}_${range.endDate}.csv`}
              headers={CSV_HEADERS}
              rows={toCsvRows(listed)}
            />
          )}
        </div>
        {observed === 'ready' && range && (
          <div className="adm-event-dictionary-basis">
            <p>{`${range.startDate} ~ ${range.endDate}과 최근 30분을 기준으로 판정했어요`}</p>
            {recentFailed && <p>오늘 들어온 이벤트는 확인하지 못했어요</p>}
          </div>
        )}
      </div>
      <div className="adm-grid" ref={grid}>
        <Card title="이벤트">
          {showFailure && (
            <div className="adm-state adm-state--error adm-event-dictionary-notice" role="alert">
              {/* A new node per failure, so a second failure is announced again. */}
              <p key={failures} className="adm-state__text">
                수집 현황을 불러오지 못했어요
              </p>
              <button
                type="button"
                className="adm-button adm-button--secondary"
                aria-disabled={retrying}
                onClick={retry}
              >
                {retrying ? '불러오는 중' : '다시 시도'}
              </button>
            </div>
          )}
          {observed === 'invalid-period' && (
            <div className="adm-state adm-event-dictionary-notice">
              <p className="adm-state__text">기간을 다시 골라 주세요</p>
            </div>
          )}
          {(pinned !== null || listed.length > 0) && (
            <DictionaryTable
              pinned={pinned}
              entries={listed}
              expanded={expanded}
              observed={observed}
              recentFailed={recentFailed}
              registeredParams={registeredParams}
              onToggle={toggle}
            />
          )}
          {unjudged
            ? observed === 'pending' && <ListSkeleton />
            : filtered.length === 0 && (
                <div className="adm-state adm-state--empty adm-event-dictionary-empty">
                  <p className="adm-state__text">조건에 맞는 이벤트가 없어요</p>
                  <button type="button" className="adm-button adm-button--secondary" onClick={clearFilters}>
                    필터 지우기
                  </button>
                </div>
              )}
        </Card>
        <Card title="GA에 등록된 파라미터">
          <CardState query={params} isEmpty={false}>
            {params.data && params.data.length > 0 ? (
              <ParamTable params={params.data} />
            ) : (
              <div className="adm-state adm-state--empty">
                <p className="adm-state__text">GA에 등록된 파라미터가 없어요</p>
              </div>
            )}
          </CardState>
        </Card>
      </div>
    </>
  )
}
