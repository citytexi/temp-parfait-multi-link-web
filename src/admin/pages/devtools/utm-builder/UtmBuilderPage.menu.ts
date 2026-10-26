import { Link2 } from 'lucide-react'
import { defineMenu } from '../../../menu/defineMenu'

export default defineMenu({
  id: 'utm-builder',
  group: 'devtools',
  order: 110,
  label: '캠페인 링크 만들기',
  description: '어디서 들어왔는지 알 수 있는 링크를 만들어요',
  icon: Link2,
  keywords: ['UTM', 'QR', '캠페인', '마케팅', '링크'],
  load: () => import('./UtmBuilderPage').then((m) => ({ default: m.UtmBuilderPage })),
  usesPeriod: false,
  usesGa: false,
})
