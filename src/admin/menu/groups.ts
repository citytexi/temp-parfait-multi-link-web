import type { GroupId } from './defineMenu'

// Display order of the sidebar groups.
export const GROUPS: readonly { id: GroupId; label: string }[] = [
  { id: 'metrics', label: '지표' },
  { id: 'devtools', label: '개발자 도구' },
  { id: 'ops', label: '팀 운영' },
]
