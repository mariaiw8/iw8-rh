'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { PrintButton } from '@/components/ui/PrintButton'
import { ExportButton, ExportColumn } from '@/components/relatorios/ExportButton'
import { ReportCard } from '@/components/relatorios/ReportCard'
import { useRelatorios } from '@/hooks/useRelatorios'
import { usePagination } from '@/hooks/usePagination'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import {
  Users, CalendarClock, Calendar, ClipboardList,
  DollarSign, Cake, BarChart3, ArrowLeft, FileBarChart, Search, AlertTriangle,
} from 'lucide-react'

type ReportType = 'lista' | 'ferias-vencer' | 'programacao-ferias' | 'ocorrencias' | 'folha' | 'aniversariantes' | 'resumo' | 'absenteismo' | null

function formatDate(d: string) {
  if (!d) return '-'
  try {
    return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy')
  } catch {
    return d
  }
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Absenteismo types
interface AbsenteismoMensal {
  ano: number
  mes: number
  total_dias_ausentes: number
  total_ocorrencias: number
  total_funcionarios: number
  taxa_absenteismo: number
}

interface AbsenteismoDetalhe {
  funcionario_id: string
  nome: string
  setor: string
  unidade: string
  total_dias: number
  total_ocorrencias: number
  taxa: number
}

export default function RelatoriosPage() {
  const [activeReport, setActiveReport] = useState<ReportType>(null)
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const supabase = createClient()
  const relatorios = useRelatorios()

  // Filter states
  const [unidades, setUnidades] = useState<{ value: string; label: string }[]>([])
  const [setores, setSetores] = useState<{ value: string; label: string }[]>([])
  const [funcoes, setFuncoes] = useState<{ value: string; label: string }[]>([])
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroSetor, setFiltroSetor] = useState('')
  const [filtroFuncao, setFiltroFuncao] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1))
  const [searchTerm, setSearchTerm] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Absenteismo specific state
  const [absenteismoMensal, setAbsenteismoMensal] = useState<AbsenteismoMensal[]>([])
  const [absenteismoResumo, setAbsenteismoResumo] = useState<{ taxa: number; funcionarios: number; diasPerdidos: number } | null>(null)
  const [absenteismoDetalhe, setAbsenteismoDetalhe] = useState<AbsenteismoDetalhe[]>([])

  const filteredData = data.filter((row) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return Object.values(row).some((v) =>
      String(v ?? '').toLowerCase().includes(term)
    )
  })

  const pagination = usePagination(filteredData, { pageSize: 20 })

  useEffect(() => {
    loadCadastros()
  }, [])

  async function loadCadastros() {
    const [uniRes, setRes, funcRes] = await Promise.all([
      supabase.from('unidades').select('id, titulo').order('titulo'),
      supabase.from('setores').select('id, titulo').order('titulo'),
      supabase.from('funcoes').select('id, titulo').order('titulo'),
    ])
    setUnidades((uniRes.data || []).map((u) => ({ value: u.id, label: u.titulo })))
    setSetores((setRes.data || []).map((s) => ({ value: s.id, label: s.titulo })))
    setFuncoes((funcRes.data || []).map((f) => ({ value: f.id, label: f.titulo })))
  }

  function resetFilters() {
    setFiltroUnidade('')
    setFiltroSetor('')
    setFiltroFuncao('')
    setFiltroSituacao('')
    setFiltroStatus('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setSearchTerm('')
    pagination.resetPage()
  }

  async function loadReport(type: ReportType) {
    if (!type) return
    setReportLoading(true)
    setData([])
    pagination.resetPage()

    try {
      switch (type) {
        case 'lista': {
          const result = await relatorios.loadFuncionariosAtivos({
            unidade_id: filtroUnidade || undefined,
            setor_id: filtroSetor || undefined,
            funcao_id: filtroFuncao || undefined,
          })
          setData(result as unknown as Record<string, unknown>[])
          break
        }
        case 'ferias-vencer': {
          const result = await relatorios.loadFeriasAVencer({
            situacao: filtroSituacao || undefined,
            unidade_id: filtroUnidade || undefined,
          })
          setData(result as unknown as Record<string, unknown>[])
          break
        }
        case 'programacao-ferias': {
          const result = await relatorios.loadProgramacaoFerias({
            data_inicio: filtroDataInicio || undefined,
            data_fim: filtroDataFim || undefined,
            unidade_id: filtroUnidade || undefined,
            status: filtroStatus || undefined,
          })
          setData(result as unknown as Record<string, unknown>[])
          break
        }
        case 'ocorrencias': {
          const result = await relatorios.loadOcorrencias({
            data_inicio: filtroDataInicio || undefined,
            data_fim: filtroDataFim || undefined,
          })
          setData(result as unknown as Record<string, unknown>[])
          break
        }
        case 'folha': {
          const result = await relatorios.loadFolhaPagamento({
            unidade_id: filtroUnidade || undefined,
            setor_id: filtroSetor || undefined,
          })
          setData(result as unknown as Record<string, unknown>[])
          break
        }
        case 'aniversariantes': {
          const result = await relatorios.loadAniversariantes(parseInt(filtroMes))
          setData(result as unknown as Record<string, unknown>[])
          break
        }
        case 'resumo': {
          const result = await relatorios.loadResumoIndicadores({
            data_inicio: filtroDataInicio || `${new Date().getFullYear()}-01-01`,
            data_fim: filtroDataFim || new Date().toISOString().split('T')[0],
          })
          setData([result as unknown as Record<string, unknown>])
          break
        }
        case 'absenteismo': {
          await loadAbsenteismoReport()
          break
        }
      }
    } catch (err) {
      console.error('Erro ao carregar relatorio:', err)
    } finally {
      setReportLoading(false)
    }
  }

  async function loadAbsenteismoReport() {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // Try loading monthly data from vw_absenteismo_mensal
    const { data: mensal, error: mensalError } = await supabase
      .from('vw_absenteismo_mensal')
      .select('*')
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(12)

    let mensalData: AbsenteismoMensal[] = []
    if (!mensalError && mensal) {
      mensalData = mensal as AbsenteismoMensal[]
    } else {
      // Fallback: compute monthly absenteismo from ocorrencias
      const { data: totalAtivos } = await supabase.from('funcionarios').select('id', { count: 'exact', head: true }).eq('status', 'Ativo')
      const totalFunc = totalAtivos?.length || (totalAtivos as unknown as { count: number })?.count || 1

      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1)
        const ano = d.getFullYear()
        const mes = d.getMonth() + 1
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
        const lastDay = new Date(ano, mes, 0).getDate()
        const fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`

        const { data: ocs } = await supabase
          .from('ocorrencias')
          .select('dias, funcionario_id')
          .eq('absenteismo', true)
          .gte('data_inicio', inicio)
          .lte('data_inicio', fim)

        const totalDias = (ocs || []).reduce((s: number, o: Record<string, number>) => s + (o.dias || 0), 0)
        const funcIds = new Set((ocs || []).map((o: Record<string, string>) => o.funcionario_id))
        const diasUteis = lastDay * 0.72 // approximate working days
        const taxa = totalFunc > 0 && diasUteis > 0 ? (totalDias / (totalFunc * diasUteis)) * 100 : 0

        mensalData.push({
          ano, mes,
          total_funcionarios: funcIds.size,
          total_dias_ausentes: totalDias,
          total_ocorrencias: (ocs || []).length,
          taxa_absenteismo: Math.round(taxa * 100) / 100,
        })
      }
      mensalData.reverse()
    }
    setAbsenteismoMensal(mensalData)

    // Current month summary
    const currentMonthData = mensalData.find((m) => m.ano === currentYear && m.mes === currentMonth)
    if (currentMonthData) {
      setAbsenteismoResumo({
        taxa: currentMonthData.taxa_absenteismo || 0,
        funcionarios: currentMonthData.total_funcionarios || 0,
        diasPerdidos: currentMonthData.total_dias_ausentes || 0,
      })
    } else {
      setAbsenteismoResumo({ taxa: 0, funcionarios: 0, diasPerdidos: 0 })
    }

    // Try loading detailed data from vw_absenteismo
    let detalheQuery = supabase.from('vw_absenteismo').select('*')
    if (filtroUnidade) {
      detalheQuery = detalheQuery.eq('unidade_id', filtroUnidade)
    }
    if (filtroSetor) {
      detalheQuery = detalheQuery.eq('setor_id', filtroSetor)
    }

    const { data: detalhe, error: detalheError } = await detalheQuery.order('total_dias', { ascending: false })

    let detalheRows: Record<string, unknown>[] = []
    if (!detalheError && detalhe) {
      detalheRows = detalhe
    } else {
      // Fallback: compute detail from ocorrencias + funcionarios
      let ocsQuery = supabase
        .from('ocorrencias')
        .select('funcionario_id, dias')
        .eq('absenteismo', true)

      const { data: ocs } = await ocsQuery
      if (ocs && ocs.length > 0) {
        const byFunc: Record<string, { totalDias: number; totalOcs: number }> = {}
        ocs.forEach((o: Record<string, unknown>) => {
          const fid = o.funcionario_id as string
          if (!byFunc[fid]) byFunc[fid] = { totalDias: 0, totalOcs: 0 }
          byFunc[fid].totalDias += (o.dias as number) || 0
          byFunc[fid].totalOcs++
        })

        const funcIds = Object.keys(byFunc)
        const { data: funcs } = await supabase
          .from('funcionarios')
          .select('id, nome_completo, setor_id, unidade_id')
          .in('id', funcIds)

        const { data: setoresData } = await supabase.from('setores').select('id, titulo')
        const { data: unidadesData } = await supabase.from('unidades').select('id, titulo')
        const setoresMap = new Map((setoresData || []).map((s: Record<string, string>) => [s.id, s.titulo]))
        const unidadesMap = new Map((unidadesData || []).map((u: Record<string, string>) => [u.id, u.titulo]))

        detalheRows = (funcs || [])
          .filter((f: Record<string, string>) => {
            if (filtroUnidade && f.unidade_id !== filtroUnidade) return false
            if (filtroSetor && f.setor_id !== filtroSetor) return false
            return true
          })
          .map((f: Record<string, string>) => ({
            funcionario_id: f.id,
            nome: f.nome_completo,
            setor: setoresMap.get(f.setor_id) || '',
            unidade: unidadesMap.get(f.unidade_id) || '',
            total_dias: byFunc[f.id]?.totalDias || 0,
            total_ocorrencias: byFunc[f.id]?.totalOcs || 0,
            taxa: 0,
          }))
          .sort((a, b) => (b.total_dias as number) - (a.total_dias as number))
      }
    }

    setAbsenteismoDetalhe(detalheRows.map((d: Record<string, unknown>) => ({
      funcionario_id: (d.funcionario_id || d.id || '') as string,
      nome: (d.nome || d.funcionario_nome || d.nome_completo || '') as string,
      setor: (d.setor || d.setor_titulo || '') as string,
      unidade: (d.unidade || d.unidade_titulo || '') as string,
      total_dias: (d.total_dias || d.dias_ausentes || 0) as number,
      total_ocorrencias: (d.total_ocorrencias || d.ocorrencias || 0) as number,
      taxa: (d.taxa || d.taxa_absenteismo || 0) as number,
    })))

    // Set data for the table export
    setData(detalheRows.map((d: Record<string, unknown>) => ({
      nome: (d.nome || d.funcionario_nome || d.nome_completo || '') as string,
      setor: (d.setor || d.setor_titulo || '') as string,
      unidade: (d.unidade || d.unidade_titulo || '') as string,
      total_dias: (d.total_dias || d.dias_ausentes || 0) as number,
      total_ocorrencias: (d.total_ocorrencias || d.ocorrencias || 0) as number,
      taxa: (d.taxa || d.taxa_absenteismo || 0) as number,
    })))
  }

  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(value)
      pagination.resetPage()
    }, 300)
  }

  function getColumns(): ExportColumn[] {
    switch (activeReport) {
      case 'lista':
        return [
          { key: 'nome', header: 'Nome' },
          { key: 'codigo', header: 'Codigo' },
          { key: 'cpf', header: 'CPF' },
          { key: 'unidade', header: 'Unidade' },
          { key: 'setor', header: 'Setor' },
          { key: 'funcao', header: 'Funcao' },
          { key: 'data_admissao', header: 'Data Admissao', format: (v) => formatDate(v as string) },
          { key: 'tempo_empresa', header: 'Tempo de Empresa' },
        ]
      case 'ferias-vencer':
        return [
          { key: 'nome', header: 'Nome' },
          { key: 'codigo', header: 'Codigo' },
          { key: 'periodo_aquisitivo', header: 'Periodo Aquisitivo' },
          { key: 'dias_restantes', header: 'Dias Restantes' },
          { key: 'vencimento', header: 'Vencimento', format: (v) => formatDate(v as string) },
          { key: 'situacao', header: 'Situacao' },
        ]
      case 'programacao-ferias':
        return [
          { key: 'nome', header: 'Nome' },
          { key: 'unidade', header: 'Unidade' },
          { key: 'setor', header: 'Setor' },
          { key: 'data_inicio', header: 'Data Inicio', format: (v) => formatDate(v as string) },
          { key: 'data_fim', header: 'Data Fim', format: (v) => formatDate(v as string) },
          { key: 'dias', header: 'Dias' },
          { key: 'status', header: 'Status' },
        ]
      case 'ocorrencias':
        return [
          { key: 'data', header: 'Data', format: (v) => formatDate(v as string) },
          { key: 'funcionario', header: 'Funcionario' },
          { key: 'tipo', header: 'Tipo' },
          { key: 'categoria', header: 'Categoria' },
          { key: 'dias', header: 'Dias' },
          { key: 'valor', header: 'Valor', format: (v) => formatCurrency(v as number) },
          { key: 'descricao', header: 'Descricao' },
        ]
      case 'folha':
        return [
          { key: 'nome', header: 'Nome' },
          { key: 'funcao', header: 'Funcao' },
          { key: 'setor', header: 'Setor' },
          { key: 'salario_bruto', header: 'Salario Bruto', format: (v) => formatCurrency(v as number) },
          { key: 'salario_liquido', header: 'Salario Liquido', format: (v) => formatCurrency(v as number) },
          { key: 'custo', header: 'Custo Total', format: (v) => formatCurrency(v as number) },
        ]
      case 'aniversariantes':
        return [
          { key: 'nome', header: 'Nome' },
          { key: 'data_nascimento', header: 'Data Nascimento', format: (v) => formatDate(v as string) },
          { key: 'idade', header: 'Idade' },
          { key: 'setor', header: 'Setor' },
          { key: 'funcao', header: 'Funcao' },
        ]
      case 'resumo':
        return [
          { key: 'headcount', header: 'Headcount' },
          { key: 'admissoes', header: 'Admissoes' },
          { key: 'desligamentos', header: 'Desligamentos' },
          { key: 'turnover', header: 'Turnover' },
          { key: 'absenteismo', header: 'Absenteismo' },
          { key: 'folhaTotal', header: 'Folha Total' },
        ]
      case 'absenteismo':
        return [
          { key: 'nome', header: 'Funcionario' },
          { key: 'setor', header: 'Setor' },
          { key: 'unidade', header: 'Unidade' },
          { key: 'total_dias', header: 'Dias Ausentes' },
          { key: 'total_ocorrencias', header: 'Ocorrencias' },
          { key: 'taxa', header: 'Taxa (%)' },
        ]
      default:
        return []
    }
  }

  function getReportTitle(): string {
    switch (activeReport) {
      case 'lista': return 'Lista de Funcionarios Ativos'
      case 'ferias-vencer': return 'Ferias a Vencer'
      case 'programacao-ferias': return 'Programacao de Ferias'
      case 'ocorrencias': return 'Ocorrencias por Periodo'
      case 'folha': return 'Folha de Pagamento Atual'
      case 'aniversariantes': return 'Aniversariantes'
      case 'resumo': return 'Resumo de Indicadores'
      case 'absenteismo': return 'Absenteismo'
      default: return 'Relatorio'
    }
  }

  function getFilename(): string {
    const date = format(new Date(), 'yyyy-MM-dd')
    return `${getReportTitle().replace(/\s+/g, '_')}_${date}`
  }

  const meses = [
    { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Marco' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
  ]

  // Report list view
  if (!activeReport) {
    return (
      <PageContainer>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-cinza-preto flex items-center gap-2">
            <FileBarChart size={24} className="text-azul-medio" />
            Relatorios
          </h2>
          <p className="text-cinza-estrutural mt-1">Selecione um relatorio para visualizar e exportar</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            title="Lista de Funcionarios Ativos"
            description="Nome, codigo, CPF, unidade, setor, funcao, data admissao e tempo de empresa"
            icon={<Users size={24} />}
            onClick={() => { resetFilters(); setActiveReport('lista') }}
          />
          <ReportCard
            title="Ferias a Vencer"
            description="Funcionarios com ferias em alerta ou vencidas, periodo aquisitivo e dias restantes"
            icon={<CalendarClock size={24} />}
            onClick={() => { resetFilters(); setActiveReport('ferias-vencer') }}
          />
          <ReportCard
            title="Programacao de Ferias"
            description="Ferias programadas com datas, unidade, setor e status"
            icon={<Calendar size={24} />}
            onClick={() => { resetFilters(); setActiveReport('programacao-ferias') }}
          />
          <ReportCard
            title="Ocorrencias por Periodo"
            description="Ocorrencias registradas com tipo, categoria, dias e valor"
            icon={<ClipboardList size={24} />}
            onClick={() => { resetFilters(); setActiveReport('ocorrencias') }}
          />
          <ReportCard
            title="Folha de Pagamento Atual"
            description="Salario bruto, liquido e custo por funcionario com totais"
            icon={<DollarSign size={24} />}
            onClick={() => { resetFilters(); setActiveReport('folha') }}
          />
          <ReportCard
            title="Aniversariantes"
            description="Funcionarios por mes de nascimento com idade, setor e funcao"
            icon={<Cake size={24} />}
            onClick={() => { resetFilters(); setActiveReport('aniversariantes') }}
          />
          <ReportCard
            title="Resumo de Indicadores"
            description="Headcount, admissoes, desligamentos, turnover, absenteismo e folha total"
            icon={<BarChart3 size={24} />}
            onClick={() => { resetFilters(); setActiveReport('resumo') }}
          />
          <ReportCard
            title="Absenteismo"
            description="Taxa de absenteismo, dias perdidos, grafico mensal e ranking por funcionario"
            icon={<AlertTriangle size={24} />}
            onClick={() => { resetFilters(); setActiveReport('absenteismo') }}
          />
        </div>
      </PageContainer>
    )
  }

  // Absenteismo report has a special layout
  if (activeReport === 'absenteismo') {
    return (
      <PageContainer>
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setActiveReport(null); setData([]); setAbsenteismoMensal([]); setAbsenteismoDetalhe([]); setAbsenteismoResumo(null) }}>
              <ArrowLeft size={16} /> Voltar
            </Button>
            <h2 className="text-xl font-bold text-cinza-preto">Absenteismo</h2>
          </div>
          <div className="flex items-center gap-2">
            <PrintButton />
            <ExportButton data={filteredData} columns={getColumns()} filename={getFilename()} />
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Unidade"
              options={unidades}
              placeholder="Todas"
              value={filtroUnidade}
              onChange={(e) => setFiltroUnidade(e.target.value)}
            />
            <Select
              label="Setor"
              options={setores}
              placeholder="Todos"
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => loadReport('absenteismo')}>
              <Search size={14} /> Gerar Relatorio
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Limpar Filtros
            </Button>
          </div>
        </Card>

        {reportLoading ? (
          <TableSkeleton rows={10} />
        ) : (
          <>
            {/* Summary Cards */}
            {absenteismoResumo && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-cinza-estrutural mb-1">Taxa de Absenteismo (mes atual)</p>
                    <p className="text-3xl font-bold text-laranja">{Number(absenteismoResumo.taxa).toFixed(1)}%</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-cinza-estrutural mb-1">Funcionarios Ausentes</p>
                    <p className="text-3xl font-bold text-azul-medio">{absenteismoResumo.funcionarios}</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-cinza-estrutural mb-1">Total Dias Perdidos</p>
                    <p className="text-3xl font-bold text-red-600">{absenteismoResumo.diasPerdidos}</p>
                  </div>
                </Card>
              </div>
            )}

            {/* Monthly Chart (bar chart using CSS) */}
            {absenteismoMensal.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} className="text-azul-medio" />
                      Taxa de Absenteismo - Ultimos 12 Meses
                    </div>
                  </CardTitle>
                </CardHeader>
                <div className="p-4">
                  <div className="flex items-end gap-2 h-48">
                    {[...absenteismoMensal].reverse().map((m, idx) => {
                      const maxTaxa = Math.max(...absenteismoMensal.map((x) => Number(x.taxa_absenteismo) || 0), 1)
                      const height = maxTaxa > 0 ? (Number(m.taxa_absenteismo) / maxTaxa) * 100 : 0
                      const mesLabel = meses[(m.mes || 1) - 1]?.label?.slice(0, 3) || ''
                      return (
                        <div key={`${m.ano}-${m.mes}`} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-cinza-estrutural">{Number(m.taxa_absenteismo || 0).toFixed(1)}%</span>
                          <div
                            className="w-full bg-laranja/80 rounded-t transition-all hover:bg-laranja"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${mesLabel}/${m.ano}: ${Number(m.taxa_absenteismo || 0).toFixed(1)}%`}
                          />
                          <span className="text-[10px] text-cinza-estrutural">{mesLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Detail Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-laranja" />
                    Ranking por Funcionario
                    {absenteismoDetalhe.length > 0 && (
                      <Badge variant="neutral">{absenteismoDetalhe.length}</Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              {absenteismoDetalhe.length === 0 ? (
                <EmptyState
                  icon={<AlertTriangle size={48} />}
                  title="Nenhum dado encontrado"
                  description="Use os filtros acima e clique em 'Gerar Relatorio' para visualizar os dados de absenteismo."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Funcionario</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Dias Ausentes</TableHead>
                      <TableHead>Ocorrencias</TableHead>
                      <TableHead>Taxa (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absenteismoDetalhe.map((d, i) => (
                      <TableRow key={d.funcionario_id || i}>
                        <TableCell className="font-medium text-cinza-estrutural">{i + 1}</TableCell>
                        <TableCell className="font-medium">{d.nome}</TableCell>
                        <TableCell>{d.setor || '-'}</TableCell>
                        <TableCell>{d.unidade || '-'}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-red-600">{d.total_dias}</span>
                        </TableCell>
                        <TableCell>{d.total_ocorrencias}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${Number(d.taxa) > 5 ? 'text-red-600' : Number(d.taxa) > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                            {Number(d.taxa).toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )}
      </PageContainer>
    )
  }

  // Report detail view (standard reports)
  const columns = getColumns()

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setActiveReport(null); setData([]) }}>
            <ArrowLeft size={16} /> Voltar
          </Button>
          <h2 className="text-xl font-bold text-cinza-preto">{getReportTitle()}</h2>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <ExportButton data={filteredData} columns={columns} filename={getFilename()} />
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Report-specific filters */}
          {(activeReport === 'lista' || activeReport === 'ferias-vencer' || activeReport === 'programacao-ferias' || activeReport === 'folha') && (
            <Select
              label="Unidade"
              options={unidades}
              placeholder="Todas"
              value={filtroUnidade}
              onChange={(e) => setFiltroUnidade(e.target.value)}
            />
          )}

          {(activeReport === 'lista' || activeReport === 'folha') && (
            <Select
              label="Setor"
              options={setores}
              placeholder="Todos"
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
            />
          )}

          {activeReport === 'lista' && (
            <Select
              label="Funcao"
              options={funcoes}
              placeholder="Todas"
              value={filtroFuncao}
              onChange={(e) => setFiltroFuncao(e.target.value)}
            />
          )}

          {activeReport === 'ferias-vencer' && (
            <Select
              label="Situacao"
              options={[
                { value: 'Todas', label: 'Todas' },
                { value: 'ALERTA', label: 'Alerta' },
                { value: 'VENCIDA', label: 'Vencida' },
              ]}
              placeholder="Todas"
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
            />
          )}

          {activeReport === 'programacao-ferias' && (
            <Select
              label="Status"
              options={[
                { value: 'Programada', label: 'Programada' },
                { value: 'Em Andamento', label: 'Em Andamento' },
                { value: 'Concluida', label: 'Concluida' },
                { value: 'Cancelada', label: 'Cancelada' },
              ]}
              placeholder="Todos"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            />
          )}

          {(activeReport === 'programacao-ferias' || activeReport === 'ocorrencias' || activeReport === 'resumo') && (
            <>
              <Input
                label="Data Inicio"
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
              />
              <Input
                label="Data Fim"
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
              />
            </>
          )}

          {activeReport === 'aniversariantes' && (
            <Select
              label="Mes"
              options={meses}
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
            />
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => loadReport(activeReport)}>
            <Search size={14} /> Gerar Relatorio
          </Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Limpar Filtros
          </Button>
        </div>
      </Card>

      {/* Search */}
      {data.length > 0 && (
        <div className="mb-4 print:hidden">
          <input
            type="text"
            placeholder="Buscar nos resultados..."
            className="w-full max-w-sm pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      )}

      {/* Results */}
      {reportLoading ? (
        <TableSkeleton rows={10} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<FileBarChart size={48} />}
          title="Nenhum dado encontrado"
          description="Use os filtros acima e clique em 'Gerar Relatorio' para visualizar os dados."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key}>{col.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.format
                          ? col.format(row[col.key])
                          : String(row[col.key] ?? '-')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Folha totals */}
            {activeReport === 'folha' && filteredData.length > 0 && (
              <div className="bg-azul text-white rounded-b-lg px-4 py-3 flex justify-between text-sm font-medium">
                <span>Total ({filteredData.length} funcionarios)</span>
                <div className="flex gap-8">
                  <span>Bruto: {formatCurrency(filteredData.reduce((s, r) => s + ((r.salario_bruto as number) || 0), 0))}</span>
                  <span>Liquido: {formatCurrency(filteredData.reduce((s, r) => s + ((r.salario_liquido as number) || 0), 0))}</span>
                  <span>Custo: {formatCurrency(filteredData.reduce((s, r) => s + ((r.custo as number) || 0), 0))}</span>
                </div>
              </div>
            )}
          </div>

          <Pagination
            currentPage={pagination.currentPage}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.goToPage}
          />
        </>
      )}
    </PageContainer>
  )
}
