import { Activity } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'realtime',
  group: 'metrics',
  order: 60,
  label: '지금 접속 중',
  description: '지금 앱을 쓰고 있는 사람을 봐요',
  icon: Activity,
  keywords: ['실시간', 'realtime'],
  load: () => import('./RealtimePage').then((m) => ({ default: m.RealtimePage })),
  usesPeriod: false,
  usesGa: true,
})
