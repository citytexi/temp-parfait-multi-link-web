export type EventPlatform = 'Android' | 'iOS'

export type EventParam = {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
}

export type CatalogEvent = {
  name: string
  /** Korean display name. Empty means the raw name is shown. */
  label: string
  description: string
  /** auto: Firebase collects it. app: the app team implements it. */
  kind: 'auto' | 'app'
  params: readonly EventParam[]
  /** Platforms that must send this event. Omitted means ALL_PLATFORMS. */
  platforms?: readonly EventPlatform[]
}

export const ALL_PLATFORMS: readonly EventPlatform[] = ['Android', 'iOS']

const auto = (name: string, label: string, description: string): CatalogEvent => ({
  name,
  label,
  description,
  kind: 'auto',
  params: [],
})

export const EVENT_CATALOG: readonly CatalogEvent[] = [
  auto('first_open', '처음 앱 열기', '앱을 설치하거나 다시 설치한 뒤 처음 열 때 기록돼요.'),
  auto('session_start', '앱 실행', '앱이 화면에 보이는 상태에서 새 세션이 시작될 때 기록돼요.'),
  auto('screen_view', '화면 조회', '앱에서 화면이 바뀔 때 기록돼요.'),
  auto('user_engagement', '앱 사용', '앱이 화면 맨 앞에 있는 동안 사용자가 앱을 쓰고 있을 때 기록돼요.'),
  auto('app_update', '앱 업데이트', '앱이 새 버전으로 업데이트된 뒤 처음 열릴 때 기록돼요.'),
  auto('app_remove', '앱 삭제', '사용자가 기기에서 앱을 삭제할 때 기록돼요.'),
  auto('os_update', 'OS 업데이트', '기기의 운영체제가 새 버전으로 바뀐 뒤 앱이 열릴 때 기록돼요.'),
  auto('notification_receive', '알림 받음', '앱이 백그라운드에 있을 때 알림이 기기에 도착하면 기록돼요.'),
  auto('notification_open', '알림 열기', '사용자가 알림을 눌러 앱을 열 때 기록돼요.'),
  auto('app_exception', '앱 오류', '앱이 비정상 종료되거나 예외가 발생할 때 기록돼요.'),
]

const BY_NAME: ReadonlyMap<string, CatalogEvent> = new Map(EVENT_CATALOG.map((e) => [e.name, e]))

export function findEvent(name: string): CatalogEvent | undefined {
  return BY_NAME.get(name)
}

export function targetPlatforms(event: CatalogEvent): readonly EventPlatform[] {
  return event.platforms ?? ALL_PLATFORMS
}
