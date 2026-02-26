'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { type Salario } from '@/hooks/useFinanceiro'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SalarioChartProps {
  salarios: Salario[]
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function SalarioChart({ salarios }: SalarioChartProps) {
  if (salarios.length < 2) return null

  // Sort ascending for chart display
  const chartData = [...salarios]
    .sort((a, b) => a.data_vigencia.localeCompare(b.data_vigencia))
    .map((s) => ({
      data: format(new Date(s.data_vigencia + 'T00:00:00'), 'MMM/yyyy', { locale: ptBR }),
      'Salario Bruto': s.salario_bruto,
      'Salario Liquido': s.salario_liquido || 0,
    }))

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-cinza-preto mb-4">Evolucao Salarial</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="data" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Salario Bruto"
              stroke="#E57B25"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Salario Liquido"
              stroke="#154766"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
