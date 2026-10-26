import { ChevronRight } from 'lucide-react'
import { Fragment, useId, type ReactElement } from 'react'
import { CopyButton } from '../../../components/form/CopyButton'
import { displayDim } from '../../../ga/reports/common'
import { formatNumber } from '../../../lib/format'
import { EventName } from '../shared/EventName'
import { STATUS_LABEL, catalogSnippet, type DictionaryEntry } from './dictionary'
import type { EventDictionary } from './useEventDictionary'
import './event-dictionary.css'

// Only a valid GA event name is offered as code to paste: the name is put into the snippet as it is.
const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

/** The event named in the URL when the list does not hold it: filtered out, or a name with no entry. */
export type PinnedRow = { kind: 'filtered'; entry: DictionaryEntry } | { kind: 'unlisted'; name: string }

type Row = { name: string; entry: DictionaryEntry | null; pinned: boolean }

export function ListSkeleton(): ReactElement {
  return (
    <div className="adm-state adm-skeleton" role="status" aria-label="불러오는 중">
      <span className="adm-skeleton__bar adm-skeleton__bar--wide" />
      <span className="adm-skeleton__bar" />
      <span className="adm-skeleton__bar adm-skeleton__bar--short" />
    </div>
  )
}

const kindText = (entry: DictionaryEntry | null): string =>
  entry?.catalog ? (entry.catalog.kind === 'auto' ? '자동 수집' : '앱 정의') : '—'

function CopySnippet({ name }: { name: string }): ReactElement {
  return (
    <div className="adm-event-dictionary-copy">
      <CopyButton label="카탈로그 항목 복사" text={catalogSnippet(name)} />
    </div>
  )
}

function EntryDetail(props: { entry: DictionaryEntry; registeredParams: ReadonlySet<string> }): ReactElement {
  const { entry, registeredParams } = props
  const params = entry.catalog?.params ?? []
  return (
    <>
      <p className="adm-event-dictionary-detail__text">
        {entry.catalog
          ? entry.catalog.description.trim() === ''
            ? '아직 설명이 없어요'
            : entry.catalog.description
          : '이 이벤트는 사전에 없어요.'}
      </p>
      <p className="adm-event-dictionary-detail__kind">{`구분: ${kindText(entry)}`}</p>
      {params.length > 0 && (
        <div className="adm-table">
          <div className="adm-table__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">타입</th>
                  <th scope="col">설명</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <div className="adm-event-dictionary-param">
                        <span>{p.name}</span>
                        {registeredParams.has(p.name) && <span className="adm-tag">GA 등록됨</span>}
                      </div>
                    </td>
                    <td>{p.type}</td>
                    <td>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(entry.byPlatform.length > 0 || entry.recent.length > 0) && (
        <ul className="adm-event-dictionary-detail__counts">
          {entry.byPlatform.map((x) => (
            <li key={`period:${x.platform}`}>
              {`${displayDim(x.platform)} ${formatNumber(x.count)}번 · ${formatNumber(x.users)}명`}
            </li>
          ))}
          {entry.recent.map((x) => (
            <li key={`recent:${x.platform}`}>{`최근 30분: ${displayDim(x.platform)} ${formatNumber(x.count)}번`}</li>
          ))}
        </ul>
      )}
      {entry.status === 'unknown' && EVENT_NAME.test(entry.name) && <CopySnippet name={entry.name} />}
    </>
  )
}

/** A name that is in neither the catalogue nor the observations. What can be said depends on the observation. */
function UnlistedDetail(props: {
  name: string
  observed: EventDictionary['observed']
  recentFailed: boolean
}): ReactElement {
  const { name, observed, recentFailed } = props
  if (observed === 'pending') return <ListSkeleton />
  if (observed !== 'ready') {
    return (
      <p className="adm-event-dictionary-detail__text">
        수집 현황을 확인하지 못해서 이 이벤트의 기록을 알 수 없어요
      </p>
    )
  }
  return (
    <>
      <p className="adm-event-dictionary-detail__text">
        {recentFailed
          ? '이 기간에 들어온 기록이 없어요. 오늘 들어온 이벤트는 확인하지 못했어요.'
          : '이 기간과 최근 30분에 들어온 기록이 없어요'}
      </p>
      {EVENT_NAME.test(name) && <CopySnippet name={name} />}
    </>
  )
}

export function DictionaryTable(props: {
  /** Drawn on top of `entries`; never part of them. */
  pinned: PinnedRow | null
  entries: readonly DictionaryEntry[]
  /** Name of the expanded event. */
  expanded: string | null
  observed: EventDictionary['observed']
  recentFailed: boolean
  registeredParams: ReadonlySet<string>
  onToggle(name: string): void
}): ReactElement {
  const { pinned, entries, expanded, observed, recentFailed, registeredParams, onToggle } = props
  // Only one row is open at a time, so one id is enough for the open content.
  const detailId = useId()

  const rows: Row[] = entries.map((entry) => ({ name: entry.name, entry, pinned: false }))
  if (pinned) {
    rows.unshift(
      pinned.kind === 'filtered'
        ? { name: pinned.entry.name, entry: pinned.entry, pinned: true }
        : { name: pinned.name, entry: null, pinned: true },
    )
  }

  return (
    <div className="adm-table adm-event-dictionary-table">
      <div className="adm-table__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col" className="adm-event-dictionary-kind-col">
                구분
              </th>
              <th scope="col" className="adm-num">
                횟수
              </th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, entry, pinned: isPinned }) => {
              const open = name === expanded
              // A name with no entry was looked for and not found, which is zero once the observation is in.
              const count = entry ? entry.count : observed === 'ready' ? 0 : null
              const label = entry?.label ?? name
              // The key is the name wherever the row is drawn, so a pinned row that joins the list keeps its nodes.
              return (
                <Fragment key={name}>
                  <tr>
                    <td className="adm-event-dictionary-event-cell">
                      <div className="adm-event-dictionary-event">
                        <button
                          type="button"
                          className="adm-button adm-button--ghost adm-event-dictionary-toggle"
                          aria-label={`${name} 자세히 보기`}
                          aria-expanded={open}
                          aria-controls={open ? detailId : undefined}
                          onClick={() => onToggle(name)}
                        >
                          <ChevronRight size={18} aria-hidden="true" />
                        </button>
                        <EventName name={name} label={label} />
                        {entry?.recentOnly && <span className="adm-tag">오늘 들어옴</span>}
                        {isPinned && entry && (
                          <span className="adm-event-dictionary-pinned">필터와 상관없이 보여요</span>
                        )}
                      </div>
                    </td>
                    <td className="adm-event-dictionary-kind-col">{kindText(entry)}</td>
                    <td className="adm-num">
                      {count !== null ? (
                        `${formatNumber(count)}번`
                      ) : observed === 'pending' ? (
                        <>
                          <span className="adm-skeleton__bar adm-event-dictionary-count-skeleton" aria-hidden="true" />
                          <span className="adm-sr-only">불러오는 중</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {entry === null ? (
                        '—'
                      ) : entry.status === 'ok' ? (
                        STATUS_LABEL.ok
                      ) : (
                        <span className="adm-tag">{STATUS_LABEL[entry.status]}</span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={4} className="adm-event-dictionary-detail-cell">
                        <div id={detailId} className="adm-event-dictionary-detail">
                          {entry ? (
                            <EntryDetail entry={entry} registeredParams={registeredParams} />
                          ) : (
                            <UnlistedDetail name={name} observed={observed} recentFailed={recentFailed} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
