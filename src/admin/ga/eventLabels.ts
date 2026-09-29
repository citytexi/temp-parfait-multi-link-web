const EVENT_LABELS: ReadonlyMap<string, string> = new Map([
  ['first_open', '처음 앱 열기'],
  ['session_start', '앱 실행'],
  ['screen_view', '화면 조회'],
  ['user_engagement', '앱 사용'],
  ['app_update', '앱 업데이트'],
  ['app_remove', '앱 삭제'],
  ['os_update', 'OS 업데이트'],
  ['notification_receive', '알림 받음'],
  ['notification_open', '알림 열기'],
  ['app_exception', '앱 오류'],
])

export function eventLabel(name: string): { label: string; registered: boolean } {
  const label = EVENT_LABELS.get(name)
  return label === undefined ? { label: name, registered: false } : { label, registered: true }
}
