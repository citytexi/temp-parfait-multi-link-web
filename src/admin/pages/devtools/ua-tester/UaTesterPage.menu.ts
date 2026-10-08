import { Split } from 'lucide-react'
import { defineMenu } from '../../../menu/defineMenu'

export default defineMenu({
  id: 'ua-tester',
  group: 'devtools',
  order: 120,
  label: '랜딩 분기 테스트',
  description: '기기와 앱마다 랜딩이 어떻게 열리는지 확인해요',
  icon: Split,
  keywords: ['UA', 'user agent', '딥링크', '인앱', '랜딩'],
  load: () => import('./UaTesterPage').then((m) => ({ default: m.UaTesterPage })),
  usesPeriod: false,
  usesGa: false,
})
