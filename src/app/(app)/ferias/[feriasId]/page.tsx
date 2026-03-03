'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { aprovarFeriasRPC, buscarAlocacoes, buscarAlocacoesVenda, cancelarFeriasRPC } from '@/services/feriasService'
import type { Ferias, FeriasAlocacaoRow } from '@/types/ferias'
import { formatDateSafe } from '@/lib/dateUtils'

const supabase = createClient()

function statusVariant(status: Ferias['status']) {
  if (status === 'Programada') return 'info'
  if (status === 'Aprovada') return 'success'
  if (status === 'Em Andamento') return 'warning'
  if (status === 'Concluída') return 'neutral'
  return 'danger'
}

export default function FeriasDetalhePage() {
  const params = useParams<{ feriasId: string }>()
  const router = useRouter()
  const feriasId = params.feriasId

  const [ferias, setFerias] = useState<Ferias | null>(null)
  const [alocacoesGozo, setAlocacoesGozo] = useState<FeriasAlocacaoRow[]>([])
  const [alocacoesVenda, setAlocacoesVenda] = useState<FeriasAlocacaoRow[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data, error }, gozo, venda] = await Promise.all([
        supabase.from('ferias').select('*').eq('id', feriasId).single(),
        buscarAlocacoes(feriasId),
        buscarAlocacoesVenda(feriasId),
      ])

      if (error) throw error
      setFerias(data as Ferias)
      setAlocacoesGozo(gozo)
      setAlocacoesVenda(venda)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao carregar férias.')
    } finally {
      setLoading(false)
    }
  }, [feriasId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function aprovar() {
    try {
      await aprovarFeriasRPC(feriasId)
      router.refresh()
      await carregar()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao aprovar férias.')
    }
  }

  async function cancelar() {
    try {
      await cancelarFeriasRPC(feriasId)
      router.refresh()
      await carregar()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao cancelar férias.')
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-cinza-escuro">Carregando...</p>
      </PageContainer>
    )
  }

  if (!ferias) {
    return (
      <PageContainer>
        <p className="text-sm text-red-600">Férias não encontrada.</p>
      </PageContainer>
    )
  }

  const podeAprovar = ferias.status === 'Programada'
  const podeCancelar = ferias.status !== 'Cancelada'

  return (
    <PageContainer className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detalhe das férias</CardTitle>
            <Badge variant={statusVariant(ferias.status)}>{ferias.status}</Badge>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 gap-3 text-sm text-cinza-preto md:grid-cols-2">
          <p><span className="font-medium">Início:</span> {formatDateSafe(ferias.data_inicio)}</p>
          <p><span className="font-medium">Fim:</span> {formatDateSafe(ferias.data_fim)}</p>
          <p><span className="font-medium">Dias:</span> {ferias.dias}</p>
          <p><span className="font-medium">Tipo:</span> {ferias.tipo}</p>
          <p><span className="font-medium">Dias vendidos:</span> {ferias.dias_vendidos}</p>
          <p><span className="font-medium">Abono:</span> {ferias.abono_pecuniario ? 'Sim' : 'Não'}</p>
        </div>

        {ferias.observacao && (
          <p className="mt-3 text-sm text-cinza-preto">
            <span className="font-medium">Observação:</span> {ferias.observacao}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {podeAprovar && (
            <Button variant="primary" onClick={aprovar}>Aprovar</Button>
          )}
          {podeCancelar && (
            <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alocações de gozo</CardTitle>
        </CardHeader>
        {alocacoesGozo.length === 0 ? (
          <p className="text-sm text-cinza-escuro">Sem alocações de gozo.</p>
        ) : (
          <ul className="space-y-2 text-sm text-cinza-preto">
            {alocacoesGozo.map((aloc, index) => (
              <li key={`gozo-${index}`} className="rounded border border-gray-200 p-2">
                {aloc.dias} dias • aquisitivo {formatDateSafe(aloc.ferias_periodos?.aquisitivo_inicio)} até {formatDateSafe(aloc.ferias_periodos?.aquisitivo_fim)} • vencimento {formatDateSafe(aloc.ferias_periodos?.data_vencimento)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alocações de venda</CardTitle>
        </CardHeader>
        {alocacoesVenda.length === 0 ? (
          <p className="text-sm text-cinza-escuro">Sem alocações de venda.</p>
        ) : (
          <ul className="space-y-2 text-sm text-cinza-preto">
            {alocacoesVenda.map((aloc, index) => (
              <li key={`venda-${index}`} className="rounded border border-gray-200 p-2">
                {aloc.dias} dias • aquisitivo {formatDateSafe(aloc.ferias_periodos?.aquisitivo_inicio)} até {formatDateSafe(aloc.ferias_periodos?.aquisitivo_fim)} • vencimento {formatDateSafe(aloc.ferias_periodos?.data_vencimento)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  )
}
