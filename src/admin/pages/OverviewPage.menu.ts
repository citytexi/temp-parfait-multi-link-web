import { LayoutDashboard } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'overview',
  group: 'metrics',
  order: 10,
  label: '한눈에 보기',
  description: '핵심 지표와 추이를 한 화면에서 봐요',
  icon: LayoutDashboard,
  keywords: ['요약', '대시보드', 'overview'],
  load: () => import('./OverviewPage').then((m) => ({ default: m.OverviewPage })),
  usesPeriod: true,
  usesGa: true,
})
