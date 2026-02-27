'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { FeriasForm, type FeriasFormData } from '@/components/ferias/FeriasForm'
import { FeriasColetivasForm, type FeriasColetivasFormData } from '@/components/ferias/FeriasColetivasForm'
import { useFerias, type FeriasAVencer, type ProximasFerias, type FeriasColetivas } from '@/hooks/useFerias'
import { Plus, AlertTriangle, Calendar, Users, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

function getSituacaoStyle(situacao: string) {
  switch (situacao) {
    case 'VENCIDA': return 'bg-red-100 text-red-700 border-red-200'
    case 'ALERTA': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'OK': return 'bg-green-100 text-green-700 border-green-200'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Programada': return <Badge variant="info">Programada</Badge>
    case 'Em Andamento': return <Badge variant="warning">Em Andamento</Badge>
    case 'Concluída': return <Badge variant="success">Concluída</Badge>
    case 'Cancelada': return <Badge variant="neutral">Cancelada</Badge>
    default: return <Badge>{status}</Badge>
  }
}

export default function FeriasPage() {
  const {
    loadFeriasAVencer,
    loadProximasFerias,
    loadFeriasColetivas,
    createFerias,
    createFeriasColetivas,
    deleteFeriasColetivas,
  } = useFerias()

  const [loading, setLoading] = useState(true)
  const [feriasAVencer, setFeriasAVencer] = useState<FeriasAVencer[]>([])
  const [proximasFerias, setProximasFerias] = useState<ProximasFerias[]>([])
  const [feriasColetivas, setFeriasColetivas] = useState<FeriasColetivas[]>([])
  const [showFeriasForm, setShowFeriasForm] = useState(false)
  const [showColetivasForm, setShowColetivasForm] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [av, pf, fc] = await Promise.all([
        loadFeriasAVencer(),
        loadProximasFerias(),
        loadFeriasColetivas(),
      ])
      setFeriasAVencer(av)
      setProximasFerias(pf)
      setFeriasColetivas(fc)
    } finally {
      setLoading(false)
    }
  }, [loadFeriasAVencer, loadProximasFerias, loadFeriasColetivas])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCreateFerias(data: FeriasFormData) {
    await createFerias({
      funcionario_id: data.funcionario_id,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      dias: data.dias,
      tipo: data.tipo,
      periodo_aquisitivo_id: data.periodo_aquisitivo_id || undefined,
      abono_pecuniario: data.abono_pecuniario,
      dias_vendidos: data.dias_vendidos,
      observacao: data.observacao || undefined,
    })
    loadData()
  }

  async function handleCreateColetivas(data: FeriasColetivasFormData) {
    await createFeriasColetivas({
      titulo: data.titulo,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      dias: data.dias,
      unidade_id: data.unidade_id,
      setor_id: data.setor_id,
      observacao: data.observacao || undefined,
    })
    loadData()
  }

  async function handleDeleteColetivas(id: string) {
    if (!confirm('Deseja excluir estas ferias coletivas?')) return
    await deleteFeriasColetivas(id)
    loadData()
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
          <div className="grid grid-cols-1 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Ferias</h2>
        <Button onClick={() => setShowFeriasForm(true)}>
          <Plus size={16} /> Adicionar Ferias
        </Button>
      </div>

      {/* Secao 1 - Ferias a Vencer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Ferias a Vencer
              {feriasAVencer.length > 0 && (
                <Badge variant="danger">{feriasAVencer.length}</Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {feriasAVencer.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={40} />}
            title="Nenhum alerta"
            description="Todos os periodos de ferias estao em dia"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Nome</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Periodo Aquisitivo</TableHead>
              <TableHead>Dias Restantes</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Dias p/ Vencer</TableHead>
              <TableHead>Situacao</TableHead>
            </TableHeader>
            <TableBody>
              {feriasAVencer.map((f) => (
                <TableRow
                  key={f.id}
                  className={
                    f.situacao === 'VENCIDA'
                      ? 'bg-red-50'
                      : f.situacao === 'ALERTA'
                      ? 'bg-amber-50'
                      : ''
                  }
                >
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>{f.codigo || '-'}</TableCell>
                  <TableCell>{f.periodo_aquisitivo}</TableCell>
                  <TableCell>{f.dias_restantes}</TableCell>
                  <TableCell>
                    {format(new Date(f.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {f.dias_para_vencer < 0
                      ? `${Math.abs(f.dias_para_vencer)} dias atrasado`
                      : `${f.dias_para_vencer} dias`}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSituacaoStyle(f.situacao)}`}>
                      {f.situacao === 'VENCIDA' && '🔴 '}
                      {f.situacao === 'ALERTA' && '🟡 '}
                      {f.situacao === 'OK' && '✅ '}
                      {f.situacao}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Secao 2 - Proximas Ferias Programadas */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-azul-medio" />
              Proximas Ferias Programadas
            </div>
          </CardTitle>
        </CardHeader>
        {proximasFerias.length === 0 ? (
          <EmptyState
            icon={<Calendar size={40} />}
            title="Nenhuma ferias programada"
            description="Nao ha ferias programadas no momento"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Nome</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Data Inicio</TableHead>
              <TableHead>Data Fim</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Status</TableHead>
            </TableHeader>
            <TableBody>
              {proximasFerias.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>{f.codigo || '-'}</TableCell>
                  <TableCell>{f.unidade || '-'}</TableCell>
                  <TableCell>{f.setor || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(f.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {format(new Date(f.data_fim + 'T00:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{f.dias}</TableCell>
                  <TableCell>{getStatusBadge(f.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Secao 3 - Ferias Coletivas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>
              <div className="flex items-center gap-2">
                <Users size={18} className="text-laranja" />
                Ferias Coletivas
              </div>
            </CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setShowColetivasForm(true)}>
              <Plus size={14} /> Registrar Ferias Coletivas
            </Button>
          </div>
        </CardHeader>
        {feriasColetivas.length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="Nenhuma ferias coletiva"
            description="Nenhuma ferias coletiva registrada"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Titulo</TableHead>
              <TableHead>Data Inicio</TableHead>
              <TableHead>Data Fim</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Observacao</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableHeader>
            <TableBody>
              {feriasColetivas.map((fc) => (
                <TableRow key={fc.id}>
                  <TableCell className="font-medium">{fc.titulo}</TableCell>
                  <TableCell>{format(new Date(fc.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{format(new Date(fc.data_fim + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{fc.dias}</TableCell>
                  <TableCell>{fc.unidade_nome || 'Todas'}</TableCell>
                  <TableCell>{fc.setor_nome || 'Todos'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{fc.observacao || '-'}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDeleteColetivas(fc.id)}
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
      <FeriasForm
        open={showFeriasForm}
        onClose={() => setShowFeriasForm(false)}
        onSubmit={handleCreateFerias}
      />
      <FeriasColetivasForm
        open={showColetivasForm}
        onClose={() => setShowColetivasForm(false)}
        onSubmit={handleCreateColetivas}
      />
    </PageContainer>
  )
}
