'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface ExportColumn {
  key: string
  header: string
  format?: (value: unknown) => string
}

interface ExportButtonProps {
  data: Record<string, unknown>[]
  columns: ExportColumn[]
  filename: string
  className?: string
}

export function ExportButton({ data, columns, filename, className = '' }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function exportCSV() {
    const headers = columns.map((c) => c.header).join(',')
    const rows = data.map((row) =>
      columns.map((col) => {
        const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')
        // Escape CSV values
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return val
      }).join(',')
    )
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })

    const { saveAs } = await import('file-saver')
    saveAs(blob, `${filename}.csv`)
    setOpen(false)
  }

  async function exportXLSX() {
    const XLSX = await import('xlsx')
    const { saveAs } = await import('file-saver')

    const wsData = [
      columns.map((c) => c.header),
      ...data.map((row) =>
        columns.map((col) => {
          if (col.format) return col.format(row[col.key])
          return row[col.key] ?? ''
        })
      ),
    ]

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Auto-width columns
    const colWidths = columns.map((col, i) => {
      const maxLen = Math.max(
        col.header.length,
        ...data.map((row) => {
          const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')
          return val.length
        })
      )
      return { wch: Math.min(maxLen + 2, 40) }
    })
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `${filename}.xlsx`)
    setOpen(false)
  }

  if (data.length === 0) return null

  return (
    <div ref={ref} className={`relative ${className}`}>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        <Download size={14} /> Exportar
      </Button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
          <button
            onClick={exportCSV}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-cinza-preto hover:bg-gray-50 transition-colors"
          >
            <FileText size={16} className="text-cinza-estrutural" />
            Exportar CSV
          </button>
          <button
            onClick={exportXLSX}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-cinza-preto hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600" />
            Exportar Excel
          </button>
        </div>
      )}
    </div>
  )
}
