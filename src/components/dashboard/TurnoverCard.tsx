'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

interface TurnoverCardProps {
  valor: number
  historico: { mes: string; valor: number }[]
}

export function TurnoverCard({ valor, historico }: TurnoverCardProps) {
  const cor = valor < 3 ? 'text-green-500' : valor <= 5 ? 'text-amarelo' : 'text-red-500'
  const bgCor = valor < 3 ? 'bg-green-50' : valor <= 5 ? 'bg-yellow-50' : 'bg-red-50'
  const iconCor = valor < 3 ? 'bg-green-100' : valor <= 5 ? 'bg-yellow-100' : 'bg-red-100'

  // Mini sparkline SVG
  const maxVal = Math.max(...historico.map((h) => h.valor), 1)
  const sparkWidth = 80
  const sparkHeight = 24
  const points = historico.map((h, i) => {
    const x = (i / Math.max(historico.length - 1, 1)) * sparkWidth
    const y = sparkHeight - (h.valor / maxVal) * sparkHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <div className={`${bgCor} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Rotatividade (Turnover)</p>
        <div className={`w-10 h-10 rounded-lg ${iconCor} flex items-center justify-center`}>
          {valor > 3 ? <TrendingUp size={20} className={cor} /> : <TrendingDown size={20} className={cor} />}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-3xl font-bold ${cor}`}>{valor}%</p>
          <p className="text-xs text-cinza-estrutural mt-1">no mes atual</p>
        </div>
        {historico.length > 1 && (
          <svg width={sparkWidth} height={sparkHeight} className="opacity-60">
            <polyline
              points={points}
              fill="none"
              stroke={valor < 3 ? '#22C55E' : valor <= 5 ? '#F5AF00' : '#EF4444'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}
