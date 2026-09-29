import { downloadCsv, toCsv } from '../lib/csv'

type CsvButtonProps = {
  filename: string
  headers: string[]
  rows: (string | number)[][]
}

export function CsvButton({ filename, headers, rows }: CsvButtonProps) {
  return (
    <button
      type="button"
      className="adm-button adm-button--ghost"
      onClick={() => downloadCsv(filename, toCsv(headers, rows))}
    >
      CSV 받기
    </button>
  )
}
