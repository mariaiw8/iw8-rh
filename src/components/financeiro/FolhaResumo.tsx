'use client'

import { DollarSign, Users, Wallet, TrendingUp } from 'lucide-react'
import { type FolhaResumo as FolhaResumoType } from '@/hooks/useFolha'

interface FolhaResumoCardsProps {
  resumo: FolhaResumoType
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function FolhaResumoCards({ resumo }: FolhaResumoCardsProps) {
  const cards = [
    {
      title: 'Folha Bruta Total',
      value: formatCurrency(resumo.totalBruto),
      icon: <DollarSign size={24} />,
      color: 'text-laranja',
    },
    {
      title: 'Folha Liquida Total',
      value: formatCurrency(resumo.totalLiquido),
      icon: <Wallet size={24} />,
      color: 'text-azul',
    },
    {
      title: 'Custo Total',
      value: formatCurrency(resumo.custoTotal),
      icon: <TrendingUp size={24} />,
      color: 'text-amber-500',
    },
    {
      title: 'Funcionarios Ativos',
      value: resumo.totalFuncionarios.toString(),
      icon: <Users size={24} />,
      color: 'text-green-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-cinza-estrutural">{card.title}</p>
            <div className={card.color}>{card.icon}</div>
          </div>
          <p className="text-2xl font-bold text-cinza-preto">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
