'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { SalarioChart } from '@/components/financeiro/SalarioChart'
import { ResumoMensal } from '@/components/financeiro/ResumoMensal'
import { useFinanceiro, type Salario, type SalarioAtual, type Transacao } from '@/hooks/useFinanceiro'
import { useTiposTransacao, type TipoTransacao } from '@/hooks/useTiposTransacao'
import { TransacaoForm, type TransacaoFormData } from '@/components/financeiro/TransacaoForm'
import { TipoTransacaoForm, type TipoTransacaoFormData } from '@/components/financeiro/TipoTransacaoForm'
import { createClient } from '@/lib/supabase'
import { formatDateSafe } from '@/lib/dateUtils'
import {
  ArrowLeft,
  DollarSign,
  Wallet,
  TrendingUp,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Clock,
  AlertCircle,
  Save,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Types for new data
interface ValoresFuncionario {
  valor_dia: number
  valor_hora: number
  valor_hora_extra: number
}

interface OcorrenciaFinanceira {
  id: string
  funcionario_id: string
  nome_completo: string
  codigo: string
  unidade: string
  setor: string
  tipo_ocorrencia: string
  categoria: string
  natureza_financeira: string
  base_calculo: number
  data_inicio: string
  data_fim: string
  dias: number
  horas: number
  valor: number
  descricao: string
  observacao: string
  created_at: string
}

export default function FinanceiroFuncionarioPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const {
    loadSalarios,
    loadSalarioAtual,
    createSalario,
    updateSalario,
    deleteSalario,
    loadTransacoes,
    createTransacao,
    updateTransacao,
    deleteTransacao,
  } = useFinanceiro()

  const { loadTipos, createTipo } = useTiposTransacao()

  // State
  const [loading, setLoading] = useState(true)
  const [funcionario, setFuncionario] = useState<Record<string, unknown> | null>(null)
  const [salarioAtual, setSalarioAtual] = useState<SalarioAtual | null>(null)
  const [salarios, setSalarios] = useState<Salario[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [tipos, setTipos] = useState<TipoTransacao[]>([])

  // New state: valores calculados
  const [valoresFuncionario, setValoresFuncionario] = useState<ValoresFuncionario | null>(null)

  // New state: ocorrencias financeiras
  const [ocorrenciasFinanceiras, setOcorrenciasFinanceiras] = useState<OcorrenciaFinanceira[]>([])

  // Modal states
  const [salarioFormOpen, setSalarioFormOpen] = useState(false)
  const [salarioEditing, setSalarioEditing] = useState<Salario | null>(null)
  const [transacaoFormOpen, setTransacaoFormOpen] = useState(false)
  const [transacaoEditing, setTransacaoEditing] = useState<Transacao | null>(null)
  const [tipoFormOpen, setTipoFormOpen] = useState(false)

  // Enhanced Salary Form state
  const [salFormData, setSalFormData] = useState({
    salario_bruto: '',
    adicional_insalubridade: '',
    adicional_pagamento: '',
    vale_alimentacao: '',
    desconto_sindicato: '',
    data_vigencia: '',
    observacao: '',
  })
  const [salFormSubmitting, setSalFormSubmitting] = useState(false)

  // Filters
  const [filtroMes, setFiltroMes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroNatureza, setFiltroNatureza] = useState('Todos')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [funcRes, salAtual, salHist, tiposData] = await Promise.all([
        supabase.from('funcionarios').select('id, nome_completo, codigo').eq('id', id).single(),
        loadSalarioAtual(id),
        loadSalarios(id),
        loadTipos(),
      ])

      if (funcRes.error) {
        toast.error('Funcionario nao encontrado')
        router.push('/funcionarios')
        return
      }

      setFuncionario(funcRes.data)
      setSalarioAtual(salAtual)
      setSalarios(salHist)
      setTipos(tiposData)

      // Load calculated values via RPC
      try {
        const { data: valData, error: valError } = await supabase.rpc('fn_valores_funcionario', { p_funcionario_id: id })
        if (!valError && valData) {
          const row = Array.isArray(valData) ? valData[0] : valData
          if (row) {
            setValoresFuncionario({
              valor_dia: row.valor_dia || 0,
              valor_hora: row.valor_hora || 0,
              valor_hora_extra: row.valor_hora_extra || 0,
            })
          }
        }
      } catch {
        // RPC may not exist yet
      }

      // Load financial occurrences
      try {
        const { data: ocData, error: ocError } = await supabase
          .from('vw_ocorrencias_financeiras')
          .select('*')
          .eq('funcionario_id', id)
        if (!ocError && ocData) {
          setOcorrenciasFinanceiras(ocData as OcorrenciaFinanceira[])
        }
      } catch {
        // View may not exist yet
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadTransacoesData = useCallback(async () => {
    const [year, month] = filtroMes.split('-').map(Number)
    const dataInicio = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const dataFim = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const data = await loadTransacoes(id, {
      data_inicio: dataInicio,
      data_fim: dataFim,
      tipo_transacao_id: filtroTipo || undefined,
      natureza: filtroNatureza,
    })
    setTransacoes(data)
  }, [id, filtroMes, filtroTipo, filtroNatureza])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!loading) {
      loadTransacoesData()
    }
  }, [loadTransacoesData, loading])

  // Enhanced salary form handlers
  function openSalarioForm(salario?: Salario) {
    if (salario) {
      setSalarioEditing(salario)
      setSalFormData({
        salario_bruto: String(salario.salario_bruto || ''),
        adicional_insalubridade: '',
        adicional_pagamento: '',
        vale_alimentacao: '',
        desconto_sindicato: '',
        data_vigencia: salario.data_vigencia || '',
        observacao: salario.observacao || '',
      })
    } else {
      setSalarioEditing(null)
      setSalFormData({
        salario_bruto: '',
        adicional_insalubridade: '',
        adicional_pagamento: '',
        vale_alimentacao: '',
        desconto_sindicato: '',
        data_vigencia: '',
        observacao: '',
      })
    }
    setSalarioFormOpen(true)
  }

  async function handleSalarioSubmit(e: React.FormEvent) {
    e.preventDefault()
    const bruto = parseFloat(salFormData.salario_bruto)
    if (!bruto || !salFormData.data_vigencia) return
    setSalFormSubmitting(true)
    try {
      const insalubridade = parseFloat(salFormData.adicional_insalubridade) || 0
      const adicionalPgto = parseFloat(salFormData.adicional_pagamento) || 0
      const vale = parseFloat(salFormData.vale_alimentacao) || 0
      const sindicato = parseFloat(salFormData.desconto_sindicato) || 0
      const liquido = bruto + insalubridade + adicionalPgto - vale - sindicato

      const payload = {
        salario_bruto: bruto,
        salario_liquido: liquido > 0 ? liquido : null,
        custo_funcionario: bruto + insalubridade + adicionalPgto,
        data_vigencia: salFormData.data_vigencia,
        observacao: salFormData.observacao || null,
      }

      if (salarioEditing) {
        await updateSalario(salarioEditing.id, payload)
      } else {
        await createSalario({ funcionario_id: id, ...payload })
      }

      setSalarioFormOpen(false)
      setSalarioEditing(null)
      const [salAtual, salHist] = await Promise.all([loadSalarioAtual(id), loadSalarios(id)])
      setSalarioAtual(salAtual)
      setSalarios(salHist)
    } finally {
      setSalFormSubmitting(false)
    }
  }

  async function handleDeleteSalario(salario: Salario) {
    const msg = salarios.length === 1
      ? 'Este e o unico registro salarial. Tem certeza que deseja excluir?'
      : 'Tem certeza que deseja excluir este registro salarial?'
    if (!window.confirm(msg)) return

    await deleteSalario(salario.id)
    const [salAtual, salHist] = await Promise.all([loadSalarioAtual(id), loadSalarios(id)])
    setSalarioAtual(salAtual)
    setSalarios(salHist)
  }

  async function handleTransacaoSubmit(data: TransacaoFormData) {
    if (transacaoEditing) {
      await updateTransacao(transacaoEditing.id, data)
    } else {
      await createTransacao({ funcionario_id: id, ...data })
    }
    setTransacaoEditing(null)
    loadTransacoesData()
  }

  async function handleDeleteTransacao(transacao: Transacao) {
    if (!window.confirm('Tem certeza que deseja excluir esta transacao?')) return
    await deleteTransacao(transacao.id)
    loadTransacoesData()
  }

  async function handleTipoSubmit(data: TipoTransacaoFormData) {
    await createTipo(data)
    const tiposData = await loadTipos()
    setTipos(tiposData)
  }

  // Computed insalubridade auto-calc
  function handleInsalubridadeChange(value: string) {
    setSalFormData((prev) => {
      // If it looks like a percentage (e.g. "40" and bruto is set), auto-calc
      const pct = parseFloat(value)
      const bruto = parseFloat(prev.salario_bruto)
      if (!isNaN(pct) && !isNaN(bruto) && pct > 0 && pct <= 100) {
        // Store calculated value
        return { ...prev, adicional_insalubridade: String((bruto * pct / 100).toFixed(2)) }
      }
      return { ...prev, adicional_insalubridade: value }
    })
  }

  const mesLabel = (() => {
    const [year, month] = filtroMes.split('-').map(Number)
    const d = new Date(year, month - 1, 1)
    return format(d, 'MMMM yyyy', { locale: ptBR })
  })()

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={5} />
        </div>
      </PageContainer>
    )
  }

  if (!funcionario) return null

  const nome = funcionario.nome_completo as string

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-cinza-estrutural mb-1">
            <button onClick={() => router.push('/funcionarios')} className="hover:text-cinza-preto transition-colors">Funcionarios</button>
            <span>/</span>
            <button onClick={() => router.push(`/funcionarios/${id}`)} className="hover:text-cinza-preto transition-colors">{nome}</button>
            <span>/</span>
            <span className="text-cinza-preto">Financeiro</span>
          </div>
          <h1 className="text-2xl font-bold text-cinza-preto">Painel Financeiro — {nome}</h1>
        </div>
        <Button variant="ghost" onClick={() => router.push(`/funcionarios/${id}`)}>
          <ArrowLeft size={16} /> Voltar para ficha
        </Button>
      </div>

      {/* Cards superiores - Salario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-cinza-estrutural">Salario Bruto Atual</p>
            <DollarSign size={20} className="text-laranja" />
          </div>
          <p className="text-2xl font-bold text-cinza-preto">
            {salarioAtual ? formatCurrency(salarioAtual.salario_bruto) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-cinza-estrutural">Salario Liquido Atual</p>
            <Wallet size={20} className="text-azul" />
          </div>
          <p className="text-2xl font-bold text-cinza-preto">
            {salarioAtual ? formatCurrency(salarioAtual.salario_liquido) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-cinza-estrutural">Custo Total</p>
            <TrendingUp size={20} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-cinza-preto">
            {salarioAtual ? formatCurrency(salarioAtual.custo_funcionario) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-cinza-estrutural">Vigencia desde</p>
            <Calendar size={20} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-cinza-preto">
            {salarioAtual ? formatDateSafe(salarioAtual.data_vigencia) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Cards - Valores Calculados (TAREFA 2a) */}
      {valoresFuncionario && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-laranja">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-cinza-estrutural">Valor Dia de Trabalho</p>
              <Calendar size={20} className="text-laranja" />
            </div>
            <p className="text-2xl font-bold text-cinza-preto">{formatCurrency(valoresFuncionario.valor_dia)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-azul">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-cinza-estrutural">Valor Hora de Trabalho</p>
              <Clock size={20} className="text-azul" />
            </div>
            <p className="text-2xl font-bold text-cinza-preto">{formatCurrency(valoresFuncionario.valor_hora)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-cinza-estrutural">Valor Hora Extra</p>
              <TrendingUp size={20} className="text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-cinza-preto">{formatCurrency(valoresFuncionario.valor_hora_extra)}</p>
          </div>
        </div>
      )}

      {/* Ocorrencias Financeiras (TAREFA 2b) */}
      {ocorrenciasFinanceiras.length > 0 && (
        <Card className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className="text-laranja" />
            <h3 className="text-lg font-bold text-cinza-preto">Ocorrencias com Impacto Financeiro</h3>
            <Badge variant="neutral">{ocorrenciasFinanceiras.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Natureza</TableHead>
              <TableHead>Data Inicio</TableHead>
              <TableHead>Data Fim</TableHead>
              <TableHead className="text-center">Dias</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Descricao</TableHead>
            </TableHeader>
            <TableBody>
              {ocorrenciasFinanceiras.map((oc) => (
                <TableRow key={oc.id}>
                  <TableCell className="font-medium">{oc.tipo_ocorrencia || '-'}</TableCell>
                  <TableCell>{oc.categoria || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={oc.natureza_financeira === 'Credito' ? 'success' : oc.natureza_financeira === 'Debito' ? 'danger' : 'neutral'}>
                      {oc.natureza_financeira || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateSafe(oc.data_inicio)}</TableCell>
                  <TableCell>{formatDateSafe(oc.data_fim)}</TableCell>
                  <TableCell className="text-center">{oc.dias || '-'}</TableCell>
                  <TableCell className={`font-medium ${oc.natureza_financeira === 'Credito' ? 'text-green-700' : oc.natureza_financeira === 'Debito' ? 'text-red-600' : ''}`}>
                    {formatCurrency(oc.valor)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{oc.descricao || oc.observacao || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Historico Salarial */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-cinza-preto">Historico Salarial</h3>
          <Button size="sm" onClick={() => openSalarioForm()}>
            <Plus size={16} /> Registrar Novo Salario
          </Button>
        </div>

        {salarios.length === 0 ? (
          <EmptyState icon={<DollarSign size={48} />} title="Nenhum salario registrado" description="Registre o primeiro salario deste funcionario" />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Data Vigencia</TableHead>
              <TableHead>Salario Bruto</TableHead>
              <TableHead>Salario Liquido</TableHead>
              <TableHead>Custo Funcionario</TableHead>
              <TableHead>Observacao</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableHeader>
            <TableBody>
              {salarios.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDateSafe(s.data_vigencia)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.salario_bruto)}</TableCell>
                  <TableCell>{formatCurrency(s.salario_liquido)}</TableCell>
                  <TableCell>{formatCurrency(s.custo_funcionario)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.observacao || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openSalarioForm(s)} className="p-1.5 text-cinza-estrutural hover:text-azul transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteSalario(s)} className="p-1.5 text-cinza-estrutural hover:text-red-500 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Grafico Evolucao Salarial */}
      {salarios.length >= 2 && (
        <div className="mb-8">
          <SalarioChart salarios={salarios} />
        </div>
      )}

      {/* Transacoes */}
      <Card className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-cinza-preto">Transacoes</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setTipoFormOpen(true)}>
              <Plus size={14} /> Tipo
            </Button>
            <Button size="sm" onClick={() => { setTransacaoEditing(null); setTransacaoFormOpen(true) }}>
              <Plus size={16} /> Adicionar Transacao
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Mes/Ano</label>
            <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent" />
          </div>
          <Select label="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} options={tipos.map((t) => ({ value: t.id, label: t.titulo }))} placeholder="Todos os tipos" />
          <Select label="Natureza" value={filtroNatureza} onChange={(e) => setFiltroNatureza(e.target.value)} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Credito', label: 'Credito' }, { value: 'Debito', label: 'Debito' }]} />
        </div>

        {transacoes.length === 0 ? (
          <EmptyState icon={<FileText size={48} />} title="Nenhuma transacao encontrada" description="Nenhuma transacao para o periodo selecionado" />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Natureza</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableHeader>
            <TableBody>
              {transacoes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateSafe(t.data)}</TableCell>
                  <TableCell>{t.tipo_titulo}</TableCell>
                  <TableCell>
                    <Badge variant={t.natureza === 'Credito' ? 'success' : 'danger'}>{t.natureza}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(t.valor)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{t.descricao || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setTransacaoEditing(t); setTransacaoFormOpen(true) }} className="p-1.5 text-cinza-estrutural hover:text-azul transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteTransacao(t)} className="p-1.5 text-cinza-estrutural hover:text-red-500 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Resumo Mensal */}
      <div className="mb-8">
        <ResumoMensal transacoes={transacoes} mesLabel={mesLabel} />
      </div>

      {/* Modal: Novo Salario (TAREFA 2c - Enhanced) */}
      <Modal open={salarioFormOpen} onClose={() => { setSalarioFormOpen(false); setSalarioEditing(null) }} title={salarioEditing ? 'Editar Salario' : 'Registrar Novo Salario'} size="lg">
        <form onSubmit={handleSalarioSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Salario Bruto * (R$)"
              type="number"
              step="0.01"
              value={salFormData.salario_bruto}
              onChange={(e) => setSalFormData((prev) => ({ ...prev, salario_bruto: e.target.value }))}
              placeholder="0.00"
            />
            <div>
              <label className="block text-sm font-medium text-cinza-preto mb-1">Adicional Insalubridade (R$)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={salFormData.adicional_insalubridade}
                  onChange={(e) => setSalFormData((prev) => ({ ...prev, adicional_insalubridade: e.target.value }))}
                  placeholder="Valor ou calc. automatico"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
                />
                {salFormData.salario_bruto && (
                  <div className="flex gap-1">
                    {[20, 40].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const bruto = parseFloat(salFormData.salario_bruto)
                          if (!isNaN(bruto)) {
                            setSalFormData((prev) => ({ ...prev, adicional_insalubridade: String((bruto * pct / 100).toFixed(2)) }))
                          }
                        }}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-cinza-estrutural"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Adicional Pagamento (R$)"
              type="number"
              step="0.01"
              value={salFormData.adicional_pagamento}
              onChange={(e) => setSalFormData((prev) => ({ ...prev, adicional_pagamento: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Vale Alimentacao (R$)"
              type="number"
              step="0.01"
              value={salFormData.vale_alimentacao}
              onChange={(e) => setSalFormData((prev) => ({ ...prev, vale_alimentacao: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Desconto Sindicato (R$)"
              type="number"
              step="0.01"
              value={salFormData.desconto_sindicato}
              onChange={(e) => setSalFormData((prev) => ({ ...prev, desconto_sindicato: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Data Vigencia *"
              type="date"
              value={salFormData.data_vigencia}
              onChange={(e) => setSalFormData((prev) => ({ ...prev, data_vigencia: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
            <textarea
              value={salFormData.observacao}
              onChange={(e) => setSalFormData((prev) => ({ ...prev, observacao: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setSalarioFormOpen(false); setSalarioEditing(null) }}>Cancelar</Button>
            <Button type="submit" disabled={salFormSubmitting || !salFormData.salario_bruto || !salFormData.data_vigencia}>
              <Save size={14} /> {salFormSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Other Modals */}
      <TransacaoForm
        open={transacaoFormOpen}
        onClose={() => { setTransacaoFormOpen(false); setTransacaoEditing(null) }}
        onSubmit={handleTransacaoSubmit}
        tipos={tipos}
        initial={transacaoEditing ? {
          id: transacaoEditing.id,
          tipo_transacao_id: transacaoEditing.tipo_transacao_id,
          valor: transacaoEditing.valor,
          data: transacaoEditing.data,
          descricao: transacaoEditing.descricao,
        } : undefined}
      />

      <TipoTransacaoForm
        open={tipoFormOpen}
        onClose={() => setTipoFormOpen(false)}
        onSubmit={handleTipoSubmit}
      />
    </PageContainer>
  )
}
