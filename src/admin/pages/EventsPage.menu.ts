import { MousePointerClick } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'events',
  group: 'metrics',
  order: 30,
  label: '많이 한 행동',
  description: '앱에서 많이 한 행동을 순서대로 봐요',
  icon: MousePointerClick,
  keywords: ['이벤트', '행동', 'events'],
  load: () => import('./EventsPage').then((m) => ({ default: m.EventsPage })),
  usesPeriod: true,
  usesGa: true,
})
