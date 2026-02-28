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
import { FeriasForm, type FeriasFormData } from '@/components/ferias/FeriasForm'
import { FeriasColetivasForm, type FeriasColetivasFormData } from '@/components/ferias/FeriasColetivasForm'
import { VenderFeriasForm } from '@/components/ferias/VenderFeriasForm'
import { Select } from '@/components/ui/Select'
import { useFerias, type FeriasAVencer, type ProximasFerias, type FeriasColetivas, type FeriasExtrato, type FeriasSaldo } from '@/hooks/useFerias'
import { createClient } from '@/lib/supabase'
import { Plus, AlertTriangle, Calendar, Users, Trash2, FileText, TrendingUp, TrendingDown, Clock, Ban, DollarSign } from 'lucide-react'
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

function getSaldoStatusBadge(status: string) {
  switch (status) {
    case 'Disponível': return <Badge variant="success">Disponivel</Badge>
    case 'Parcial': return <Badge variant="warning">Parcial</Badge>
    case 'Gozado': return <Badge variant="neutral">Gozado</Badge>
    case 'Vencido': return <Badge variant="danger">Vencido</Badge>
    default: return <Badge>{status}</Badge>
  }
}

export default function FeriasPage() {
  const supabase = createClient()
  const {
    loadFeriasAVencer,
    loadProximasFerias,
    loadFeriasColetivas,
    createFerias,
    createFeriasColetivas,
    deleteFeriasColetivas,
    loadExtrato,
    loadSaldos,
    venderFerias,
  } = useFerias()

  const [loading, setLoading] = useState(true)
  const [feriasAVencer, setFeriasAVencer] = useState<FeriasAVencer[]>([])
  const [proximasFerias, setProximasFerias] = useState<ProximasFerias[]>([])
  const [feriasColetivas, setFeriasColetivas] = useState<FeriasColetivas[]>([])
  const [showFeriasForm, setShowFeriasForm] = useState(false)
  const [showColetivasForm, setShowColetivasForm] = useState(false)

  // Extrato de Ferias state
  const [funcionarios, setFuncionarios] = useState<{ value: string; label: string }[]>([])
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('')
  const [extrato, setExtrato] = useState<FeriasExtrato[]>([])
  const [saldos, setSaldos] = useState<FeriasSaldo[]>([])
  const [loadingExtrato, setLoadingExtrato] = useState(false)
  const [showVenderForm, setShowVenderForm] = useState(false)
  const [editingExtrato, setEditingExtrato] = useState<FeriasExtrato | null>(null)

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
    loadFuncionarios()
  }, [loadData])

  useEffect(() => {
    if (selectedFuncionarioId) {
      loadExtratoData(selectedFuncionarioId)
    } else {
      setExtrato([])
      setSaldos([])
    }
  }, [selectedFuncionarioId])

  async function loadFuncionarios() {
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome_completo, codigo')
      .eq('status', 'Ativo')
      .order('nome_completo')

    setFuncionarios(
      (data || []).map((f: Record<string, string>) => ({
        value: f.id,
        label: `${f.nome_completo} (${f.codigo || 'sem codigo'})`,
      }))
    )
  }

  async function loadExtratoData(funcionarioId: string) {
    setLoadingExtrato(true)
    try {
      const [extratoData, saldosData] = await Promise.all([
        loadExtrato(funcionarioId),
        loadSaldos(funcionarioId),
      ])
      setExtrato(extratoData)
      setSaldos(saldosData)
    } finally {
      setLoadingExtrato(false)
    }
  }

  // Computed summary from saldos
  const resumo = {
    diasDireito: saldos.reduce((acc, s) => acc + (s.dias_direito || 0), 0),
    diasGozados: saldos.reduce((acc, s) => acc + (s.dias_gozados || 0), 0),
    diasDisponiveis: saldos
      .filter((s) => s.status === 'Disponível' || s.status === 'Parcial')
      .reduce((acc, s) => acc + (s.dias_restantes || 0), 0),
    periodosVencidos: saldos.filter((s) => s.status === 'Vencido').length,
  }

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

  async function handleVender(periodoId: string, dias: number, valor?: number) {
    const ok = await venderFerias(periodoId, dias)
    if (ok && valor && valor > 0) {
      const { data: saldoData } = await supabase
        .from('ferias_saldo')
        .select('periodo_aquisitivo_inicio, periodo_aquisitivo_fim')
        .eq('id', periodoId)
        .single()

      const hoje = new Date().toISOString().split('T')[0]
      const { data: feriasRec } = await supabase
        .from('ferias')
        .insert({
          funcionario_id: selectedFuncionarioId,
          ferias_saldo_id: periodoId,
          data_inicio: hoje,
          data_fim: hoje,
          dias: 0,
          abono_pecuniario: true,
          dias_vendidos: dias,
          status: 'Concluída',
          tipo: 'Individual',
        })
        .select('id')
        .single()

      const { data: tipoVenda } = await supabase
        .from('tipos_transacao')
        .select('id')
        .eq('titulo', 'Venda de Férias')
        .single()

      if (tipoVenda && feriasRec) {
        const inicio = saldoData?.periodo_aquisitivo_inicio || ''
        const fim = saldoData?.periodo_aquisitivo_fim || ''
        await supabase.from('transacoes').insert({
          funcionario_id: selectedFuncionarioId,
          tipo_transacao_id: tipoVenda.id,
          valor: valor,
          data: hoje,
          descricao: `Venda de ${dias} dias de ferias — Periodo ${inicio} a ${fim}`,
          origem_tabela: 'ferias',
          origem_id: feriasRec.id,
        })
      }
    }
    if (ok && selectedFuncionarioId) {
      loadExtratoData(selectedFuncionarioId)
    }
    return ok
  }

  async function handleSaveExtrato(item: FeriasExtrato, newData: { data?: string; dias?: number }) {
    try {
      if (item.tipo_movimento === 'CRÉDITO' && item.referencia_tabela === 'ferias_saldo') {
        const updatePayload: Record<string, unknown> = {}
        if (newData.dias !== undefined) updatePayload.dias_direito = newData.dias
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('ferias_saldo')
            .update(updatePayload)
            .eq('id', item.referencia_id)
          if (error) throw error
        }
      } else if (item.referencia_tabela === 'ferias') {
        const updatePayload: Record<string, unknown> = {}
        if (newData.dias !== undefined) updatePayload.dias = newData.dias
        if (newData.data !== undefined) updatePayload.data_inicio = newData.data
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('ferias')
            .update(updatePayload)
            .eq('id', item.referencia_id)
          if (error) throw error
        }
      } else if (item.referencia_tabela === 'ocorrencias') {
        const updatePayload: Record<string, unknown> = {}
        if (newData.dias !== undefined) updatePayload.dias = newData.dias
        if (newData.data !== undefined) updatePayload.data_inicio = newData.data
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('ocorrencias')
            .update(updatePayload)
            .eq('id', item.referencia_id)
          if (error) throw error
        }
      }
      toast.success('Movimentacao atualizada')
      setEditingExtrato(null)
      if (selectedFuncionarioId) loadExtratoData(selectedFuncionarioId)
    } catch (err) {
      console.error('Erro ao editar extrato:', err)
      toast.error('Erro ao editar movimentacao')
    }
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

      {/* Secao 4 - Extrato de Ferias */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-azul-medio" />
                Extrato de Ferias
              </div>
            </CardTitle>
            {selectedFuncionarioId && saldos.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setShowVenderForm(true)}>
                <DollarSign size={14} /> Vender Ferias
              </Button>
            )}
          </div>
        </CardHeader>
        <div className="p-6 pt-0">
          {/* Seletor de funcionario */}
          <Select
            label="Selecione o Funcionario"
            value={selectedFuncionarioId}
            onChange={(e) => setSelectedFuncionarioId(e.target.value)}
            options={funcionarios}
            placeholder="Selecione um funcionario..."
          />

          {selectedFuncionarioId && (
            <>
              {loadingExtrato ? (
                <div className="mt-6 space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : (
                <>
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
                        <Calendar size={14} />
                        Dias de Direito
                      </div>
                      <div className="text-2xl font-bold text-blue-700">{resumo.diasDireito}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                        <TrendingDown size={14} />
                        Dias Gozados
                      </div>
                      <div className="text-2xl font-bold text-green-700">{resumo.diasGozados}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 mb-1">
                        <TrendingUp size={14} />
                        Dias Disponiveis
                      </div>
                      <div className="text-2xl font-bold text-emerald-700">{resumo.diasDisponiveis}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                      <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
                        <Ban size={14} />
                        Periodos Vencidos
                      </div>
                      <div className="text-2xl font-bold text-red-700">{resumo.periodosVencidos}</div>
                    </div>
                  </div>

                  {/* Tabela de extrato */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-cinza-preto mb-3 flex items-center gap-2">
                      <FileText size={16} />
                      Movimentacoes
                      <span className="text-xs text-cinza-estrutural font-normal">(clique para editar)</span>
                    </h3>
                    {extrato.length === 0 ? (
                      <EmptyState
                        icon={<FileText size={40} />}
                        title="Nenhuma movimentacao"
                        description="Nenhum registro de ferias encontrado para este funcionario"
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descricao</TableHead>
                          <TableHead>Dias</TableHead>
                          <TableHead>Status</TableHead>
                        </TableHeader>
                        <TableBody>
                          {extrato.map((e, idx) => (
                            <TableRow
                              key={`${e.referencia_id}-${idx}`}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => setEditingExtrato(e)}
                            >
                              <TableCell>
                                {format(new Date(e.data_movimento + 'T00:00:00'), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>
                                {e.tipo_movimento === 'CRÉDITO' ? (
                                  <Badge variant="success">CREDITO</Badge>
                                ) : (
                                  <Badge variant="danger">DEBITO</Badge>
                                )}
                              </TableCell>
                              <TableCell>{e.descricao}</TableCell>
                              <TableCell>
                                <span className={e.dias > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {e.dias > 0 ? `+${e.dias}` : e.dias}
                                </span>
                              </TableCell>
                              <TableCell>
                                {e.tipo_movimento === 'CRÉDITO' && e.saldo_status
                                  ? getSaldoStatusBadge(e.saldo_status)
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Tabela de periodos aquisitivos */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-cinza-preto mb-3 flex items-center gap-2">
                      <Clock size={16} />
                      Periodos Aquisitivos
                    </h3>
                    {saldos.length === 0 ? (
                      <EmptyState
                        icon={<Clock size={40} />}
                        title="Nenhum periodo"
                        description="Nenhum periodo aquisitivo encontrado para este funcionario"
                      />
                    ) : (
                      <div className="space-y-3">
                        {saldos.map((s) => {
                          const usados = (s.dias_gozados || 0) + (s.dias_vendidos || 0)
                          const percentual = s.dias_direito > 0 ? Math.min(100, (usados / s.dias_direito) * 100) : 0
                          return (
                            <div key={s.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-cinza-preto">
                                  {format(new Date(s.periodo_aquisitivo_inicio + 'T00:00:00'), 'dd/MM/yyyy')} a {format(new Date(s.periodo_aquisitivo_fim + 'T00:00:00'), 'dd/MM/yyyy')}
                                </div>
                                {getSaldoStatusBadge(s.status)}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
                                <div>
                                  <span className="text-gray-500">Direito:</span>{' '}
                                  <span className="font-medium">{s.dias_direito} dias</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Gozados:</span>{' '}
                                  <span className="font-medium">{s.dias_gozados} dias</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Vendidos:</span>{' '}
                                  <span className="font-medium">{s.dias_vendidos} dias</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Restantes:</span>{' '}
                                  <span className="font-medium text-emerald-600">{s.dias_restantes} dias</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Vencimento:</span>{' '}
                                  <span className="font-medium">{format(new Date(s.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                                </div>
                              </div>
                              {/* Barra de progresso */}
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    s.status === 'Vencido' ? 'bg-red-500' :
                                    s.status === 'Gozado' ? 'bg-gray-400' :
                                    s.status === 'Parcial' ? 'bg-amber-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${percentual}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {usados} de {s.dias_direito} dias utilizados ({Math.round(percentual)}%)
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
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
      {selectedFuncionarioId && (
        <VenderFeriasForm
          open={showVenderForm}
          onClose={() => setShowVenderForm(false)}
          saldos={saldos}
          onSubmit={handleVender}
        />
      )}

      {/* Edit Extrato Modal */}
      {editingExtrato && (
        <EditExtratoModal
          item={editingExtrato}
          onClose={() => setEditingExtrato(null)}
          onSave={handleSaveExtrato}
        />
      )}
    </PageContainer>
  )
}

// We need toast import for the edit handler
import { toast } from 'sonner'

function EditExtratoModal({
  item,
  onClose,
  onSave,
}: {
  item: FeriasExtrato
  onClose: () => void
  onSave: (item: FeriasExtrato, data: { data?: string; dias?: number }) => Promise<void>
}) {
  const [data, setData] = useState(item.data_movimento || '')
  const [dias, setDias] = useState(Math.abs(item.dias))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(item, { data, dias })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Editar Movimentacao">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p><strong>Tipo:</strong> {item.tipo_movimento}</p>
          <p><strong>Descricao:</strong> {item.descricao}</p>
          <p><strong>Tabela:</strong> {item.referencia_tabela}</p>
        </div>
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <Input
          label="Dias"
          type="number"
          value={dias.toString()}
          onChange={(e) => setDias(parseInt(e.target.value) || 0)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
