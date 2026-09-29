import { useQuota } from '../hooks/useGa'

export function QuotaBadge() {
  const quota = useQuota()
  if (quota === null) return null
  return <p className="adm-quota">오늘 조회 가능량 {quota}% 남음</p>
}
