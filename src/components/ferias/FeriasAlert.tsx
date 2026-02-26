'use client'

import { AlertTriangle } from 'lucide-react'

interface FeriasAlertProps {
  alertCount: number
  vencidaCount: number
}

export function FeriasAlert({ alertCount, vencidaCount }: FeriasAlertProps) {
  const total = alertCount + vencidaCount

  if (total === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-medium text-cinza-estrutural mb-1">Alertas</p>
        <p className="text-2xl font-bold text-green-600">0</p>
        <p className="text-xs text-green-600 mt-1">Tudo em dia</p>
      </div>
    )
  }

  return (
    <div className={`border rounded-xl p-4 ${vencidaCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className={vencidaCount > 0 ? 'text-red-500' : 'text-amber-500'} />
        <p className="text-xs font-medium text-cinza-estrutural">Alertas</p>
      </div>
      <p className={`text-2xl font-bold ${vencidaCount > 0 ? 'text-red-600' : 'text-amber-600'}`}>{total}</p>
      <div className="text-xs mt-1 space-y-0.5">
        {vencidaCount > 0 && (
          <p className="text-red-600">{vencidaCount} periodo{vencidaCount > 1 ? 's' : ''} vencido{vencidaCount > 1 ? 's' : ''}</p>
        )}
        {alertCount > 0 && (
          <p className="text-amber-600">{alertCount} em alerta</p>
        )}
      </div>
    </div>
  )
}
