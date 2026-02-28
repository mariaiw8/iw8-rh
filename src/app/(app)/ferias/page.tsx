'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { Select } from '@/components/ui/Select'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FeriasForm, type FeriasFormData } from '@/components/ferias/FeriasForm'
import { useFerias, type FeriasGestao } from '@/hooks/useFerias'
import { usePagination } from '@/hooks/usePagination'
import { createClient } from '@/lib/supabase'
import { Plus, Calendar, Clock, AlertTriangle, Landmark, Pencil, X as XIcon, Palmtree } from 'lucide-react'
import { format } from 'date-fns'

function safeFormat(dateStr: string | null | undefined, fmt: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr + 'T00:00:00'), fmt)
  } catch {
    return dateStr
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Programada': return <Badge variant="info">Programada</Badge>
    case 'Em Andamento': return <Badge variant="warning">Em Andamento</Badge>
    case 'Concluída': return <Badge variant="success">Concluida</Badge>
    case 'Cancelada': return <Badge variant="neutral">Cancelada</Badge>
    default: return <Badge>{status}</Badge>
  }
}

function getTipoBadge(tipo: string) {
  switch (tipo) {
    case 'Individual': return <Badge variant="neutral">Individual</Badge>
    case 'Coletiva': return <Badge className="bg-orange-100 text-orange-700">Coletiva</Badge>
    default: return <Badge>{tipo}</Badge>
  }
}

export default function FeriasGestaoPage() {
  const supabase = createClient()
  const {
    loadFeriasGestao,
    createFerias,
    updateFerias,
    cancelFerias,
  } = useFerias()

  const [loading, setLoading] = useState(true)
  const [ferias, setFerias] = useState<FeriasGestao[]>([])
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])

  // Filters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterUnidade, setFilterUnidade] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFerias, setEditingFerias] = useState<FeriasGestao | null>(null)
  const [cancelingFerias, setCancelingFerias] = useState<FeriasGestao | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [feriasData, uniRes, setRes] = await Promise.all([
        loadFeriasGestao(),
        supabase.from('unidades').select('id, titulo').order('titulo'),
        supabase.from('setores').select('id, titulo, unidade_id').order('titulo'),
      ])
      setFerias(feriasData)
      setUnidades(uniRes.data || [])
      setSetores(setRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [loadFeriasGestao])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered data
  const filteredSetores = filterUnidade
    ? setores.filter((s) => s.unidade_id === filterUnidade)
    : setores

  const filteredFerias = ferias.filter((f) => {
    if (filterSearch) {
      const search = filterSearch.toLowerCase()
      if (!(f.nome_completo || '').toLowerCase().includes(search) &&
          !(f.codigo || '').toLowerCase().includes(search)) {
        return false
      }
    }
    if (filterUnidade && f.unidade !== unidades.find(u => u.id === filterUnidade)?.titulo) return false
    if (filterSetor && f.setor !== setores.find(s => s.id === filterSetor)?.titulo) return false
    if (filterStatus && f.status !== filterStatus) return false
    if (filterTipo && f.tipo !== filterTipo) return false
    return true
  })

  // Summary cards - deduplicate saldo counting by tracking unique ferias_saldo_ids
  const totalProgramadas = ferias.filter(f => f.status === 'Programada').length
  const totalEmAndamento = ferias.filter(f => f.status === 'Em Andamento').length

  // Count unique saldos that are expiring within 60 days
  const saldosVencendo = new Set<string>()
  ferias.forEach(f => {
    if (!f.ferias_saldo_id || !f.periodo_aquisitivo_fim) return
    if (saldosVencendo.has(f.ferias_saldo_id)) return
    const vencimento = new Date(f.periodo_aquisitivo_fim + 'T00:00:00')
    vencimento.setMonth(vencimento.getMonth() + 11)
    const hoje = new Date()
    const diffDias = Math.floor((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDias <= 60 && diffDias >= 0 && f.dias_restantes && f.dias_restantes > 0) {
      saldosVencendo.add(f.ferias_saldo_id)
    }
  })
  const totalVencendo60 = saldosVencendo.size

  // Sum unique saldos for available balance
  const saldoMap = new Map<string, number>()
  ferias.forEach(f => {
    if (!f.ferias_saldo_id) return
    if (saldoMap.has(f.ferias_saldo_id)) return
    if (f.saldo_status === 'Disponível' || f.saldo_status === 'Parcial') {
      saldoMap.set(f.ferias_saldo_id, f.dias_restantes || 0)
    }
  })
  const totalSaldoDisponivel = Array.from(saldoMap.values()).reduce((a, b) => a + b, 0)

  // Pagination
  const { paginatedItems, currentPage, totalItems, pageSize, goToPage } = usePagination(filteredFerias, { pageSize: 20 })

  async function handleCreateFerias(data: FeriasFormData) {
    await createFerias({
      funcionario_id: data.funcionario_id,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      dias: data.dias,
      tipo: data.tipo,
      ferias_saldo_id: data.ferias_saldo_id || data.periodo_aquisitivo_id || undefined,
      abono_pecuniario: data.abono_pecuniario,
      dias_vendidos: data.dias_vendidos,
      observacao: data.observacao || undefined,
    })
    setShowCreateModal(false)
    loadData()
  }

  async function handleEditFerias(data: FeriasFormData) {
    if (!editingFerias) return
    await updateFerias(editingFerias.id, {
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      dias: data.dias,
      abono_pecuniario: data.abono_pecuniario,
      dias_vendidos: data.dias_vendidos,
      observacao: data.observacao || undefined,
    })
    setEditingFerias(null)
    loadData()
  }

  async function handleCancelFerias() {
    if (!cancelingFerias) return
    setCancelLoading(true)
    try {
      const ok = await cancelFerias(cancelingFerias.id)
      if (ok) {
        setCancelingFerias(null)
        loadData()
      }
    } finally {
      setCancelLoading(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
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
        <h2 className="text-2xl font-bold text-cinza-preto">Gestao de Ferias</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Nova Ferias
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
            <Calendar size={16} />
            Programadas
          </div>
          <div className="text-2xl font-bold text-blue-700">{totalProgramadas}</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
            <Clock size={16} />
            Em Andamento
          </div>
          <div className="text-2xl font-bold text-amber-700">{totalEmAndamento}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
            <AlertTriangle size={16} />
            Vencendo em 60 dias
          </div>
          <div className="text-2xl font-bold text-red-700">{totalVencendo60}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
            <Landmark size={16} />
            Saldo Disponivel (dias)
          </div>
          <div className="text-2xl font-bold text-green-700">{totalSaldoDisponivel}</div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              { value: 'Programada', label: 'Programada' },
              { value: 'Em Andamento', label: 'Em Andamento' },
              { value: 'Concluída', label: 'Concluida' },
              { value: 'Cancelada', label: 'Cancelada' },
            ]}
            placeholder="Todos os status"
          />
          <Select
            value={filterTipo}
            onChange={(e) => { setFilterTipo(e.target.value); goToPage(1) }}
            options={[
              { value: 'Individual', label: 'Individual' },
              { value: 'Coletiva', label: 'Coletiva' },
            ]}
            placeholder="Todos os tipos"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Palmtree size={18} className="text-laranja" />
              Ferias
              {filteredFerias.length > 0 && (
                <Badge variant="neutral">{filteredFerias.length}</Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {filteredFerias.length === 0 ? (
          <EmptyState
            icon={<Palmtree size={40} />}
            title="Nenhuma ferias encontrada"
            description="Nenhuma ferias encontrada com os filtros selecionados"
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableHead>Funcionario</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Saldo Restante</TableHead>
                <TableHead className="w-24">Acoes</TableHead>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{f.nome_completo}</p>
                        {f.codigo && <p className="text-xs text-cinza-estrutural">Cod: {f.codigo}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{f.unidade || '-'}</TableCell>
                    <TableCell>{f.setor || '-'}</TableCell>
                    <TableCell>
                      {safeFormat(f.data_inicio)} ~ {safeFormat(f.data_fim)}
                    </TableCell>
                    <TableCell>{f.dias}</TableCell>
                    <TableCell>{getTipoBadge(f.tipo)}</TableCell>
                    <TableCell>{getStatusBadge(f.status)}</TableCell>
                    <TableCell>
                      {f.dias_restantes !== null && f.dias_restantes !== undefined
                        ? `${f.dias_restantes} dias`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingFerias(f)}
                          className="text-azul-medio hover:bg-blue-50 p-1.5 rounded"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        {f.status !== 'Cancelada' && f.status !== 'Concluída' && (
                          <button
                            onClick={() => setCancelingFerias(f)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                            title="Cancelar"
                          >
                            <XIcon size={14} />
                          </button>
                        )}
                      </div>
                    </TableCell>
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

      {/* Create Modal */}
      <FeriasForm
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateFerias}
      />

      {/* Edit Modal */}
      {editingFerias && (
        <FeriasForm
          open={true}
          onClose={() => setEditingFerias(null)}
          onSubmit={handleEditFerias}
          funcionarioId={editingFerias.funcionario_id}
          funcionarioNome={editingFerias.nome_completo}
          initialData={{
            data_inicio: editingFerias.data_inicio,
            data_fim: editingFerias.data_fim,
            dias: editingFerias.dias,
            tipo: editingFerias.tipo,
            ferias_saldo_id: editingFerias.ferias_saldo_id || '',
            abono_pecuniario: editingFerias.abono_pecuniario || false,
            dias_vendidos: editingFerias.ferias_dias_vendidos || 0,
            observacao: editingFerias.observacao || '',
          }}
        />
      )}

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={!!cancelingFerias}
        onClose={() => setCancelingFerias(null)}
        onConfirm={handleCancelFerias}
        title="Cancelar Ferias"
        message={cancelingFerias
          ? `Deseja cancelar as ferias de ${cancelingFerias.nome_completo} no periodo ${safeFormat(cancelingFerias.data_inicio)} a ${safeFormat(cancelingFerias.data_fim)}?`
          : ''}
        confirmLabel="Cancelar Ferias"
        loading={cancelLoading}
      />
    </PageContainer>
  )
}
