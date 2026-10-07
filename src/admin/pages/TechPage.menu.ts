import { Smartphone } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'tech',
  group: 'metrics',
  order: 50,
  label: '기기·지역',
  description: '어떤 기기와 지역에서 쓰는지 봐요',
  icon: Smartphone,
  keywords: ['플랫폼', '국가', '버전', 'tech'],
  load: () => import('./TechPage').then((m) => ({ default: m.TechPage })),
  usesPeriod: true,
  usesGa: true,
})
