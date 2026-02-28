'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { useFerias, type SaldoComFuncionario } from '@/hooks/useFerias'
import { usePagination } from '@/hooks/usePagination'
import { createClient } from '@/lib/supabase'
import { BarChart3, AlertTriangle, Clock, AlertCircle, RefreshCw, Check } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

function safeFormat(dateStr: string | null | undefined, fmt: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr + 'T00:00:00'), fmt)
  } catch {
    return dateStr
  }
}

function diasAteVencimento(dataVencimento: string): number {
  const venc = new Date(dataVencimento + 'T00:00:00')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function getSaldoStatusBadge(status: string) {
  switch (status) {
    case 'Disponível': return <Badge variant="success">Disponivel</Badge>
    case 'Parcial': return <Badge variant="warning">Parcial</Badge>
    case 'Gozado': return <Badge variant="neutral">Gozado</Badge>
    case 'Vencido': return <Badge variant="danger">Vencido</Badge>
    default: return <Badge>{status}</Badge>
  }
}

export default function SaldosFeriasPage() {
  const supabase = createClient()
  const {
    loadAllSaldos,
    loadFuncionariosElegiveis,
    gerarSaldos,
  } = useFerias()

  const [loading, setLoading] = useState(true)
  const [saldos, setSaldos] = useState<SaldoComFuncionario[]>([])
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])

  // Filters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterUnidade, setFilterUnidade] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Generate Saldos Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [elegiveis, setElegiveis] = useState<{ id: string; nome_completo: string; codigo?: string; periodos_faltantes: number }[]>([])
  const [loadingElegiveis, setLoadingElegiveis] = useState(false)
  const [selectedElegiveis, setSelectedElegiveis] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [saldosData, uniRes, setRes] = await Promise.all([
        loadAllSaldos(),
        supabase.from('unidades').select('id, titulo').order('titulo'),
        supabase.from('setores').select('id, titulo, unidade_id').order('titulo'),
      ])
      setSaldos(saldosData)
      setUnidades(uniRes.data || [])
      setSetores(setRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [loadAllSaldos])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Alerts
  const vencendo30 = saldos.filter(s => {
    if (!s.data_vencimento || s.status === 'Gozado' || s.status === 'Vencido') return false
    const dias = diasAteVencimento(s.data_vencimento)
    return dias >= 0 && dias <= 30
  })

  const vencendo60 = saldos.filter(s => {
    if (!s.data_vencimento || s.status === 'Gozado' || s.status === 'Vencido') return false
    const dias = diasAteVencimento(s.data_vencimento)
    return dias > 30 && dias <= 60
  })

  // Funcionários com saldo total > 40 dias (risco trabalhista)
  const saldoPorFuncionario = new Map<string, number>()
  saldos.forEach(s => {
    if (s.status === 'Disponível' || s.status === 'Parcial') {
      const total = saldoPorFuncionario.get(s.funcionario_id) || 0
      saldoPorFuncionario.set(s.funcionario_id, total + (s.dias_restantes || 0))
    }
  })
  const funcionariosRisco = Array.from(saldoPorFuncionario.entries()).filter(([, total]) => total > 40)

  // Filters
  const filteredSetores = filterUnidade
    ? setores.filter((s) => s.unidade_id === filterUnidade)
    : setores

  const filteredSaldos = saldos.filter((s) => {
    if (filterSearch) {
      const search = filterSearch.toLowerCase()
      if (!(s.nome_completo || '').toLowerCase().includes(search) &&
          !(s.codigo || '').toLowerCase().includes(search)) {
        return false
      }
    }
    if (filterUnidade && s.unidade_id !== filterUnidade) return false
    if (filterSetor && s.setor_id !== filterSetor) return false
    if (filterStatus && s.status !== filterStatus) return false
    return true
  })

  const { paginatedItems, currentPage, totalItems, pageSize, goToPage } = usePagination(filteredSaldos, { pageSize: 20 })

  function getRowClass(s: SaldoComFuncionario) {
    if (!s.data_vencimento || s.status === 'Gozado') return ''
    const dias = diasAteVencimento(s.data_vencimento)
    if (dias < 0 || s.status === 'Vencido') return 'bg-red-50'
    if (dias <= 30) return 'bg-red-50'
    if (dias <= 60) return 'bg-amber-50'
    return ''
  }

  async function handleOpenGenerate() {
    setShowGenerateModal(true)
    setLoadingElegiveis(true)
    setSelectedElegiveis(new Set())
    try {
      const data = await loadFuncionariosElegiveis()
      setElegiveis(data)
      setSelectedElegiveis(new Set(data.map(e => e.id)))
    } finally {
      setLoadingElegiveis(false)
    }
  }

  function toggleElegivel(id: string) {
    setSelectedElegiveis(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllElegiveis() {
    if (selectedElegiveis.size === elegiveis.length) {
      setSelectedElegiveis(new Set())
    } else {
      setSelectedElegiveis(new Set(elegiveis.map(e => e.id)))
    }
  }

  async function handleGenerate() {
    if (selectedElegiveis.size === 0) return
    setGenerating(true)
    try {
      await gerarSaldos(Array.from(selectedElegiveis))
      setShowGenerateModal(false)
      loadData()
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <CardSkeleton />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Saldos de Ferias</h2>
        <Button onClick={handleOpenGenerate}>
          <RefreshCw size={16} /> Gerar Saldos
        </Button>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
            <AlertTriangle size={16} />
            Vencendo em 30 dias
          </div>
          <div className="text-2xl font-bold text-red-700">{vencendo30.length}</div>
          {vencendo30.length > 0 && (
            <p className="text-xs text-red-600 mt-1">Acao imediata necessaria</p>
          )}
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
            <Clock size={16} />
            Vencendo em 60 dias
          </div>
          <div className="text-2xl font-bold text-amber-700">{vencendo60.length}</div>
          {vencendo60.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">Programar ferias</p>
          )}
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <div className="flex items-center gap-2 text-sm text-orange-600 mb-1">
            <AlertCircle size={16} />
            Saldo {'>'} 40 dias
          </div>
          <div className="text-2xl font-bold text-orange-700">{funcionariosRisco.length}</div>
          {funcionariosRisco.length > 0 && (
            <p className="text-xs text-orange-600 mt-1">Risco trabalhista</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            placeholder="Buscar funcionario..."
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); goToPage(1) }}
          />
          <Select
            value={filterUnidade}
            onChange={(e) => { setFilterUnidade(e.target.value); setFilterSetor(''); goToPage(1) }}
            options={unidades.map(u => ({ value: u.id, label: u.titulo }))}
            placeholder="Todas as unidades"
          />
          <Select
            value={filterSetor}
            onChange={(e) => { setFilterSetor(e.target.value); goToPage(1) }}
            options={filteredSetores.map(s => ({ value: s.id, label: s.titulo }))}
            placeholder="Todos os setores"
          />
          <Select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); goToPage(1) }}
            options={[
              { value: 'Disponível', label: 'Disponivel' },
              { value: 'Parcial', label: 'Parcial' },
              { value: 'Gozado', label: 'Gozado' },
              { value: 'Vencido', label: 'Vencido' },
            ]}
            placeholder="Todos os status"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-laranja" />
              Saldos
              {filteredSaldos.length > 0 && <Badge variant="neutral">{filteredSaldos.length}</Badge>}
            </div>
          </CardTitle>
        </CardHeader>
        {filteredSaldos.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="Nenhum saldo encontrado"
            description="Nenhum saldo de ferias encontrado com os filtros selecionados"
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableHead>Funcionario</TableHead>
                <TableHead>Periodo Aquisitivo</TableHead>
                <TableHead>Direito</TableHead>
                <TableHead>Gozados</TableHead>
                <TableHead>Vendidos</TableHead>
                <TableHead>Restantes</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((s) => (
                  <TableRow key={s.id} className={getRowClass(s)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.nome_completo}</p>
                        {s.codigo && <p className="text-xs text-cinza-estrutural">Cod: {s.codigo}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {safeFormat(s.periodo_aquisitivo_inicio)} a {safeFormat(s.periodo_aquisitivo_fim)}
                    </TableCell>
                    <TableCell>{s.dias_direito}</TableCell>
                    <TableCell>{s.dias_gozados}</TableCell>
                    <TableCell>{s.dias_vendidos}</TableCell>
                    <TableCell className="font-medium">{s.dias_restantes}</TableCell>
                    <TableCell>
                      <div>
                        {safeFormat(s.data_vencimento)}
                        {s.data_vencimento && (() => {
                          const dias = diasAteVencimento(s.data_vencimento)
                          if (dias < 0) return <p className="text-xs text-red-600">{Math.abs(dias)} dias atrasado</p>
                          if (dias <= 30) return <p className="text-xs text-red-600">{dias} dias</p>
                          if (dias <= 60) return <p className="text-xs text-amber-600">{dias} dias</p>
                          return null
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>{getSaldoStatusBadge(s.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={goToPage}
            />
          </>
        )}
      </Card>

      {/* Generate Saldos Modal */}
      <Modal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Gerar Saldos de Ferias"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            Funcionarios que completaram periodo aquisitivo mas ainda nao possuem saldo gerado.
          </div>

          {loadingElegiveis ? (
            <div className="text-center py-8 text-cinza-estrutural">Buscando funcionarios elegiveis...</div>
          ) : elegiveis.length === 0 ? (
            <div className="text-center py-8 text-cinza-estrutural">
              Todos os funcionarios ja possuem saldos gerados. Nenhuma acao necessaria.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-cinza-estrutural">
                  {elegiveis.length} funcionario(s) elegivel(is)
                </p>
                <button
                  onClick={toggleAllElegiveis}
                  className="text-sm text-azul-medio hover:underline"
                >
                  {selectedElegiveis.size === elegiveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {elegiveis.map((func) => (
                  <label
                    key={func.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedElegiveis.has(func.id)}
                      onChange={() => toggleElegivel(func.id)}
                      className="rounded border-gray-300 text-laranja focus:ring-laranja"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-cinza-preto">{func.nome_completo}</p>
                      {func.codigo && <p className="text-xs text-cinza-estrutural">Cod: {func.codigo}</p>}
                    </div>
                    <Badge variant="info">{func.periodos_faltantes} periodo(s)</Badge>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowGenerateModal(false)}>Cancelar</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || selectedElegiveis.size === 0}
            >
              {generating ? 'Gerando...' : `Gerar Saldos (${selectedElegiveis.size})`}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}
