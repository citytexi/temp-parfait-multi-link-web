import { ListChecks } from 'lucide-react'
import { defineMenu } from '../../../menu/defineMenu'

export default defineMenu({
  id: 'release-checklist',
  group: 'ops',
  order: 120,
  label: '릴리즈 체크리스트',
  description: '배포 전에 확인할 것을 빠짐없이 챙겨요',
  icon: ListChecks,
  keywords: ['배포', '출시', '릴리즈', '체크', 'QA'],
  load: () => import('./ReleaseChecklistPage').then((m) => ({ default: m.ReleaseChecklistPage })),
  usesPeriod: false,
  usesGa: false,
})
