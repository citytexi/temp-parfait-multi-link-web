export type ReleasePlatform = 'android' | 'ios'
export type ChecklistItem = {
  /** Permanent key for stored state: never change it once shipped. */
  id: string
  label: string
  help?: string
  /** Omitted: shown in every release. */
  platforms?: readonly ReleasePlatform[]
  /** Related admin menu id; the page links to it when the menu exists. */
  menu?: string
}
export type ChecklistSection = { id: string; title: string; items: readonly ChecklistItem[] }

export const PLATFORMS: readonly ReleasePlatform[] = ['android', 'ios']
export const PLATFORM_LABEL: Record<ReleasePlatform, string> = { android: 'Android', ios: 'iOS' }

export const CHECKLIST: readonly ChecklistSection[] = [
  {
    id: 'prepare',
    title: '준비',
    items: [
      { id: 'version-bumped', label: '버전 이름과 빌드 번호를 올렸어요' },
      { id: 'release-notes', label: '릴리즈 노트를 썼어요' },
      { id: 'server-order', label: '서버 배포가 먼저 필요한지 확인했어요' },
      { id: 'remote-config', label: 'Remote Config 값을 확인했어요' },
    ],
  },
  {
    id: 'verify',
    title: '확인',
    items: [
      { id: 'core-flows', label: '가입, 로그인, 사진 올리기, 캔버스 공유, 알림을 직접 해 봤어요' },
      { id: 'events-arrive', label: '새로 넣은 이벤트가 GA에 들어오는지 봤어요' },
      { id: 'no-crash', label: '테스트 빌드에서 크래시가 없었어요' },
      { id: 'landing-links', label: '랜딩에서 스토어로 잘 넘어가는지 봤어요', menu: 'ua-tester' },
    ],
  },
  {
    id: 'android',
    title: 'Android',
    items: [
      { id: 'android-signed', label: '릴리즈 빌드의 서명과 난독화를 확인했어요', platforms: ['android'] },
      { id: 'android-internal', label: '내부 테스트 트랙에 올리고 설치해 봤어요', platforms: ['android'] },
      { id: 'android-listing', label: '스토어 설명과 스크린샷을 반영했어요', platforms: ['android'] },
      { id: 'android-rollout', label: '단계적 출시 비율을 정했어요', platforms: ['android'] },
      { id: 'android-submitted', label: '심사를 요청했어요', platforms: ['android'] },
    ],
  },
  {
    id: 'ios',
    title: 'iOS',
    items: [
      { id: 'ios-testflight', label: 'TestFlight에 올리고 설치해 봤어요', platforms: ['ios'] },
      { id: 'ios-listing', label: '스토어 설명과 스크린샷을 반영했어요', platforms: ['ios'] },
      { id: 'ios-review-notes', label: '심사 메모와 테스트 계정을 적었어요', platforms: ['ios'] },
      { id: 'ios-release-mode', label: '출시 방식(수동, 자동)을 골랐어요', platforms: ['ios'] },
      { id: 'ios-submitted', label: '심사를 요청했어요', platforms: ['ios'] },
    ],
  },
  {
    id: 'after',
    title: '출시 후',
    items: [
      { id: 'store-visible', label: '스토어에 새 버전이 보여요' },
      { id: 'crash-watch', label: '출시 뒤 크래시 지표를 봤어요' },
      { id: 'version-adoption', label: '새 버전 사용자가 늘고 있어요', menu: 'tech' },
      { id: 'team-notified', label: '팀에 출시를 알렸어요' },
    ],
  },
]
