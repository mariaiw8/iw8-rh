import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function safeDate(value: unknown): Date | null {
  if (!value) return null
  const str = typeof value === 'string' ? value : String(value)
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

export function formatDateSafe(value: unknown, formatStr = 'dd/MM/yyyy'): string {
  const d = safeDate(value)
  if (!d) return '\u2014'
  return format(d, formatStr, { locale: ptBR })
}
