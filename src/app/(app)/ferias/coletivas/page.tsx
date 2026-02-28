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
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useFerias, type FeriasColetivas } from '@/hooks/useFerias'
import { createClient } from '@/lib/supabase'
import { Plus, Building, Calendar, Users, Eye, Pencil, Trash2 } from 'lucide-react'
import { format, differenceInCalendarDays } from 'date-fns'
import { toast } from 'sonner'

function safeFormat(dateStr: string | null | undefined, fmt: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr + 'T00:00:00'), fmt)
  } catch {
    return dateStr
  }
}

export default function FeriasColetivasPage() {
  const supabase = createClient()
  const {
    loadFeriasColetvasResumo,
    createFeriasColetivas,
    updateFeriasColetivas,
    deleteFeriasColetivas,
    loadFuncionariosColetiva,
    countFuncionariosAfetados,
  } = useFerias()

  const [loading, setLoading] = useState(true)
  const [coletivas, setColetivas] = useState<FeriasColetivas[]>([])
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])

  // Modals
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingColetiva, setEditingColetiva] = useState<FeriasColetivas | null>(null)
  const [viewingColetiva, setViewingColetiva] = useState<FeriasColetivas | null>(null)
  const [deletingColetiva, setDeletingColetiva] = useState<FeriasColetivas | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Details modal state
  const [detailsFuncionarios, setDetailsFuncionarios] = useState<Record<string, unknown>[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [coletivasData, uniRes, setRes] = await Promise.all([
        loadFeriasColetvasResumo(),
        supabase.from('unidades').select('id, titulo').order('titulo'),
        supabase.from('setores').select('id, titulo, unidade_id').order('titulo'),
      ])
      setColetivas(coletivasData)
      setUnidades(uniRes.data || [])
      setSetores(setRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [loadFeriasColetvasResumo])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Summary
  const anoAtual = new Date().getFullYear()
  const coletivasNoAno = coletivas.filter(c => {
    if (!c.data_inicio) return false
    return new Date(c.data_inicio + 'T00:00:00').getFullYear() === anoAtual
  })

  const proximaColetiva = coletivas.find(c => {
    if (!c.data_inicio) return false
    return new Date(c.data_inicio + 'T00:00:00') >= new Date()
  })

  const ultimaColetiva = coletivas[0]

  async function handleViewDetails(coletiva: FeriasColetivas) {
    setViewingColetiva(coletiva)
    setLoadingDetails(true)
    try {
      const funcs = await loadFuncionariosColetiva(coletiva.data_inicio, coletiva.data_fim, coletiva.titulo)
      setDetailsFuncionarios(funcs)
    } finally {
      setLoadingDetails(false)
    }
  }

  async function handleDelete() {
    if (!deletingColetiva) return
    setDeleteLoading(true)
    try {
      const ok = await deleteFeriasColetivas(deletingColetiva.id)
      if (ok) {
        setDeletingColetiva(null)
        loadData()
      }
    } finally {
      setDeleteLoading(false)
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
        <h2 className="text-2xl font-bold text-cinza-preto">Ferias Coletivas</h2>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus size={16} /> Nova Coletiva
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
            <Calendar size={16} />
            Total no Ano
          </div>
          <div className="text-2xl font-bold text-blue-700">{coletivasNoAno.length}</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
            <Calendar size={16} />
            Proxima Coletiva
          </div>
          <div className="text-lg font-bold text-amber-700">
            {proximaColetiva
              ? `${safeFormat(proximaColetiva.data_inicio)} - ${proximaColetiva.titulo}`
              : 'Nenhuma'}
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
            <Users size={16} />
            Afetados na Ultima
          </div>
          <div className="text-2xl font-bold text-green-700">
            {ultimaColetiva?.total_afetados || 0}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Building size={18} className="text-laranja" />
              Ferias Coletivas
              {coletivas.length > 0 && <Badge variant="neutral">{coletivas.length}</Badge>}
            </div>
          </CardTitle>
        </CardHeader>
        {coletivas.length === 0 ? (
          <EmptyState
            icon={<Building size={40} />}
            title="Nenhuma ferias coletiva"
            description="Nenhuma ferias coletiva registrada"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Titulo</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Funcionarios Afetados</TableHead>
              <TableHead className="w-28">Acoes</TableHead>
            </TableHeader>
            <TableBody>
              {coletivas.map((fc) => (
                <TableRow key={fc.id}>
                  <TableCell className="font-medium">{fc.titulo}</TableCell>
                  <TableCell>
                    {safeFormat(fc.data_inicio)} ~ {safeFormat(fc.data_fim)}
                  </TableCell>
                  <TableCell>{fc.dias}</TableCell>
                  <TableCell>{fc.unidade_nome || 'Todas'}</TableCell>
                  <TableCell>{fc.setor_nome || 'Todos'}</TableCell>
                  <TableCell>
                    <Badge variant="info">{fc.total_afetados || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewDetails(fc)}
                        className="text-azul-medio hover:bg-blue-50 p-1.5 rounded"
                        title="Ver detalhes"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => setEditingColetiva(fc)}
                        className="text-azul-medio hover:bg-blue-50 p-1.5 rounded"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingColetiva(fc)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded"
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

      {/* Create/Edit Form Modal */}
      <ColetivaFormModal
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        unidades={unidades}
        setores={setores}
        countAfetados={countFuncionariosAfetados}
        onSubmit={async (data) => {
          await createFeriasColetivas(data)
          setShowCreateForm(false)
          loadData()
        }}
      />

      {editingColetiva && (
        <ColetivaFormModal
          open={true}
          onClose={() => setEditingColetiva(null)}
          unidades={unidades}
          setores={setores}
          countAfetados={countFuncionariosAfetados}
          initialData={editingColetiva}
          onSubmit={async (data) => {
            await updateFeriasColetivas(editingColetiva.id, data)
            setEditingColetiva(null)
            loadData()
          }}
        />
      )}

      {/* Details Modal */}
      {viewingColetiva && (
        <Modal
          open={true}
          onClose={() => { setViewingColetiva(null); setDetailsFuncionarios([]) }}
          title={`Detalhes: ${viewingColetiva.titulo}`}
          size="xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-xs text-cinza-estrutural">Periodo</p>
                <p className="font-medium">{safeFormat(viewingColetiva.data_inicio)} a {safeFormat(viewingColetiva.data_fim)}</p>
              </div>
              <div>
                <p className="text-xs text-cinza-estrutural">Dias</p>
                <p className="font-medium">{viewingColetiva.dias}</p>
              </div>
              <div>
                <p className="text-xs text-cinza-estrutural">Unidade</p>
                <p className="font-medium">{viewingColetiva.unidade_nome || 'Todas'}</p>
              </div>
              <div>
                <p className="text-xs text-cinza-estrutural">Setor</p>
                <p className="font-medium">{viewingColetiva.setor_nome || 'Todos'}</p>
              </div>
              {viewingColetiva.observacao && (
                <div className="col-span-2">
                  <p className="text-xs text-cinza-estrutural">Observacao</p>
                  <p className="text-sm">{viewingColetiva.observacao}</p>
                </div>
              )}
            </div>

            <h4 className="font-semibold text-cinza-preto flex items-center gap-2">
              <Users size={16} />
              Funcionarios Afetados ({detailsFuncionarios.length})
            </h4>

            {loadingDetails ? (
              <div className="text-center py-8 text-cinza-estrutural">Carregando...</div>
            ) : detailsFuncionarios.length === 0 ? (
              <div className="text-center py-8 text-cinza-estrutural">Nenhum funcionario encontrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableHead>Funcionario</TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Status</TableHead>
                </TableHeader>
                <TableBody>
                  {detailsFuncionarios.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{f.nome_completo as string}</TableCell>
                      <TableCell>{(f.codigo as string) || '-'}</TableCell>
                      <TableCell>
                        {(() => {
                          const status = f.status as string
                          switch (status) {
                            case 'Programada': return <Badge variant="info">Programada</Badge>
                            case 'Em Andamento': return <Badge variant="warning">Em Andamento</Badge>
                            case 'Concluída': return <Badge variant="success">Concluida</Badge>
                            case 'Cancelada': return <Badge variant="neutral">Cancelada</Badge>
                            default: return <Badge>{status}</Badge>
                          }
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingColetiva}
        onClose={() => setDeletingColetiva(null)}
        onConfirm={handleDelete}
        title="Excluir Ferias Coletivas"
        message={deletingColetiva
          ? `Excluir ferias coletivas "${deletingColetiva.titulo}"? Isso cancelara as ferias individuais de ${deletingColetiva.total_afetados || 0} funcionarios.`
          : ''}
        confirmLabel="Excluir"
        loading={deleteLoading}
      />
    </PageContainer>
  )
}

// Create/Edit Form Component
function ColetivaFormModal({
  open,
  onClose,
  unidades,
  setores,
  countAfetados,
  initialData,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  unidades: { id: string; titulo: string }[]
  setores: { id: string; titulo: string; unidade_id?: string }[]
  countAfetados: (unidadeId?: string | null, setorId?: string | null) => Promise<number>
  initialData?: FeriasColetivas
  onSubmit: (data: {
    titulo: string
    data_inicio: string
    data_fim: string
    dias: number
    unidade_id?: string | null
    setor_id?: string | null
    observacao?: string
  }) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [form, setForm] = useState({
    titulo: '',
    data_inicio: '',
    data_fim: '',
    dias: 0,
    unidade_id: '' as string,
    setor_id: '' as string,
    observacao: '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        titulo: initialData?.titulo || '',
        data_inicio: initialData?.data_inicio || '',
        data_fim: initialData?.data_fim || '',
        dias: initialData?.dias || 0,
        unidade_id: initialData?.unidade_id || '',
        setor_id: initialData?.setor_id || '',
        observacao: initialData?.observacao || '',
      })
      setPreview(null)
    }
  }, [open, initialData])

  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const dias = differenceInCalendarDays(
        new Date(form.data_fim + 'T00:00:00'),
        new Date(form.data_inicio + 'T00:00:00')
      ) + 1
      setForm((prev) => ({ ...prev, dias: dias > 0 ? dias : 0 }))
    }
  }, [form.data_inicio, form.data_fim])

  // Load preview count when unidade/setor changes
  useEffect(() => {
    async function loadPreview() {
      setLoadingPreview(true)
      try {
        const count = await countAfetados(
          form.unidade_id || null,
          form.setor_id || null
        )
        setPreview(count)
      } finally {
        setLoadingPreview(false)
      }
    }
    if (open) {
      loadPreview()
    }
  }, [open, form.unidade_id, form.setor_id, countAfetados])

  const filteredSetores = form.unidade_id
    ? setores.filter((s) => s.unidade_id === form.unidade_id)
    : setores

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo || !form.data_inicio || !form.data_fim) return
    setSubmitting(true)
    try {
      await onSubmit({
        titulo: form.titulo,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        dias: form.dias,
        unidade_id: form.unidade_id || null,
        setor_id: form.setor_id || null,
        observacao: form.observacao || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initialData ? 'Editar Ferias Coletivas' : 'Registrar Ferias Coletivas'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Titulo *"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          placeholder="Ex: Ferias coletivas fim de ano"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data Inicio *"
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
          <Input
            label="Data Fim *"
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
          />
        </div>

        <Input
          label="Dias"
          type="number"
          value={form.dias.toString()}
          disabled
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Unidade"
            value={form.unidade_id}
            onChange={(e) => setForm({ ...form, unidade_id: e.target.value, setor_id: '' })}
            options={unidades.map((u) => ({ value: u.id, label: u.titulo }))}
            placeholder="Todas"
          />
          <Select
            label="Setor"
            value={form.setor_id}
            onChange={(e) => setForm({ ...form, setor_id: e.target.value })}
            options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))}
            placeholder="Todos"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Users size={16} />
            {loadingPreview
              ? 'Calculando...'
              : preview !== null
                ? `${preview} funcionario(s) serao afetados`
                : 'Calculando...'}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.titulo || !form.data_inicio || !form.data_fim}>
            {submitting ? 'Salvando...' : (initialData ? 'Salvar Alteracoes' : 'Cadastrar e Gerar Ferias')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
