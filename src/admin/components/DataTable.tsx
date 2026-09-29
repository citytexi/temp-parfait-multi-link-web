import type { ReactNode } from 'react'

type Column = { key: string; header: string; align?: 'left' | 'right' }

type DataTableProps = {
  columns: Column[]
  rows: Record<string, ReactNode>[]
  footnote?: string
}

export function DataTable({ columns, rows, footnote }: DataTableProps) {
  return (
    <div className="adm-table">
      <div className="adm-table__scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.align === 'right' ? 'adm-num' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'adm-num' : undefined}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="adm-table__footnote">{footnote}</p>}
    </div>
  )
}
