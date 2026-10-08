import { BookOpenText } from 'lucide-react'
import { defineMenu } from '../../../menu/defineMenu'

export default defineMenu({
  id: 'event-dictionary',
  group: 'devtools',
  order: 220,
  label: '이벤트 사전',
  description: '이벤트의 뜻과 파라미터를 찾아봐요',
  icon: BookOpenText,
  keywords: ['이벤트', '파라미터', '정의', '미등록', 'dictionary'],
  load: () => import('./EventDictionaryPage').then((m) => ({ default: m.EventDictionaryPage })),
  usesPeriod: true,
  usesGa: true,
})
