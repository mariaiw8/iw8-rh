'use client'

import { Clock } from 'lucide-react'

interface TempoEmpresaCardProps {
  tempo: string
}

export function TempoEmpresaCard({ tempo }: TempoEmpresaCardProps) {
  return (
    <div className="bg-blue-50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Tempo Medio de Empresa</p>
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Clock size={20} className="text-azul-medio" />
        </div>
      </div>
      <p className="text-2xl font-bold text-azul-medio">{tempo}</p>
      <p className="text-xs text-cinza-estrutural mt-1">media dos funcionarios ativos</p>
    </div>
  )
}
