import { Bookmark } from 'lucide-react'
import { defineMenu } from '../../../menu/defineMenu'

export default defineMenu({
  id: 'link-hub',
  group: 'ops',
  order: 110,
  label: '바로가기',
  description: '자주 쓰는 콘솔과 문서를 한곳에서 열어요',
  icon: Bookmark,
  keywords: ['링크', 'Firebase', 'Play Console', 'App Store', '콘솔'],
  load: () => import('./LinkHubPage').then((m) => ({ default: m.LinkHubPage })),
  usesPeriod: false,
  usesGa: false,
})
