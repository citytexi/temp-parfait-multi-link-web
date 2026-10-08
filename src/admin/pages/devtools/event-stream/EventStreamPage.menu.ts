import { Radio } from 'lucide-react'
import { defineMenu } from '../../../menu/defineMenu'

export default defineMenu({
  id: 'event-stream',
  group: 'devtools',
  order: 210,
  label: '실시간 이벤트',
  description: '방금 들어온 이벤트를 바로 확인해요',
  icon: Radio,
  keywords: ['QA', '디버그', 'debugview', 'realtime', '스트림'],
  load: () => import('./EventStreamPage').then((m) => ({ default: m.EventStreamPage })),
  usesPeriod: false,
  usesGa: false,
})
