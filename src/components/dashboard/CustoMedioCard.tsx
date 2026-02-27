'use client'

import { DollarSign } from 'lucide-react'

interface CustoMedioCardProps {
  valor: number
}

export function CustoMedioCard({ valor }: CustoMedioCardProps) {
  const formatted = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="bg-orange-50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Custo Medio por Funcionario</p>
        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
          <DollarSign size={20} className="text-laranja" />
        </div>
      </div>
      <p className="text-2xl font-bold text-laranja">{formatted}</p>
      <p className="text-xs text-cinza-estrutural mt-1">custo total / funcionarios ativos</p>
    </div>
  )
}
