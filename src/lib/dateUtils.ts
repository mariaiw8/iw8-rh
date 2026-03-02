import { format, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function safeDate(value: unknown): Date | null {
  if (!value) return null
  const d = new Date(typeof value === 'string' && !String(value).includes('T') ? value + 'T00:00:00' : (value as string | number))
  return isNaN(d.getTime()) ? null : d
}

export function formatDateSafe(value: unknown, formatStr = 'dd/MM/yyyy'): string {
  const d = safeDate(value)
  if (!d) return '\u2014'
  return format(d, formatStr, { locale: ptBR })
}

export function safeDifferenceInDays(end: unknown, start: unknown): number {
  const endDate = safeDate(end)
  const startDate = safeDate(start)
  if (!endDate || !startDate) return 0
  return differenceInCalendarDays(endDate, startDate)
}
