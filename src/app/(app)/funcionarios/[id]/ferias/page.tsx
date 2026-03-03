'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { listarFeriasFuncionario, listarPeriodosComSaldo } from '@/services/feriasService'
import type { Ferias, FeriasPeriodoSaldo } from '@/types/ferias'
import { formatDateSafe } from '@/lib/dateUtils'

function statusVariant(status: Ferias['status']) {
  if (status === 'Programada') return 'info'
  if (status === 'Aprovada') return 'success'
  if (status === 'Em Andamento') return 'warning'
  if (status === 'Concluída') return 'neutral'
  return 'danger'
}

function saldoVariant(status: FeriasPeriodoSaldo['status_calculado']) {
  if (status === 'Disponível') return 'success'
  if (status === 'Parcial') return 'warning'
  if (status === 'Gozado') return 'neutral'
  return 'danger'
}

export default function FeriasFuncionarioPage() {
  const params = useParams<{ id: string }>()
  const funcionarioId = params.id
  const [periodos, setPeriodos] = useState<FeriasPeriodoSaldo[]>([])
  const [ferias, setFerias] = useState<Ferias[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        const [periodosData, feriasData] = await Promise.all([
          listarPeriodosComSaldo(funcionarioId),
          listarFeriasFuncionario(funcionarioId),
        ])
        setPeriodos(periodosData)
        setFerias(feriasData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar férias.')
      } finally {
        setLoading(false)
      }
    }

    if (funcionarioId) carregar()
  }, [funcionarioId])

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cinza-preto">Férias</h1>
        <Link href={`/funcionarios/${funcionarioId}/ferias/nova`}>
          <Button variant="primary">Nova férias</Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Saldo por período</CardTitle>
        </CardHeader>
        {loading ? (
          <p className="text-sm text-cinza-escuro">Carregando saldo...</p>
        ) : periodos.length === 0 ? (
          <p className="text-sm text-cinza-escuro">Nenhum período com saldo disponível.</p>
        ) : (
          <div className="space-y-3">
            {periodos.map((periodo) => (
              <div key={periodo.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-cinza-preto">
                    Aquisitivo: {formatDateSafe(periodo.aquisitivo_inicio)} até {formatDateSafe(periodo.aquisitivo_fim)}
                  </p>
                  <p className="text-xs text-cinza-escuro">Vencimento: {formatDateSafe(periodo.data_vencimento)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-cinza-preto">{periodo.dias_restantes} dias</p>
                  <Badge variant={saldoVariant(periodo.status_calculado)}>{periodo.status_calculado}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de férias</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableHead>Início</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Vendidos</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableHeader>
          <TableBody>
            {ferias.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatDateSafe(item.data_inicio)}</TableCell>
                <TableCell>{formatDateSafe(item.data_fim)}</TableCell>
                <TableCell>{item.dias}</TableCell>
                <TableCell>{item.dias_vendidos}</TableCell>
                <TableCell>{item.tipo}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/ferias/${item.id}`} className="text-sm font-medium text-azul hover:underline">
                    Ver detalhes
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!loading && ferias.length === 0 && (
              <TableRow>
                <TableCell className="text-center text-cinza-escuro" colSpan={7}>
                  Nenhuma férias cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </PageContainer>
  )
}
