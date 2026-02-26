'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { SalarioForm, type SalarioFormData } from '@/components/financeiro/SalarioForm'
import { TransacaoForm, type TransacaoFormData } from '@/components/financeiro/TransacaoForm'
import { TipoTransacaoForm, type TipoTransacaoFormData } from '@/components/financeiro/TipoTransacaoForm'
import { SalarioChart } from '@/components/financeiro/SalarioChart'
import { ResumoMensal } from '@/components/financeiro/ResumoMensal'
import { useFinanceiro, type Salario, type SalarioAtual, type Transacao } from '@/hooks/useFinanceiro'
import { useTiposTransacao, type TipoTransacao } from '@/hooks/useTiposTransacao'
import { createClient } from '@/lib/supabase'
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
  BarChart3,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateStr
  }
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

  // Modal states
  const [salarioFormOpen, setSalarioFormOpen] = useState(false)
  const [salarioEditing, setSalarioEditing] = useState<Salario | null>(null)
  const [transacaoFormOpen, setTransacaoFormOpen] = useState(false)
  const [transacaoEditing, setTransacaoEditing] = useState<Transacao | null>(null)
  const [tipoFormOpen, setTipoFormOpen] = useState(false)

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

  // Handlers
  async function handleSalarioSubmit(data: SalarioFormData) {
    if (salarioEditing) {
      await updateSalario(salarioEditing.id, data)
    } else {
      await createSalario({ funcionario_id: id, ...data })
    }
    setSalarioEditing(null)
    const [salAtual, salHist] = await Promise.all([loadSalarioAtual(id), loadSalarios(id)])
    setSalarioAtual(salAtual)
    setSalarios(salHist)
  }

  async function handleDeleteSalario(salario: Salario) {
    if (salarios.length === 1) {
      const confirmed = window.confirm(
        'Este e o unico registro salarial. Tem certeza que deseja excluir?'
      )
      if (!confirmed) return
    } else {
      const confirmed = window.confirm('Tem certeza que deseja excluir este registro salarial?')
      if (!confirmed) return
    }

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
    const confirmed = window.confirm('Tem certeza que deseja excluir esta transacao?')
    if (!confirmed) return
    await deleteTransacao(transacao.id)
    loadTransacoesData()
  }

  async function handleTipoSubmit(data: TipoTransacaoFormData) {
    await createTipo(data)
    const tiposData = await loadTipos()
    setTipos(tiposData)
  }

  // Computed
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
            <button onClick={() => router.push('/funcionarios')} className="hover:text-cinza-preto transition-colors">
              Funcionarios
            </button>
            <span>/</span>
            <button onClick={() => router.push(`/funcionarios/${id}`)} className="hover:text-cinza-preto transition-colors">
              {nome}
            </button>
            <span>/</span>
            <span className="text-cinza-preto">Financeiro</span>
          </div>
          <h1 className="text-2xl font-bold text-cinza-preto">
            Painel Financeiro — {nome}
          </h1>
        </div>
        <Button variant="ghost" onClick={() => router.push(`/funcionarios/${id}`)}>
          <ArrowLeft size={16} /> Voltar para ficha
        </Button>
      </div>

      {/* Cards superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
            {salarioAtual ? formatDate(salarioAtual.data_vigencia) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Historico Salarial */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-cinza-preto">Historico Salarial</h3>
          <Button size="sm" onClick={() => { setSalarioEditing(null); setSalarioFormOpen(true) }}>
            <Plus size={16} /> Registrar Novo Salario
          </Button>
        </div>

        {salarios.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={48} />}
            title="Nenhum salario registrado"
            description="Registre o primeiro salario deste funcionario"
          />
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
                  <TableCell>{formatDate(s.data_vigencia)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.salario_bruto)}</TableCell>
                  <TableCell>{formatCurrency(s.salario_liquido)}</TableCell>
                  <TableCell>{formatCurrency(s.custo_funcionario)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.observacao || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setSalarioEditing(s); setSalarioFormOpen(true) }}
                        className="p-1.5 text-cinza-estrutural hover:text-azul transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteSalario(s)}
                        className="p-1.5 text-cinza-estrutural hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
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

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Mes/Ano</label>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            />
          </div>
          <Select
            label="Tipo"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            options={tipos.map((t) => ({ value: t.id, label: t.titulo }))}
            placeholder="Todos os tipos"
          />
          <Select
            label="Natureza"
            value={filtroNatureza}
            onChange={(e) => setFiltroNatureza(e.target.value)}
            options={[
              { value: 'Todos', label: 'Todos' },
              { value: 'Credito', label: 'Credito' },
              { value: 'Debito', label: 'Debito' },
            ]}
          />
        </div>

        {transacoes.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="Nenhuma transacao encontrada"
            description="Nenhuma transacao para o periodo selecionado"
          />
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
                  <TableCell>{formatDate(t.data)}</TableCell>
                  <TableCell>{t.tipo_titulo}</TableCell>
                  <TableCell>
                    <Badge variant={t.natureza === 'Credito' ? 'success' : 'danger'}>
                      {t.natureza}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(t.valor)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{t.descricao || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setTransacaoEditing(t); setTransacaoFormOpen(true) }}
                        className="p-1.5 text-cinza-estrutural hover:text-azul transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTransacao(t)}
                        className="p-1.5 text-cinza-estrutural hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
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

      {/* Modals */}
      <SalarioForm
        open={salarioFormOpen}
        onClose={() => { setSalarioFormOpen(false); setSalarioEditing(null) }}
        onSubmit={handleSalarioSubmit}
        initial={salarioEditing ? {
          id: salarioEditing.id,
          salario_bruto: salarioEditing.salario_bruto,
          salario_liquido: salarioEditing.salario_liquido,
          custo_funcionario: salarioEditing.custo_funcionario,
          data_vigencia: salarioEditing.data_vigencia,
          observacao: salarioEditing.observacao,
        } : undefined}
      />

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
