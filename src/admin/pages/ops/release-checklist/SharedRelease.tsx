import type { ReactElement } from 'react'
import { Card } from '../../../components/Card'
import { useAnnounce } from '../../../components/form/StatusRegion'
import { newId } from '../../../lib/localStore'
import type { ReleaseActions } from './ReleaseChecklistPage'
import { isChecked, LIMIT_MESSAGE, newRelease, platformsLabel, progress, visibleSections } from './release'
import type { SharePayload } from './share'

/**
 * A release that came through a link: read-only, and everything in it is drawn as text.
 * The page draws it inside its own layout element.
 */
export function SharedRelease({
  payload,
  actions,
  limitReached,
  onClose,
}: {
  payload: SharePayload
  actions: ReleaseActions
  /** The page refused the last import because its list is still full. */
  limitReached: boolean
  onClose(): void
}): ReactElement {
  const announce = useAnnounce()
  const { name, platforms, checked } = payload
  const shared = newRelease({ id: 'shared', name, platforms, now: '', checked })
  const sections = visibleSections(shared)
  const { done, total } = progress(sections)

  const importRelease = () => {
    // A new id every time: a release of mine with the same name stays as it is.
    const release = newRelease({ id: newId(), name, platforms, now: new Date().toISOString(), checked })
    if (actions.addRelease(release)) announce('가져왔어요')
  }

  return (
    <>
      <p className="adm-release-checklist-text adm-release-checklist-text--warn">공유받은 릴리즈예요. 읽기 전용이에요.</p>
      <div className="adm-release-checklist-buttons">
        <button type="button" className="adm-button adm-button--primary" onClick={importRelease}>
          내 브라우저로 가져오기
        </button>
        <button type="button" className="adm-button adm-button--secondary" onClick={onClose}>
          닫기
        </button>
      </div>
      {limitReached && (
        <p role="alert" className="adm-release-checklist-text adm-release-checklist-text--warn">
          {LIMIT_MESSAGE}
        </p>
      )}
      <h2 className="adm-release-checklist-title">{`${name} 릴리즈`}</h2>
      <p className="adm-release-checklist-text">{platformsLabel(platforms)}</p>
      <div className="adm-release-checklist-progress">
        <progress value={done} max={total} aria-label="진행률" />
        <span className="adm-release-checklist-progress__count">{`${done} / ${total}`}</span>
      </div>
      {sections.map((section) => (
        <Card key={section.id} title={section.title} subtitle={`${section.done} / ${section.items.length}`}>
          <ul className="adm-release-checklist-items">
            {section.items.map((item) => (
              <li key={item.id} className="adm-release-checklist-shared-item">
                <span className="adm-release-checklist-shared-item__label">{item.label}</span>
                {isChecked(shared, item.id) ? (
                  <span className="adm-tag adm-release-checklist-shared-item__state">확인함</span>
                ) : (
                  <span className="adm-release-checklist-shared-item__state adm-release-checklist-shared-item__state--todo">
                    아직
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  )
}
