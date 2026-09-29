import { useId } from 'react'
import { resolveRanges, type Period, type PresetId } from '../lib/period'

const PRESETS: readonly { id: PresetId; label: string }[] = [
  { id: '7d', label: '최근 7일' },
  { id: '28d', label: '최근 28일' },
  { id: '90d', label: '최근 90일' },
]

type PeriodFilterProps = {
  period: Period
  /** Seoul today (YYYY-MM-DD); date inputs allow up to the day before. */
  today: string
  /** Validation message for an invalid custom period, shown next to the inputs. */
  error: string | null
  onChange(period: Period): void
}

export function PeriodFilter({ period, today, error, onChange }: PeriodFilterProps) {
  const id = useId()
  const yesterday = resolveRanges({ kind: 'preset', preset: '7d' }, today).current.endDate
  const isCustom = period.kind === 'custom'

  const startCustom = () => {
    if (isCustom) return
    const { current } = resolveRanges(period, today)
    onChange({ kind: 'custom', start: current.startDate, end: current.endDate })
  }

  const changeDate = (field: 'start' | 'end', value: string) => {
    // An emptied date input keeps the last valid date instead of producing an unusable period.
    if (period.kind !== 'custom' || value === '') return
    onChange({ ...period, [field]: value })
  }

  return (
    <div className="adm-period">
      <div className="adm-period__presets" role="group" aria-label="기간">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="adm-period__preset"
            aria-pressed={period.kind === 'preset' && period.preset === p.id}
            onClick={() => onChange({ kind: 'preset', preset: p.id })}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="adm-period__preset" aria-pressed={isCustom} onClick={startCustom}>
          직접 선택
        </button>
      </div>
      {period.kind === 'custom' && (
        <div className="adm-period__custom">
          <label className="adm-period__field" htmlFor={`${id}-start`}>
            <span>시작일</span>
            <input
              id={`${id}-start`}
              type="date"
              className="adm-period__date"
              value={period.start}
              max={yesterday}
              aria-invalid={error ? true : undefined}
              onChange={(e) => changeDate('start', e.target.value)}
            />
          </label>
          <label className="adm-period__field" htmlFor={`${id}-end`}>
            <span>종료일</span>
            <input
              id={`${id}-end`}
              type="date"
              className="adm-period__date"
              value={period.end}
              max={yesterday}
              aria-invalid={error ? true : undefined}
              onChange={(e) => changeDate('end', e.target.value)}
            />
          </label>
          {error && (
            <p className="adm-period__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
