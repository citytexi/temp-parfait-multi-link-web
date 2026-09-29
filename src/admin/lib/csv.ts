// Spreadsheets run a cell starting with one of these as a formula (CSV injection).
const FORMULA_START = /^[=+\-@]/

function escapeCell(value: string | number): string {
  const s = typeof value === 'string' && FORMULA_START.test(value) ? `'${value}` : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','))
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
