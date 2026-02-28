'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { FolhaResumoCards } from '@/components/financeiro/FolhaResumo'
import { TipoTransacaoForm, type TipoTransacaoFormData } from '@/components/financeiro/TipoTransacaoForm'
import { useFolha, type FolhaResumo, type FolhaPorUnidade, type FolhaPorSetor, type TopSalario } from '@/hooks/useFolha'
import { useTiposTransacao } from '@/hooks/useTiposTransacao'
import {
  DollarSign,
  Plus,
  Building2,
  Layers,
  Trophy,
  BarChart3,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FinanceiroGeralPage() {
  const { loadResumoGeral, loadFolhaPorUnidade, loadFolhaPorSetor, loadTopSalarios } = useFolha()
  const { createTipo } = useTiposTransacao()

  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<FolhaResumo>({ totalBruto: 0, totalLiquido: 0, custoTotal: 0, totalFuncionarios: 0 })
  const [porUnidade, setPorUnidade] = useState<FolhaPorUnidade[]>([])
  const [porSetor, setPorSetor] = useState<FolhaPorSetor[]>([])
  const [topSalarios, setTopSalarios] = useState<TopSalario[]>([])
  const [tipoFormOpen, setTipoFormOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, uni, set, top] = await Promise.all([
        loadResumoGeral(),
        loadFolhaPorUnidade(),
        loadFolhaPorSetor(),
        loadTopSalarios(10),
      ])
      setResumo(res)
      setPorUnidade(uni)
      setPorSetor(set)
      setTopSalarios(top)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleTipoSubmit(data: TipoTransacaoFormData) {
    await createTipo(data)
  }

  // Chart data for sectors
  const chartSetores = [...porSetor]
    .sort((a, b) => b.total_bruto - a.total_bruto)
    .slice(0, 10)
    .map((s) => ({
      name: s.setor_titulo.length > 20 ? s.setor_titulo.slice(0, 18) + '...' : s.setor_titulo,
      'Custo Bruto': s.total_bruto,
    }))

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-cinza-preto">Financeiro</h1>
          <p className="text-sm text-cinza-estrutural">Visao consolidada da folha de pagamento</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setTipoFormOpen(true)}>
          <Plus size={14} /> Cadastrar Tipo de Transacao
        </Button>
      </div>

      {/* Cards superiores */}
      <div className="mb-8">
        <FolhaResumoCards resumo={resumo} />
      </div>

      {/* Folha por Unidade */}
      <Card className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={20} className="text-azul" />
          <h3 className="text-lg font-bold text-cinza-preto">Folha por Unidade</h3>
        </div>

        {porUnidade.length === 0 ? (
          <EmptyState
            icon={<Building2 size={48} />}
            title="Nenhum dado disponivel"
            description="Nao ha salarios registrados"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Funcionarios</TableHead>
              <TableHead>Total Bruto</TableHead>
              <TableHead>Total Liquido</TableHead>
              <TableHead>Custo Total</TableHead>
            </TableHeader>
            <TableBody>
              {porUnidade.map((u) => (
                <TableRow key={u.unidade_id}>
                  <TableCell className="font-medium">{u.unidade_titulo}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="info">{u.num_funcionarios}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(u.total_bruto)}</TableCell>
                  <TableCell>{formatCurrency(u.total_liquido)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(u.custo_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Folha por Setor */}
      <Card className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={20} className="text-azul" />
          <h3 className="text-lg font-bold text-cinza-preto">Folha por Setor</h3>
        </div>

        {porSetor.length === 0 ? (
          <EmptyState
            icon={<Layers size={48} />}
            title="Nenhum dado disponivel"
            description="Nao ha salarios registrados"
          />
        ) : (
          <>
            <Table className="mb-6">
              <TableHeader>
                <TableHead>Setor</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Funcionarios</TableHead>
                <TableHead>Total Bruto</TableHead>
              </TableHeader>
              <TableBody>
                {porSetor.map((s) => (
                  <TableRow key={s.setor_id}>
                    <TableCell className="font-medium">{s.setor_titulo}</TableCell>
                    <TableCell>{s.unidade_titulo || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="info">{s.num_funcionarios}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(s.total_bruto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Bar chart */}
            {chartSetores.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={16} className="text-cinza-estrutural" />
                  <p className="text-sm font-medium text-cinza-estrutural">Custo por Setor</p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={chartSetores} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={95}
                      />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="Custo Bruto" fill="#E57B25" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Top Salarios */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={20} className="text-amber-500" />
          <h3 className="text-lg font-bold text-cinza-preto">Top 10 Salarios</h3>
        </div>

        {topSalarios.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={48} />}
            title="Nenhum dado disponivel"
            description="Nao ha salarios registrados"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Funcao</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Salario Bruto</TableHead>
            </TableHeader>
            <TableBody>
              {topSalarios.map((t, i) => (
                <TableRow key={t.funcionario_id}>
                  <TableCell>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-gray-200 text-gray-700' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'text-cinza-estrutural'
                    }`}>
                      {i + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{t.nome_completo}</TableCell>
                  <TableCell>{t.funcao_titulo || '-'}</TableCell>
                  <TableCell>{t.setor_titulo || '-'}</TableCell>
                  <TableCell className="font-bold text-laranja">{formatCurrency(t.salario_bruto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal */}
      <TipoTransacaoForm
        open={tipoFormOpen}
        onClose={() => setTipoFormOpen(false)}
        onSubmit={handleTipoSubmit}
      />
    </PageContainer>
  )
}
