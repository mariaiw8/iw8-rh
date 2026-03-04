'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase'
import { formatDateSafe } from '@/lib/dateUtils'
import type { FeriasComFuncionario, FeriasStatus, FeriasPeriodoSaldo } from '@/types/ferias'
import {
  getAllFerias,
  atualizarStatusFerias,
  deletarFerias,
  getStatusFeriasConfig,
  formatarData,
  calcularDiasCorridos,
} from '@/lib/ferias-service'
import {
  Plus, AlertTriangle, Calendar, Users, Search, X, Filter,
  Play, CheckCircle, XCircle, Trash2, ThumbsUp, Clock,
  TrendingUp, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

type TabId = 'ativas' | 'historico' | 'alertas'

interface Filtros {
  busca: string
  status: string
  tipo: string
  dataInicio: string
  dataFim: string
  unidade_id: string
}

const STATUS_ATIVOS: FeriasStatus[] = ['Programada', 'Aprovada', 'Em Andamento']
const STATUS_HISTORICO: FeriasStatus[] = ['Concluída', 'Cancelada']

export default function FeriasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('ativas')
  const [todasFerias, setTodasFerias] = useState<FeriasComFuncionario[]>([])
  const [alertas, setAlertas] = useState<AlertaVencimento[]>([])
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])

  // Filters
  const [filtros, setFiltros] = useState<Filtros>({
    busca: '',
    status: '',
    tipo: '',
    dataInicio: '',
    dataFim: '',
    unidade_id: '',
  })

  // Coletivas modal
  const [showColetivasModal, setShowColetivasModal] = useState(false)
  const [coletivasForm, setColetivasForm] = useState({
    data_inicio: '',
    data_fim: '',
    dias: 0,
    unidade_id: '',
    setor_id: '',
    observacao: '',
  })
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])
  const [coletivasSubmitting, setColetivasSubmitting] = useState(false)
  const [coletivasResult, setColetivasResult] = useState<{ sucesso: number; falha: number; erros: string[] } | null>(null)

  // Historico year filter
  const [anoHistorico, setAnoHistorico] = useState(new Date().getFullYear().toString())

  // ─── DATA LOADING ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ferData, alertData, uniData] = await Promise.all([
        getAllFerias({
          status: filtros.status || undefined,
          tipo: filtros.tipo || undefined,
          unidade_id: filtros.unidade_id || undefined,
          dataInicio: filtros.dataInicio || undefined,
          dataFim: filtros.dataFim || undefined,
        }),
        loadAlertasVencimento(),
        supabase.from('unidades').select('id, titulo').order('titulo'),
      ])
      setTodasFerias(ferData)
      setAlertas(alertData)
      setUnidades(uniData.data || [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      toast.error('Erro ao carregar dados de ferias')
    } finally {
      setLoading(false)
    }
  }, [filtros.status, filtros.tipo, filtros.unidade_id, filtros.dataInicio, filtros.dataFim])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load setores when coletivas modal opens
  useEffect(() => {
    if (showColetivasModal) {
      loadSetores()
    }
  }, [showColetivasModal])

  // Auto-calc dias in coletivas form
  useEffect(() => {
    if (coletivasForm.data_inicio && coletivasForm.data_fim) {
      const dias = calcularDiasCorridos(coletivasForm.data_inicio, coletivasForm.data_fim)
      setColetivasForm(prev => ({ ...prev, dias: dias > 0 ? dias : 0 }))
    }
  }, [coletivasForm.data_inicio, coletivasForm.data_fim])

  async function loadSetores() {
    const { data } = await supabase.from('setores').select('id, titulo, unidade_id').order('titulo')
    setSetores(data || [])
  }

  async function loadAlertasVencimento(): Promise<AlertaVencimento[]> {
    const { data, error } = await supabase
      .from('v_ferias_periodos_saldo')
      .select('*, funcionarios:funcionario_id(nome_completo, codigo, unidade_id, unidades:unidade_id(titulo))')
      .in('status_calculado', ['Disponível', 'Parcial'])
      .gt('dias_restantes', 0)
      .order('data_vencimento', { ascending: true })

    if (error) {
      console.error('Erro ao carregar alertas:', error)
      return []
    }

    const hoje = new Date()
    return (data || []).map((p: any) => {
      const venc = new Date(p.data_vencimento + 'T00:00:00')
      const diffMs = venc.getTime() - hoje.getTime()
      const diasParaVencer = Math.ceil(diffMs / 86400000)
      let urgencia: AlertaVencimento['urgencia'] = 'normal'
      if (diasParaVencer < 0) urgencia = 'vencido'
      else if (diasParaVencer <= 30) urgencia = 'critico'
      else if (diasParaVencer <= 60) urgencia = 'atencao'

      return {
        id: p.id,
        funcionario_id: p.funcionario_id,
        nome_completo: p.funcionarios?.nome_completo || 'Sem nome',
        codigo: p.funcionarios?.codigo || '',
        unidade: p.funcionarios?.unidades?.titulo || '',
        aquisitivo_inicio: p.aquisitivo_inicio,
        aquisitivo_fim: p.aquisitivo_fim,
        data_vencimento: p.data_vencimento,
        dias_restantes: p.dias_restantes,
        dias_para_vencer: diasParaVencer,
        urgencia,
      }
    })
  }

  // ─── FILTERED DATA ───────────────────────────────────────────────────────

  const feriasFiltradas = useMemo(() => {
    let items = todasFerias
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase()
      items = items.filter(f =>
        f.funcionarios?.nome_completo?.toLowerCase().includes(q) ||
        f.funcionarios?.codigo?.toLowerCase().includes(q)
      )
    }
    if (filtros.unidade_id) {
      items = items.filter(f => f.funcionarios?.unidade_id === filtros.unidade_id)
    }
    return items
  }, [todasFerias, filtros.busca, filtros.unidade_id])

  const feriasAtivas = useMemo(
    () => feriasFiltradas.filter(f => STATUS_ATIVOS.includes(f.status as FeriasStatus)),
    [feriasFiltradas]
  )

  const feriasHistorico = useMemo(() => {
    const hist = feriasFiltradas.filter(f => STATUS_HISTORICO.includes(f.status as FeriasStatus))
    if (anoHistorico) {
      return hist.filter(f => f.data_inicio?.startsWith(anoHistorico))
    }
    return hist
  }, [feriasFiltradas, anoHistorico])

  const alertasFiltrados = useMemo(() => {
    let items = alertas
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase()
      items = items.filter(a =>
        a.nome_completo.toLowerCase().includes(q) ||
        a.codigo?.toLowerCase().includes(q)
      )
    }
    if (filtros.unidade_id) {
      items = items.filter(a => {
        const fer = todasFerias.find(f => f.funcionario_id === a.funcionario_id)
        return fer?.funcionarios?.unidade_id === filtros.unidade_id
      })
    }
    return items
  }, [alertas, filtros.busca, filtros.unidade_id, todasFerias])

  // ─── SUMMARY CARDS ───────────────────────────────────────────────────────

  const resumo = useMemo(() => {
    const emAndamento = todasFerias.filter(f => f.status === 'Em Andamento').length
    const aprovadas = todasFerias.filter(f => f.status === 'Aprovada').length
    const programadas = todasFerias.filter(f => f.status === 'Programada').length
    const vencendo60 = alertas.filter(a => a.urgencia !== 'normal').length
    return { emAndamento, aprovadas, programadas, vencendo60 }
  }, [todasFerias, alertas])

  // ─── ACTION HANDLERS ─────────────────────────────────────────────────────

  async function handleAtualizarStatus(feriasId: string, novoStatus: 'Aprovada' | 'Em Andamento' | 'Concluída' | 'Cancelada') {
    try {
      await atualizarStatusFerias(feriasId, novoStatus)
      toast.success(`Status atualizado para ${novoStatus}`)
      loadData()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      toast.error('Erro ao atualizar status')
    }
  }

  async function handleDeletarFerias(feriasId: string) {
    if (!confirm('Deseja excluir estas ferias? Somente ferias com status "Programada" podem ser excluidas.')) return
    try {
      await deletarFerias(feriasId)
      toast.success('Ferias excluidas')
      loadData()
    } catch (err) {
      console.error('Erro ao excluir ferias:', err)
      toast.error('Erro ao excluir ferias')
    }
  }

  function limparFiltros() {
    setFiltros({ busca: '', status: '', tipo: '', dataInicio: '', dataFim: '', unidade_id: '' })
  }

  // ─── COLETIVAS HANDLER ───────────────────────────────────────────────────

  async function handleCriarColetivas(e: React.FormEvent) {
    e.preventDefault()
    if (!coletivasForm.data_inicio || !coletivasForm.data_fim) return
    setColetivasSubmitting(true)
    setColetivasResult(null)

    try {
      // 1. Find employees matching the unit/sector filter
      let query = supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('status', 'Ativo')
      if (coletivasForm.unidade_id) query = query.eq('unidade_id', coletivasForm.unidade_id)
      if (coletivasForm.setor_id) query = query.eq('setor_id', coletivasForm.setor_id)

      const { data: funcs } = await query
      if (!funcs || funcs.length === 0) {
        toast.error('Nenhum funcionario encontrado para os filtros selecionados')
        setColetivasSubmitting(false)
        return
      }

      // 2. Create individual férias for each employee
      let sucesso = 0
      let falha = 0
      const erros: string[] = []

      for (const func of funcs) {
        try {
          const { error } = await supabase
            .from('ferias')
            .insert({
              funcionario_id: func.id,
              data_inicio: coletivasForm.data_inicio,
              data_fim: coletivasForm.data_fim,
              dias: coletivasForm.dias,
              tipo: 'Coletiva',
              status: 'Programada',
              abono_pecuniario: false,
              dias_vendidos: 0,
              observacao: coletivasForm.observacao || null,
            })
          if (error) {
            falha++
            erros.push(`${func.nome_completo}: ${error.message}`)
          } else {
            sucesso++
          }
        } catch {
          falha++
          erros.push(`${func.nome_completo}: Erro inesperado`)
        }
      }

      // 3. Also register in ferias_coletivas table for tracking
      await supabase.from('ferias_coletivas').insert({
        titulo: `Ferias Coletivas ${formatDateSafe(coletivasForm.data_inicio)} a ${formatDateSafe(coletivasForm.data_fim)}`,
        data_inicio: coletivasForm.data_inicio,
        data_fim: coletivasForm.data_fim,
        dias: coletivasForm.dias,
        unidade_id: coletivasForm.unidade_id || null,
        setor_id: coletivasForm.setor_id || null,
        observacao: coletivasForm.observacao || null,
      })

      setColetivasResult({ sucesso, falha, erros })
      if (sucesso > 0) {
        toast.success(`${sucesso} ferias coletivas criadas com sucesso`)
        loadData()
      }
    } catch (err) {
      console.error('Erro ao criar ferias coletivas:', err)
      toast.error('Erro ao criar ferias coletivas')
    } finally {
      setColetivasSubmitting(false)
    }
  }

  function closeColetivasModal() {
    setShowColetivasModal(false)
    setColetivasForm({ data_inicio: '', data_fim: '', dias: 0, unidade_id: '', setor_id: '', observacao: '' })
    setColetivasResult(null)
  }

  const filteredSetores = coletivasForm.unidade_id
    ? setores.filter(s => s.unidade_id === coletivasForm.unidade_id)
    : setores

  // ─── RENDER HELPERS ──────────────────────────────────────────────────────

  function renderStatusBadge(status: string) {
    const cfg = getStatusFeriasConfig(status)
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.textColor} ${cfg.bgColor} ${cfg.borderColor}`}>
        {cfg.label}
      </span>
    )
  }

  function renderActionButtons(f: FeriasComFuncionario) {
    const btns: React.ReactNode[] = []
    switch (f.status) {
      case 'Programada':
        btns.push(
          <button key="aprovar" onClick={() => handleAtualizarStatus(f.id, 'Aprovada')} className="text-laranja hover:bg-orange-50 p-1.5 rounded" title="Aprovar">
            <ThumbsUp size={15} />
          </button>,
          <button key="excluir" onClick={() => handleDeletarFerias(f.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Excluir">
            <Trash2 size={15} />
          </button>
        )
        break
      case 'Aprovada':
        btns.push(
          <button key="iniciar" onClick={() => handleAtualizarStatus(f.id, 'Em Andamento')} className="text-azul-medio hover:bg-blue-50 p-1.5 rounded" title="Iniciar">
            <Play size={15} />
          </button>,
          <button key="cancelar" onClick={() => handleAtualizarStatus(f.id, 'Cancelada')} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Cancelar">
            <XCircle size={15} />
          </button>
        )
        break
      case 'Em Andamento':
        btns.push(
          <button key="concluir" onClick={() => handleAtualizarStatus(f.id, 'Concluída')} className="text-green-600 hover:bg-green-50 p-1.5 rounded" title="Concluir">
            <CheckCircle size={15} />
          </button>
        )
        break
    }
    return <div className="flex items-center gap-1">{btns}</div>
  }

  // ─── URGENCY HELPERS ─────────────────────────────────────────────────────

  function getUrgenciaConfig(urgencia: AlertaVencimento['urgencia']) {
    switch (urgencia) {
      case 'vencido':  return { label: 'Vencido',  bgColor: 'bg-red-100',    textColor: 'text-red-700',    borderColor: 'border-red-200',    rowBg: 'bg-red-50'    }
      case 'critico':  return { label: 'Critico',   bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200', rowBg: 'bg-orange-50' }
      case 'atencao':  return { label: 'Atencao',   bgColor: 'bg-amber-100',  textColor: 'text-amber-700',  borderColor: 'border-amber-200',  rowBg: 'bg-amber-50'  }
      default:         return { label: 'Normal',    bgColor: 'bg-green-100',  textColor: 'text-green-700',  borderColor: 'border-green-200',  rowBg: ''             }
    }
  }

  // ─── YEARS FOR HISTORICO ─────────────────────────────────────────────────

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>()
    todasFerias
      .filter(f => STATUS_HISTORICO.includes(f.status as FeriasStatus))
      .forEach(f => {
        if (f.data_inicio) anos.add(f.data_inicio.substring(0, 4))
      })
    const arr = Array.from(anos).sort().reverse()
    if (arr.length === 0) arr.push(new Date().getFullYear().toString())
    return arr
  }, [todasFerias])

  // ─── LOADING STATE ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </PageContainer>
    )
  }

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────

  return (
    <PageContainer>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Ferias</h2>
        <Button onClick={() => setShowColetivasModal(true)}>
          <Users size={16} /> Registrar Ferias Coletivas
        </Button>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="col-span-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou codigo..."
                  value={filtros.busca}
                  onChange={e => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
                />
              </div>
            </div>

            <Select
              value={filtros.status}
              onChange={e => setFiltros(prev => ({ ...prev, status: e.target.value }))}
              options={[
                { value: 'Programada', label: 'Programada' },
                { value: 'Aprovada', label: 'Aprovada' },
                { value: 'Em Andamento', label: 'Em Andamento' },
                { value: 'Concluída', label: 'Concluida' },
                { value: 'Cancelada', label: 'Cancelada' },
              ]}
              placeholder="Status"
            />

            <Select
              value={filtros.tipo}
              onChange={e => setFiltros(prev => ({ ...prev, tipo: e.target.value }))}
              options={[
                { value: 'Individual', label: 'Individual' },
                { value: 'Coletiva', label: 'Coletiva' },
              ]}
              placeholder="Tipo"
            />

            <Select
              value={filtros.unidade_id}
              onChange={e => setFiltros(prev => ({ ...prev, unidade_id: e.target.value }))}
              options={unidades.map(u => ({ value: u.id, label: u.titulo }))}
              placeholder="Unidade"
            />

            <button
              onClick={limparFiltros}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-cinza-estrutural hover:text-cinza-preto hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
            >
              <X size={14} /> Limpar
            </button>
          </div>

          {/* Date range row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
            <Input
              type="date"
              value={filtros.dataInicio}
              onChange={e => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
              placeholder="Data inicio"
            />
            <Input
              type="date"
              value={filtros.dataFim}
              onChange={e => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
              placeholder="Data fim"
            />
          </div>
        </div>
      </Card>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
            <Play size={14} />
            Em Andamento
          </div>
          <div className="text-2xl font-bold text-blue-700">{resumo.emAndamento}</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
          <div className="flex items-center gap-2 text-sm text-laranja mb-1">
            <ThumbsUp size={14} />
            Aprovadas
          </div>
          <div className="text-2xl font-bold text-laranja">{resumo.aprovadas}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Calendar size={14} />
            Programadas
          </div>
          <div className="text-2xl font-bold text-gray-700">{resumo.programadas}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
            <AlertTriangle size={14} />
            Vencendo em 60 dias
          </div>
          <div className="text-2xl font-bold text-red-700">{resumo.vencendo60}</div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {([
            { id: 'ativas' as TabId, label: 'Ferias Programadas e Ativas', count: feriasAtivas.length },
            { id: 'historico' as TabId, label: 'Historico', count: feriasHistorico.length },
            { id: 'alertas' as TabId, label: 'Alertas de Vencimento', count: alertasFiltrados.filter(a => a.urgencia !== 'normal').length },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-laranja text-laranja'
                  : 'border-transparent text-cinza-estrutural hover:text-cinza-preto'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  tab === t.id ? 'bg-orange-100 text-laranja' : 'bg-gray-100 text-gray-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Ativas ──────────────────────────────────────────────── */}
      {tab === 'ativas' && (
        <Card>
          {feriasAtivas.length === 0 ? (
            <EmptyState
              icon={<Calendar size={40} />}
              title="Nenhuma ferias ativa"
              description="Nao ha ferias programadas, aprovadas ou em andamento"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Funcionario</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Acoes</TableHead>
              </TableHeader>
              <TableBody>
                {feriasAtivas.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/funcionarios/${f.funcionario_id}?tab=ferias`}
                        className="text-azul hover:text-laranja hover:underline"
                      >
                        {f.funcionarios?.nome_completo || '—'}
                      </Link>
                    </TableCell>
                    <TableCell>{f.funcionarios?.codigo || '—'}</TableCell>
                    <TableCell>{f.funcionarios?.unidades?.titulo || '—'}</TableCell>
                    <TableCell>{formatarData(f.data_inicio)}</TableCell>
                    <TableCell>{formatarData(f.data_fim)}</TableCell>
                    <TableCell>{f.dias}</TableCell>
                    <TableCell>
                      <Badge variant={f.tipo === 'Coletiva' ? 'info' : 'neutral'}>{f.tipo}</Badge>
                    </TableCell>
                    <TableCell>{renderStatusBadge(f.status)}</TableCell>
                    <TableCell>{renderActionButtons(f)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Tab: Historico ───────────────────────────────────────────── */}
      {tab === 'historico' && (
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <span className="text-sm text-cinza-estrutural">Ano:</span>
            <Select
              value={anoHistorico}
              onChange={e => setAnoHistorico(e.target.value)}
              options={anosDisponiveis.map(a => ({ value: a, label: a }))}
              placeholder="Todos"
            />
          </div>
          {feriasHistorico.length === 0 ? (
            <EmptyState
              icon={<Clock size={40} />}
              title="Nenhum registro"
              description="Nenhuma ferias concluida ou cancelada encontrada"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Funcionario</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
              </TableHeader>
              <TableBody>
                {feriasHistorico.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/funcionarios/${f.funcionario_id}?tab=ferias`}
                        className="text-azul hover:text-laranja hover:underline"
                      >
                        {f.funcionarios?.nome_completo || '—'}
                      </Link>
                    </TableCell>
                    <TableCell>{f.funcionarios?.codigo || '—'}</TableCell>
                    <TableCell>{f.funcionarios?.unidades?.titulo || '—'}</TableCell>
                    <TableCell>{formatarData(f.data_inicio)}</TableCell>
                    <TableCell>{formatarData(f.data_fim)}</TableCell>
                    <TableCell>{f.dias}</TableCell>
                    <TableCell>
                      <Badge variant={f.tipo === 'Coletiva' ? 'info' : 'neutral'}>{f.tipo}</Badge>
                    </TableCell>
                    <TableCell>{renderStatusBadge(f.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Tab: Alertas de Vencimento ───────────────────────────────── */}
      {tab === 'alertas' && (
        <Card>
          {alertasFiltrados.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={40} />}
              title="Nenhum alerta"
              description="Todos os periodos de ferias estao em dia"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Funcionario</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Periodo Aquisitivo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Dias p/ Vencer</TableHead>
                <TableHead>Dias Restantes</TableHead>
                <TableHead>Urgencia</TableHead>
              </TableHeader>
              <TableBody>
                {alertasFiltrados.map(a => {
                  const urg = getUrgenciaConfig(a.urgencia)
                  return (
                    <TableRow key={a.id} className={urg.rowBg}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/funcionarios/${a.funcionario_id}?tab=ferias`}
                          className="text-azul hover:text-laranja hover:underline"
                        >
                          {a.nome_completo}
                        </Link>
                      </TableCell>
                      <TableCell>{a.codigo || '—'}</TableCell>
                      <TableCell>{a.unidade || '—'}</TableCell>
                      <TableCell>
                        {formatarData(a.aquisitivo_inicio)} a {formatarData(a.aquisitivo_fim)}
                      </TableCell>
                      <TableCell>{formatarData(a.data_vencimento)}</TableCell>
                      <TableCell>
                        {a.dias_para_vencer < 0
                          ? <span className="text-red-600 font-medium">{Math.abs(a.dias_para_vencer)} dias atrasado</span>
                          : <span className={a.dias_para_vencer <= 30 ? 'text-orange-600 font-medium' : ''}>{a.dias_para_vencer} dias</span>
                        }
                      </TableCell>
                      <TableCell>{a.dias_restantes} dias</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${urg.textColor} ${urg.bgColor} ${urg.borderColor}`}>
                          {urg.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Modal: Ferias Coletivas ──────────────────────────────────── */}
      <Modal open={showColetivasModal} onClose={closeColetivasModal} title="Registrar Ferias Coletivas" size="lg">
        {coletivasResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{coletivasResult.sucesso}</div>
                <div className="text-sm text-green-600">Ferias criadas</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-700">{coletivasResult.falha}</div>
                <div className="text-sm text-red-600">Falhas</div>
              </div>
            </div>
            {coletivasResult.erros.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-red-700 mb-2">Erros:</p>
                {coletivasResult.erros.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={closeColetivasModal}>Fechar</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCriarColetivas} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              Serao criadas ferias individuais (tipo "Coletiva") para todos os funcionarios ativos da unidade/setor selecionado.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data Inicio *"
                type="date"
                value={coletivasForm.data_inicio}
                onChange={e => setColetivasForm(prev => ({ ...prev, data_inicio: e.target.value }))}
              />
              <Input
                label="Data Fim *"
                type="date"
                value={coletivasForm.data_fim}
                onChange={e => setColetivasForm(prev => ({ ...prev, data_fim: e.target.value }))}
              />
            </div>

            <Input
              label="Dias"
              type="number"
              value={coletivasForm.dias.toString()}
              disabled
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Unidade"
                value={coletivasForm.unidade_id}
                onChange={e => setColetivasForm(prev => ({ ...prev, unidade_id: e.target.value, setor_id: '' }))}
                options={unidades.map(u => ({ value: u.id, label: u.titulo }))}
                placeholder="Todas"
              />
              <Select
                label="Setor"
                value={coletivasForm.setor_id}
                onChange={e => setColetivasForm(prev => ({ ...prev, setor_id: e.target.value }))}
                options={filteredSetores.map(s => ({ value: s.id, label: s.titulo }))}
                placeholder="Todos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
              <textarea
                value={coletivasForm.observacao}
                onChange={e => setColetivasForm(prev => ({ ...prev, observacao: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeColetivasModal}>Cancelar</Button>
              <Button type="submit" disabled={coletivasSubmitting || !coletivasForm.data_inicio || !coletivasForm.data_fim}>
                {coletivasSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Criando...</>
                ) : (
                  'Criar Ferias Coletivas'
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </PageContainer>
  )
}

// ─── LOCAL TYPES ─────────────────────────────────────────────────────────────

interface AlertaVencimento {
  id: string
  funcionario_id: string
  nome_completo: string
  codigo: string
  unidade: string
  aquisitivo_inicio: string
  aquisitivo_fim: string
  data_vencimento: string
  dias_restantes: number
  dias_para_vencer: number
  urgencia: 'vencido' | 'critico' | 'atencao' | 'normal'
}
