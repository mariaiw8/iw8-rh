'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { TrendingUp, Users, Building2, Clock, ClipboardList } from 'lucide-react'

const CATEGORIA_COLORS: Record<string, string> = {
  'Ausência': '#4D85B3',
  'Disciplinar': '#F5AF00',
  'Remuneração': '#E57B25',
  'Benefício': '#22C55E',
  'Outro': '#9CA3AF',
}

const SETOR_TIPO_COLORS: Record<string, string> = {
  'Escritório': '#4D85B3',
  'Escritorio': '#4D85B3',
  'Produção': '#E57B25',
  'Producao': '#E57B25',
}

const FAIXA_COLORS = ['#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8']

// Chart 1 - Rotatividade Mensal (últimos 12 meses)
export function TurnoverChart({ data }: { data: { mes: string; valor: number }[] }) {
  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-laranja" />
            Rotatividade Mensal
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 20, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              formatter={(value) => [`${value}%`, 'Rotatividade']}
            />
            <Bar dataKey="valor" fill="#E57B25" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// Chart 2 - Evolução do Quadro (Headcount)
export function HeadcountChart({ data }: { data: { mes: string; total: number }[] }) {
  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-azul-medio" />
            Evolucao do Quadro (Headcount)
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="headcountGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4D85B3" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4D85B3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              formatter={(value) => [`${value} funcionarios`, 'Total']}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#4D85B3"
              strokeWidth={2}
              fill="url(#headcountGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// Chart 3 - Distribuição por Tipo de Setor
export function SetorTipoChart({ data }: { data: { tipo: string; funcionarios: number }[] }) {
  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-azul-medio" />
            Distribuicao por Tipo de Setor
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="funcionarios"
              nameKey="tipo"
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={45}
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SETOR_TIPO_COLORS[entry.tipo] || ['#4D85B3', '#E57B25', '#F5AF00', '#22C55E'][index % 4]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// Chart 4 - Tempo de Empresa (Faixas)
export function TempoEmpresaChart({ data }: { data: { faixa: string; funcionarios: number }[] }) {
  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-azul-medio" />
            Tempo de Empresa (Faixas)
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey="faixa" tick={{ fontSize: 11 }} width={80} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              formatter={(value) => [`${value} funcionarios`, 'Total']}
            />
            <Bar dataKey="funcionarios" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={FAIXA_COLORS[index % FAIXA_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// Chart 5 - Ocorrências por Categoria (mês atual)
export function OcorrenciasCategoriaChart({ data }: { data: { categoria: string; total: number }[] }) {
  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-laranja" />
            Ocorrencias por Categoria (Mes Atual)
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="categoria"
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={45}
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORIA_COLORS[entry.categoria] || ['#4D85B3', '#F5AF00', '#E57B25', '#22C55E', '#9CA3AF'][index % 5]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
