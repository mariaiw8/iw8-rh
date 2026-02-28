'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { Select } from '@/components/ui/Select'
import { SearchInput } from '@/components/ui/SearchInput'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { OcorrenciaForm, type OcorrenciaFormData } from '@/components/ocorrencias/OcorrenciaForm'
import { TipoOcorrenciaForm, type TipoFormData } from '@/components/ocorrencias/TipoOcorrenciaForm'
import { useOcorrencias, type Ocorrencia, type TipoOcorrencia } from '@/hooks/useOcorrencias'
import { Plus, ClipboardList, Pencil, Trash2, FileText, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORIAS = [
  { value: '', label: 'Todas' },
  { value: 'Remuneração', label: 'Remuneração' },
  { value: 'Ausência', label: 'Ausência' },
  { value: 'Disciplinar', label: 'Disciplinar' },
  { value: 'Benefício', label: 'Benefício' },
  { value: 'Outro', label: 'Outro' },
]

export default function OcorrenciasPage() {
  const {
    loading: hookLoading,
    loadTipos,
    createTipo,
    updateTipo,
    deleteTipo,
    loadOcorrencias,
    createOcorrencia,
    deleteOcorrencia,
  } = useOcorrencias()

  const [loading, setLoading] = useState(true)
  const [tipos, setTipos] = useState<TipoOcorrencia[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [showOcorrenciaForm, setShowOcorrenciaForm] = useState(false)
  const [showTipoForm, setShowTipoForm] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoOcorrencia | null>(null)

  // Filters
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [t, o] = await Promise.all([
        loadTipos(),
        loadOcorrencias({
          tipo_id: filterTipo || undefined,
          categoria: filterCategoria || undefined,
          data_inicio: filterDataInicio || undefined,
          data_fim: filterDataFim || undefined,
        }),
      ])
      setTipos(t)
      setOcorrencias(o)
    } finally {
      setLoading(false)
    }
  }, [loadTipos, loadOcorrencias, filterTipo, filterCategoria, filterDataInicio, filterDataFim])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredOcorrencias = filterSearch
    ? ocorrencias.filter((o) =>
        (o.funcionario_nome || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
        (o.funcionario_codigo || '').toLowerCase().includes(filterSearch.toLowerCase())
      )
    : ocorrencias

  async function handleCreateTipo(data: TipoFormData) {
    if (editingTipo) {
      await updateTipo(editingTipo.id, data)
    } else {
      await createTipo(data)
    }
    setEditingTipo(null)
    loadData()
  }

  async function handleDeleteTipo(id: string) {
    if (!confirm('Deseja excluir este tipo de ocorrencia?')) return
    await deleteTipo(id)
    loadData()
  }

  async function handleCreateOcorrencia(data: OcorrenciaFormData) {
    await createOcorrencia({
      funcionario_id: data.funcionario_id,
      tipo_ocorrencia_id: data.tipo_ocorrencia_id,
      descricao: data.descricao || undefined,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim || undefined,
      dias: data.dias,
      valor: data.valor || undefined,
      arquivo_url: data.arquivo_url || undefined,
      observacao: data.observacao || undefined,
      absenteismo: data.absenteismo || false,
    })
    loadData()
  }

  async function handleDeleteOcorrencia(id: string) {
    if (!confirm('Deseja excluir esta ocorrencia?')) return
    await deleteOcorrencia(id)
    loadData()
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
          <div className="grid grid-cols-1 gap-6">
            {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Ocorrencias</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEditingTipo(null); setShowTipoForm(true) }}>
            <Plus size={16} /> Cadastrar Tipo
          </Button>
          <Button onClick={() => setShowOcorrenciaForm(true)}>
            <Plus size={16} /> Registrar Ocorrencia
          </Button>
        </div>
      </div>

      {/* Tipos de Ocorrencia */}
      {tipos.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-azul-medio" />
                Tipos de Ocorrencia
              </div>
            </CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {tipos.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white"
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.cor }} />
                <span className="font-medium text-cinza-preto">{t.titulo}</span>
                <span className="text-xs text-cinza-estrutural">({t.categoria})</span>
                <button
                  onClick={() => { setEditingTipo(t); setShowTipoForm(true) }}
                  className="text-cinza-estrutural hover:text-azul-medio ml-1"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDeleteTipo(t.id)}
                  className="text-cinza-estrutural hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            placeholder="Buscar funcionario..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          <Select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            options={[{ value: '', label: 'Todos os tipos' }, ...tipos.map((t) => ({ value: t.id, label: t.titulo }))]}
          />
          <Select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            options={CATEGORIAS}
          />
          <DateRangePicker
            startDate={filterDataInicio}
            endDate={filterDataFim}
            onStartChange={setFilterDataInicio}
            onEndChange={setFilterDataFim}
          />
        </div>
      </Card>

      {/* Lista de Ocorrencias */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-laranja" />
              Ocorrencias Recentes
              {filteredOcorrencias.length > 0 && (
                <Badge variant="neutral">{filteredOcorrencias.length}</Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {filteredOcorrencias.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} />}
            title="Nenhuma ocorrencia"
            description="Nenhuma ocorrencia encontrada com os filtros selecionados"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Data</TableHead>
              <TableHead>Funcionario</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Abs.</TableHead>
              <TableHead>Anexo</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableHeader>
            <TableBody>
              {filteredOcorrencias.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    {(() => { try { return format(new Date(o.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') } catch { return o.data_inicio || '-' } })()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{o.funcionario_nome}</p>
                      {o.funcionario_codigo && (
                        <p className="text-xs text-cinza-estrutural">Cod: {o.funcionario_codigo}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: o.tipo_cor || '#888' }}
                    >
                      {o.tipo_titulo}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{o.descricao || '-'}</TableCell>
                  <TableCell>{o.dias}</TableCell>
                  <TableCell>
                    {o.valor ? `R$ ${Number(o.valor).toFixed(2).replace('.', ',')}` : '-'}
                  </TableCell>
                  <TableCell>
                    {o.absenteismo ? (
                      <Badge variant="warning">ABS</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {o.arquivo_url ? (
                      <a
                        href={o.arquivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-azul-medio hover:text-azul"
                      >
                        <ExternalLink size={16} />
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDeleteOcorrencia(o.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modals */}
      <OcorrenciaForm
        open={showOcorrenciaForm}
        onClose={() => setShowOcorrenciaForm(false)}
        onSubmit={handleCreateOcorrencia}
        tipos={tipos}
      />
      <TipoOcorrenciaForm
        open={showTipoForm}
        onClose={() => { setShowTipoForm(false); setEditingTipo(null) }}
        onSubmit={handleCreateTipo}
        initial={editingTipo || undefined}
      />
    </PageContainer>
  )
}
