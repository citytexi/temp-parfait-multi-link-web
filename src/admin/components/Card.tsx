import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'

type CardProps = {
  title: string
  /** Original (English/GA) term shown small next to the plain-Korean title, e.g. 'DAU'. */
  subtitle?: string
  info?: string
  action?: ReactNode
  children?: ReactNode
}

export function CardHeader({ title, subtitle, info, action }: Omit<CardProps, 'children'>) {
  return (
    <header className="adm-card__header">
      <div className="adm-card__heading">
        <h2 className="adm-card__title">{title}</h2>
        {subtitle && <span className="adm-card__subtitle">{subtitle}</span>}
        {info && <InfoTip text={info} />}
      </div>
      {action && <div className="adm-card__action">{action}</div>}
    </header>
  )
}

export function Card({ children, ...header }: CardProps) {
  return (
    <section className="adm-card">
      <CardHeader {...header} />
      <div className="adm-card__body">{children}</div>
    </section>
  )
}
