'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Building2, TrendingUp, PieChart as PieIcon } from 'lucide-react'

const COLORS = ['#E57B25', '#154766', '#F5AF00', '#4D85B3', '#22C55E', '#EF4444', '#8B5CF6', '#06B6D4']

interface SetorData {
  nome: string
  funcionarios: number
}

interface AdmissaoDesligamento {
  mes: string
  admissoes: number
  desligamentos: number
}

interface OcorrenciaCategoria {
  categoria: string
  total: number
}

export function SetoreChart() {
  const supabase = createClient()
  const [data, setData] = useState<SetorData[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: resumo } = await supabase
      .from('vw_resumo_setores')
      .select('setor, num_funcionarios')
      .order('num_funcionarios', { ascending: false })
      .limit(10)

    if (resumo) {
      setData(resumo.map((r: Record<string, unknown>) => ({
        nome: ((r.setor || r.titulo) as string)?.length > 15 ? ((r.setor || r.titulo) as string).slice(0, 15) + '...' : ((r.setor || r.titulo) as string),
        funcionarios: (r.num_funcionarios || 0) as number,
      })))
    }
  }

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-azul-medio" />
            Distribuicao por Setor
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              formatter={(value) => [`${value} funcionarios`, 'Total']}
            />
            <Bar dataKey="funcionarios" fill="#154766" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function AdmissoesChart() {
  const supabase = createClient()
  const [data, setData] = useState<AdmissaoDesligamento[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const now = new Date()
    const meses: AdmissaoDesligamento[] = []

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mesLabel = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
      const inicio = d.toISOString().split('T')[0]
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]

      meses.push({ mes: mesLabel, admissoes: 0, desligamentos: 0 })

      const [admRes, desRes] = await Promise.all([
        supabase.from('funcionarios').select('id', { count: 'exact', head: true }).gte('data_admissao', inicio).lte('data_admissao', fim),
        supabase.from('funcionarios').select('id', { count: 'exact', head: true }).gte('data_desligamento', inicio).lte('data_desligamento', fim),
      ])

      meses[meses.length - 1].admissoes = admRes.count || 0
      meses[meses.length - 1].desligamentos = desRes.count || 0
    }

    setData(meses)
  }

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-500" />
            Admissoes vs Desligamentos (12 meses)
          </div>
        </CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 20 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="admissoes" stroke="#22C55E" strokeWidth={2} name="Admissoes" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="desligamentos" stroke="#EF4444" strokeWidth={2} name="Desligamentos" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function OcorrenciasChart() {
  const supabase = createClient()
  const [data, setData] = useState<OcorrenciaCategoria[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const now = new Date()
    const inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: ocorrencias } = await supabase
      .from('ocorrencias')
      .select('tipo_ocorrencia_id, tipos_ocorrencia:tipo_ocorrencia_id(categoria)')
      .gte('data_inicio', inicio)
      .lte('data_inicio', fim)

    if (ocorrencias) {
      const counts: Record<string, number> = {}
      ocorrencias.forEach((o: Record<string, unknown>) => {
        const tipo = o.tipos_ocorrencia as Record<string, string> | null
        const cat = tipo?.categoria || 'Outro'
        counts[cat] = (counts[cat] || 0) + 1
      })
      setData(Object.entries(counts).map(([categoria, total]) => ({ categoria, total })))
    }
  }

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <PieIcon size={18} className="text-laranja" />
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
              outerRadius={80}
              innerRadius={40}
              label={(props) => `${props.name}: ${props.value}`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
