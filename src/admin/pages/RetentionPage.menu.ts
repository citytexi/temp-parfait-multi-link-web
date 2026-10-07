import { Repeat } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'retention',
  group: 'metrics',
  order: 40,
  label: '다시 찾아온 사람',
  description: '처음 온 뒤에 다시 찾아온 비율을 봐요',
  icon: Repeat,
  keywords: ['리텐션', '재방문', 'retention'],
  load: () => import('./RetentionPage').then((m) => ({ default: m.RetentionPage })),
  usesPeriod: true,
  usesGa: true,
})
