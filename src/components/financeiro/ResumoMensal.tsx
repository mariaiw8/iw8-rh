'use client'

import { type Transacao } from '@/hooks/useFinanceiro'

interface ResumoMensalProps {
  transacoes: Transacao[]
  mesLabel: string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ResumoMensal({ transacoes, mesLabel }: ResumoMensalProps) {
  const creditos = transacoes
    .filter((t) => t.natureza === 'Credito')
    .reduce((sum, t) => sum + t.valor, 0)

  const debitos = transacoes
    .filter((t) => t.natureza === 'Debito')
    .reduce((sum, t) => sum + t.valor, 0)

  const saldo = creditos - debitos
  const isPositivo = saldo >= 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-cinza-preto mb-1">Resumo Mensal</h3>
      <p className="text-xs text-cinza-estrutural mb-4">{mesLabel}</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-cinza-estrutural">Total Creditos</span>
          <span className="text-sm font-semibold text-green-600">{formatCurrency(creditos)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-cinza-estrutural">Total Debitos</span>
          <span className="text-sm font-semibold text-red-600">- {formatCurrency(debitos)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-cinza-preto">Saldo</span>
            <span className={`text-lg font-bold ${isPositivo ? 'text-green-600' : 'text-red-600'}`}>
              {isPositivo ? '' : '- '}{formatCurrency(Math.abs(saldo))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
