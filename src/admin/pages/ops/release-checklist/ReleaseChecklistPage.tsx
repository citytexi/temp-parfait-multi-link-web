import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from 'react'
import { Card } from '../../../components/Card'
import { CheckboxField } from '../../../components/form/CheckboxField'
import { ConfirmButton } from '../../../components/form/ConfirmButton'
import { CopyButton } from '../../../components/form/CopyButton'
import { SelectField } from '../../../components/form/SelectField'
import { StatusRegion, useAnnounce } from '../../../components/form/StatusRegion'
import { TextField } from '../../../components/form/TextField'
import { newId, useStored } from '../../../lib/localStore'
import { useNav, usePageParam } from '../../../menu/NavContext'
import { REGISTRY } from '../../../menu/registry'
import {
  isChecked,
  LIMIT_MESSAGE,
  newRelease,
  normalizePlatforms,
  parseReleases,
  platformsLabel,
  progress,
  RELEASES_KEY,
  RELEASES_MAX,
  releaseText,
  toggleItem,
  validateName,
  visibleSections,
  type Release,
} from './release'
import { shareUrl } from './share'
import { PLATFORM_LABEL, PLATFORMS, type ChecklistItem, type ReleasePlatform } from './template'
import './release-checklist.css'

/** What the shared-release view uses to work on this page's list. */
export type ReleaseActions = {
  /**
   * Puts the release first, selects it and, after the next render, moves focus to its heading.
   * Returns whether it was added (not whether it was saved). Does nothing and returns false
   * when the latest list already holds RELEASES_MAX.
   */
  addRelease(release: Release): boolean
  /**
   * After the next render, moves focus to the release picker, or to the version name field
   * when there is no release. The element does not have to exist yet when this is called.
   */
  focusPicker(): void
}

const NO_RELEASES: Release[] = []
const ALL_DONE = '모두 확인했어요'
const NO_PLATFORM = '플랫폼을 하나 이상 골라 주세요'

/** Where focus goes once the next render is on screen. A new object each time, so it runs again. */
type FocusTarget = { to: 'heading' | 'picker' | 'name' | 'new' }

function NewReleaseForm({
  nameRef,
  onCreate,
  onCancel,
}: {
  nameRef: RefObject<HTMLInputElement | null>
  onCreate(name: string, platforms: ReleasePlatform[]): void
  /** Given only when there is a release to go back to. */
  onCancel?: () => void
}): ReactElement {
  const announce = useAnnounce()
  const platformErrorId = `${useId()}-platforms`
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Record<ReleasePlatform, boolean>>({ android: true, ios: true })
  const [nameError, setNameError] = useState<string | null>(null)
  const [platformError, setPlatformError] = useState(false)

  const create = () => {
    const checked = validateName(name)
    const platforms = normalizePlatforms(PLATFORMS.filter((p) => picked[p]))
    setNameError(checked.ok ? null : checked.error)
    setPlatformError(!platforms)
    if (!checked.ok) {
      nameRef.current?.focus()
      return
    }
    if (!platforms) {
      announce(NO_PLATFORM)
      return
    }
    onCreate(checked.name, platforms)
  }

  return (
    <form
      className="adm-release-checklist-form"
      aria-label="새 릴리즈"
      onSubmit={(e) => {
        e.preventDefault()
        create()
      }}
    >
      <TextField
        ref={nameRef}
        label="버전 이름"
        help="예: 1.5.0"
        value={name}
        onChange={setName}
        error={nameError}
        autoComplete="off"
        spellCheck={false}
      />
      <div
        className="adm-release-checklist-platforms"
        role="group"
        aria-label="플랫폼"
        aria-describedby={platformError ? platformErrorId : undefined}
      >
        {PLATFORMS.map((p) => (
          <CheckboxField
            key={p}
            label={PLATFORM_LABEL[p]}
            checked={picked[p]}
            onChange={(on) => setPicked((prev) => ({ ...prev, [p]: on }))}
          />
        ))}
      </div>
      {platformError && (
        <p id={platformErrorId} className="adm-field__error">
          {NO_PLATFORM}
        </p>
      )}
      <div className="adm-release-checklist-buttons">
        <button type="submit" className="adm-button adm-button--primary">
          만들기
        </button>
        {onCancel && (
          <button type="button" className="adm-button adm-button--ghost" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  )
}

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem
  checked: boolean
  onToggle(checked: boolean): void
}): ReactElement {
  const { setMenu } = useNav()
  // A menu that is not registered (not merged yet, renamed) leaves the item without a link.
  const related = item.menu ? REGISTRY.findMenu(item.menu) : undefined

  return (
    <li className="adm-release-checklist-item">
      <CheckboxField label={item.label} help={item.help} checked={checked} onChange={onToggle} />
      {related && (
        <button type="button" className="adm-button adm-button--ghost" onClick={() => setMenu(related.id)}>
          {`${related.label} 열기`}
        </button>
      )}
    </li>
  )
}

function ReleaseChecklist(): ReactElement {
  const announce = useAnnounce()
  const releases = useStored(RELEASES_KEY, parseReleases, NO_RELEASES)
  const [releaseParam, setReleaseParam] = usePageParam('release')
  const [formOpen, setFormOpen] = useState(false)
  // Set by a refused 새 릴리즈; the message shows only while the list is still full.
  const [limitAsked, setLimitAsked] = useState(false)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pickerRef = useRef<HTMLSelectElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLButtonElement>(null)

  // Runs after the render that drew the target: a new release's heading, the picker after a delete.
  useEffect(() => {
    if (!focus) return
    const picker = pickerRef.current ?? nameRef.current
    const target =
      focus.to === 'heading'
        ? (headingRef.current ?? picker)
        : focus.to === 'name'
          ? nameRef.current
          : focus.to === 'new'
            ? (newRef.current ?? picker)
            : picker
    target?.focus()
  }, [focus])

  const list = releases.value
  const current = list.find((r) => r.id === releaseParam) ?? list[0] ?? null
  const atLimit = list.length >= RELEASES_MAX
  const showLimit = limitAsked && atLimit
  const showForm = list.length === 0 || (formOpen && !showLimit)

  const actions: ReleaseActions = {
    addRelease(release) {
      // Set inside fn, which update calls once and synchronously: update's own result says
      // whether the write reached storage, and a release that was not saved is still added.
      let added = false
      releases.update((latest) => {
        if (latest.length >= RELEASES_MAX) return latest
        added = true
        return [release, ...latest]
      })
      if (!added) return false
      setReleaseParam(release.id)
      setFormOpen(false)
      setLimitAsked(false)
      setFocus({ to: 'heading' })
      return true
    },
    focusPicker() {
      setFocus({ to: 'picker' })
    },
  }

  const refuse = () => {
    setFormOpen(false)
    setLimitAsked(true)
    announce(LIMIT_MESSAGE)
  }

  const openForm = () => {
    if (atLimit) {
      refuse()
      return
    }
    setFormOpen(true)
    setFocus({ to: 'name' })
  }

  const create = (name: string, platforms: ReleasePlatform[]) => {
    const release = newRelease({ id: newId(), name, platforms, now: new Date().toISOString() })
    // Full only when another tab filled the list while the form was open.
    if (!actions.addRelease(release)) refuse()
  }

  const cancel = () => {
    setFormOpen(false)
    setFocus({ to: 'new' })
  }

  const setItem = (releaseId: string, itemId: string, checked: boolean) => {
    const now = new Date().toISOString()
    let completed = false
    releases.update((latest) =>
      latest.map((r) => {
        // Another tab may already hold the wanted state; toggling then would undo it.
        if (r.id !== releaseId || isChecked(r, itemId) === checked) return r
        const next = toggleItem(r, itemId, now)
        const { done, total } = progress(visibleSections(next))
        completed = checked && done === total
        return next
      }),
    )
    if (completed) announce(ALL_DONE)
  }

  const remove = (releaseId: string) => {
    releases.update((latest) => latest.filter((r) => r.id !== releaseId))
    setReleaseParam(null)
    setLimitAsked(false)
    announce('지웠어요')
    actions.focusPicker()
  }

  const sections = current ? visibleSections(current) : []
  const { done, total } = progress(sections)

  return (
    <div className="adm-release-checklist-layout">
      {current ? (
        <div className="adm-release-checklist-toolbar">
          <SelectField
            ref={pickerRef}
            label="릴리즈"
            value={current.id}
            onChange={setReleaseParam}
            options={list.map((r) => ({ value: r.id, label: `${r.name} · ${platformsLabel(r.platforms)}` }))}
          />
          <button ref={newRef} type="button" className="adm-button adm-button--secondary" onClick={openForm}>
            새 릴리즈
          </button>
        </div>
      ) : (
        <p className="adm-release-checklist-text">아직 릴리즈가 없어요. 버전 이름을 정해서 시작해 보세요.</p>
      )}
      {showLimit && <p className="adm-release-checklist-text adm-release-checklist-text--warn">{LIMIT_MESSAGE}</p>}
      {showForm && <NewReleaseForm nameRef={nameRef} onCreate={create} onCancel={current ? cancel : undefined} />}
      {current && (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="adm-release-checklist-title">
            {`${current.name} 릴리즈`}
          </h2>
          <div className="adm-release-checklist-progress">
            <progress value={done} max={total} aria-label="진행률" />
            <span className="adm-release-checklist-progress__count">{`${done} / ${total}`}</span>
            {total > 0 && done === total && <span className="adm-release-checklist-progress__done">{ALL_DONE}</span>}
          </div>
          <div className="adm-release-checklist-buttons">
            {/* Keyed by release: a fallback text box must not keep another release's text. */}
            <CopyButton key={`text-${current.id}`} label="진행 상황 복사" text={() => releaseText(current)} />
            <CopyButton key={`link-${current.id}`} label="링크로 공유" text={() => shareUrl(current, window.location)} />
            <ConfirmButton label="이 릴리즈 지우기" confirmLabel="정말 지울까요?" onConfirm={() => remove(current.id)} />
          </div>
          {sections.map((section) => (
            <Card key={section.id} title={section.title} subtitle={`${section.done} / ${section.items.length}`}>
              <ul className="adm-release-checklist-items">
                {section.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    checked={isChecked(current, item.id)}
                    onToggle={(checked) => setItem(current.id, item.id, checked)}
                  />
                ))}
              </ul>
            </Card>
          ))}
          <p className="adm-release-checklist-text">체크한 내용은 이 브라우저에만 저장돼요.</p>
        </>
      )}
      {!releases.persisted && (
        <p className="adm-release-checklist-text adm-release-checklist-text--warn">
          이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.
        </p>
      )}
    </div>
  )
}

export function ReleaseChecklistPage(): ReactElement {
  return (
    <StatusRegion>
      <ReleaseChecklist />
    </StatusRegion>
  )
}
