'use client'

import { UserX } from 'lucide-react'

interface AbsenteismoCardProps {
  valor: number
}

export function AbsenteismoCard({ valor }: AbsenteismoCardProps) {
  const cor = valor < 2 ? 'text-green-500' : valor <= 4 ? 'text-amarelo' : 'text-red-500'
  const bgCor = valor < 2 ? 'bg-green-50' : valor <= 4 ? 'bg-yellow-50' : 'bg-red-50'
  const iconCor = valor < 2 ? 'bg-green-100' : valor <= 4 ? 'bg-yellow-100' : 'bg-red-100'

  return (
    <div className={`${bgCor} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Absenteismo</p>
        <div className={`w-10 h-10 rounded-lg ${iconCor} flex items-center justify-center`}>
          <UserX size={20} className={cor} />
        </div>
      </div>
      <p className={`text-3xl font-bold ${cor}`}>{valor}%</p>
      <p className="text-xs text-cinza-estrutural mt-1">no mes atual</p>
    </div>
  )
}
