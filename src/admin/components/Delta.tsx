import type { Delta } from '../lib/format'

export function DeltaText({ delta }: { delta: Delta }) {
  return <span className={`adm-delta adm-delta--${delta.tone}`}>{delta.text}</span>
}
