import { Users } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'users',
  group: 'metrics',
  order: 20,
  label: '사용자',
  description: '새로 온 사람과 다시 온 사람을 봐요',
  icon: Users,
  keywords: ['사용자', '신규', '재방문', 'users'],
  load: () => import('./UsersPage').then((m) => ({ default: m.UsersPage })),
  usesPeriod: true,
  usesGa: true,
})
