import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Card } from '../../../components/Card'
import { ConfirmButton } from '../../../components/form/ConfirmButton'
import { StatusRegion, useAnnounce } from '../../../components/form/StatusRegion'
import { TextField } from '../../../components/form/TextField'
import { newId, useStored } from '../../../lib/localStore'
import { LINK_GROUPS, TEAM_LINKS } from './links'
import {
  hostOf,
  matchesQuery,
  parsePersonal,
  PERSONAL_KEY,
  PERSONAL_MAX,
  validatePersonal,
  type PersonalErrors,
  type PersonalLink,
} from './personal'
import './link-hub.css'

const NO_LINKS: PersonalLink[] = []
const EMPTY = { label: '', url: '' }
const AT_LIMIT = `내 링크는 ${PERSONAL_MAX}개까지 둘 수 있어요`

/** The one form that is open: the add form, or the edit form in a link's tile. */
type OpenForm = { mode: 'add' } | { mode: 'edit'; id: string }
/** Where focus goes after the list changed: a link, a link's edit button or the add button. */
type FocusTarget = { kind: 'link' | 'edit'; id: string } | { kind: 'add' }

type NodeMap<T> = { current: Map<string, T> }

/** A ref callback that keeps the mounted node of one link in a map. */
function keep<T>(map: NodeMap<T>, id: string): (node: T | null) => void {
  return (node) => {
    if (node) map.current.set(id, node)
    else map.current.delete(id)
  }
}

/** What a tile says: name, the new-tab note for screen readers, description and host. All plain text. */
function LinkText({ label, description, url }: { label: string; description?: string; url: string }): ReactElement {
  return (
    <>
      {/* The spaces sit between the spans: one inside a span is dropped from the accessible name. */}
      <span className="adm-link-hub-link__name">
        {label} <span className="adm-sr-only">새 탭에서 열려요</span>
      </span>{' '}
      {description && (
        <>
          <span className="adm-link-hub-link__description">{description}</span>{' '}
        </>
      )}
      <span className="adm-link-hub-link__host">{hostOf(url)}</span>
    </>
  )
}

/** The add and edit form. The typed text is left as it is; only a valid pair leaves through onSave. */
function LinkForm({
  name,
  initial,
  onSave,
  onCancel,
}: {
  name: string
  initial: { label: string; url: string }
  onSave(label: string, url: string): void
  onCancel(): void
}): ReactElement {
  const [label, setLabel] = useState(initial.label)
  const [url, setUrl] = useState(initial.url)
  const [errors, setErrors] = useState<PersonalErrors>({})
  const labelRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  const save = () => {
    const checked = validatePersonal({ label, url })
    if (checked.ok) {
      onSave(checked.label, checked.url)
      return
    }
    setErrors(checked.errors)
    const first = checked.errors.label ? labelRef : urlRef
    first.current?.focus()
  }

  return (
    <form
      className="adm-link-hub-form"
      aria-label={name}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <TextField ref={labelRef} label="이름" value={label} onChange={setLabel} error={errors.label} autoComplete="off" />
      <TextField
        ref={urlRef}
        label="주소"
        value={url}
        onChange={setUrl}
        error={errors.url}
        inputMode="url"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="adm-link-hub-form__actions">
        <button type="submit" className="adm-button adm-button--primary">
          저장
        </button>
        <button type="button" className="adm-button adm-button--ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  )
}

function LinkHub(): ReactElement {
  const announce = useAnnounce()
  const personal = useStored(PERSONAL_KEY, parsePersonal, NO_LINKS)
  // A filter for this screen only; it is not part of the URL.
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<OpenForm | null>(null)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const anchors = useRef(new Map<string, HTMLAnchorElement>())
  const editButtons = useRef(new Map<string, HTMLButtonElement>())

  // Runs after the list is on screen. A target that is gone (filtered out, removed in another tab,
  // the add button at the limit) falls back to the add button, then to the search field.
  useEffect(() => {
    if (!focus) return
    const own =
      focus.kind === 'link' ? anchors.current.get(focus.id) : focus.kind === 'edit' ? editButtons.current.get(focus.id) : null
    ;(own ?? addRef.current ?? searchRef.current)?.focus()
  }, [focus])

  const adding = form?.mode === 'add'
  // A link removed in another tab takes its edit form with it.
  const editingId = form?.mode === 'edit' && personal.value.some((l) => l.id === form.id) ? form.id : null
  const atLimit = personal.value.length >= PERSONAL_MAX

  const groups = LINK_GROUPS.map((group) => ({
    ...group,
    links: TEAM_LINKS.filter((l) => l.group === group.id && matchesQuery(l, query)),
  })).filter((group) => group.links.length > 0)
  const matched = personal.value.filter((l) => matchesQuery(l, query))
  // An open form stays while the search changes, so what was typed in it is not lost.
  const mine = personal.value.filter((l) => l.id === editingId || matchesQuery(l, query))
  const showMine = query.trim() === '' || mine.length > 0 || adding
  const nothing = groups.length === 0 && matched.length === 0

  const close = (target: FocusTarget, saved?: { label: string; url: string }) => {
    setForm(null)
    // A saved link the search would hide is shown instead.
    if (saved && !matchesQuery(saved, query)) setQuery('')
    setFocus(target)
  }

  const add = (label: string, url: string) => {
    const id = newId()
    let added = false
    personal.update((list) => {
      if (list.length >= PERSONAL_MAX) return list
      added = true
      return [...list, { id, label, url }]
    })
    announce(added ? '추가했어요' : AT_LIMIT)
    close({ kind: 'link', id }, { label, url })
  }

  const edit = (id: string, label: string, url: string) => {
    let found = false
    personal.update((list) =>
      list.map((l) => {
        if (l.id !== id) return l
        found = true
        return { id, label, url }
      }),
    )
    if (found) announce('고쳤어요')
    close({ kind: 'link', id }, { label, url })
  }

  const remove = (id: string) => {
    const next = mine[mine.findIndex((l) => l.id === id) + 1]
    personal.update((list) => list.filter((l) => l.id !== id))
    announce('지웠어요')
    setFocus(next ? { kind: 'link', id: next.id } : { kind: 'add' })
  }

  const clearSearch = () => {
    setQuery('')
    // The pressed button goes away with the message.
    searchRef.current?.focus()
  }

  return (
    <div className="adm-link-hub-layout">
      <div className="adm-link-hub-search">
        <TextField ref={searchRef} type="search" label="링크 검색" value={query} onChange={setQuery} autoComplete="off" />
      </div>
      {groups.map((group) => (
        <Card key={group.id} title={group.label}>
          <ul className="adm-link-hub-tiles">
            {group.links.map((l) => (
              <li key={l.id} className="adm-link-hub-tile">
                <a className="adm-link-hub-link" href={l.url} target="_blank" rel="noopener noreferrer">
                  <LinkText label={l.label} description={l.description} url={l.url} />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {nothing && (
        <div className="adm-state">
          <p className="adm-state__text">찾는 링크가 없어요</p>
          <button type="button" className="adm-button adm-button--secondary" onClick={clearSearch}>
            검색 지우기
          </button>
        </div>
      )}
      {showMine && (
        <Card title="내 링크">
          <div className="adm-link-hub-mine">
            <p className="adm-link-hub-text">
              내 링크는 이 브라우저에만 저장돼요. 비밀번호나 토큰이 들어간 주소는 넣지 마세요.
            </p>
            {mine.length > 0 && (
              <ul className="adm-link-hub-tiles">
                {mine.map((l) => (
                  <li key={l.id} className="adm-link-hub-tile">
                    {editingId === l.id ? (
                      <LinkForm
                        name={`${l.label} 수정`}
                        initial={l}
                        onSave={(label, url) => edit(l.id, label, url)}
                        onCancel={() => close({ kind: 'edit', id: l.id })}
                      />
                    ) : (
                      <>
                        {/* l.url passed validatePersonal, when it was saved and again when it was read. */}
                        <a
                          ref={keep(anchors, l.id)}
                          className="adm-link-hub-link"
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <LinkText label={l.label} url={l.url} />
                        </a>
                        {/* Siblings of the link: a button inside a link is invalid and unreachable. */}
                        <div className="adm-link-hub-actions">
                          <button
                            ref={keep(editButtons, l.id)}
                            type="button"
                            className="adm-button adm-button--ghost"
                            aria-label={`${l.label} 수정`}
                            onClick={() => setForm({ mode: 'edit', id: l.id })}
                          >
                            수정
                          </button>
                          <ConfirmButton
                            label="삭제"
                            name={`${l.label} 삭제`}
                            confirmLabel="정말 지울까요?"
                            onConfirm={() => remove(l.id)}
                          />
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {adding ? (
              <LinkForm name="내 링크 추가" initial={EMPTY} onSave={add} onCancel={() => close({ kind: 'add' })} />
            ) : atLimit ? (
              <p className="adm-link-hub-text">{AT_LIMIT}</p>
            ) : (
              <button
                ref={addRef}
                type="button"
                className="adm-button adm-button--secondary adm-link-hub-add"
                onClick={() => setForm({ mode: 'add' })}
              >
                내 링크 추가
              </button>
            )}
            {!personal.persisted && (
              <p className="adm-link-hub-text adm-link-hub-text--warn">
                이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

export function LinkHubPage(): ReactElement {
  return (
    <StatusRegion>
      <LinkHub />
    </StatusRegion>
  )
}
