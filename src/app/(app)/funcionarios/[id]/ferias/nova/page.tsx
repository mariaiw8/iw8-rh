'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { listarPeriodosComSaldo, gerarAlocacoesGuloso, criarFeriasProgramadaRPC } from '@/services/feriasService'
import type { AlocacaoInput, FeriasPeriodoSaldo, FeriasTipo } from '@/types/ferias'
import { formatDateSafe } from '@/lib/dateUtils'

export default function NovaFeriasPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const funcionarioId = params.id

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [dias, setDias] = useState(0)
  const [tipo, setTipo] = useState<FeriasTipo>('Individual')
  const [diasVendidos, setDiasVendidos] = useState(0)
  const [abono, setAbono] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [periodos, setPeriodos] = useState<FeriasPeriodoSaldo[]>([])
  const [alocGozo, setAlocGozo] = useState<AlocacaoInput[]>([])
  const [alocVenda, setAlocVenda] = useState<AlocacaoInput[]>([])
  const [loading, setLoading] = useState(false)

  const periodosMap = useMemo(
    () => Object.fromEntries(periodos.map((p) => [p.id, p])),
    [periodos]
  )

  async function simular() {
    setLoading(true)
    try {
      const periodosComSaldo = await listarPeriodosComSaldo(funcionarioId)
      const gozo = gerarAlocacoesGuloso(periodosComSaldo, dias)
      const venda = diasVendidos > 0 ? gerarAlocacoesGuloso(periodosComSaldo, diasVendidos) : []

      setPeriodos(periodosComSaldo)
      setAlocGozo(gozo)
      setAlocVenda(venda)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao simular alocação.')
    } finally {
      setLoading(false)
    }
  }

  async function salvarProgramada() {
    setLoading(true)
    try {
      const feriasId = await criarFeriasProgramadaRPC({
        funcionarioId,
        dataInicio,
        dataFim,
        dias,
        tipo,
        diasVendidos,
        abono,
        observacao: observacao || null,
        alocGozo,
        alocVenda,
      })
      router.push(`/ferias/${feriasId}`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar férias.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer className="space-y-6">
      <h1 className="text-2xl font-bold text-cinza-preto">Nova férias</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados da solicitação</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input type="date" label="Data início" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <Input type="date" label="Data fim" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          <Input type="number" min={1} label="Dias" value={dias} onChange={(e) => setDias(Number(e.target.value))} />
          <Select
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as FeriasTipo)}
            options={[
              { value: 'Individual', label: 'Individual' },
              { value: 'Coletiva', label: 'Coletiva' },
            ]}
          />
          <Input
            type="number"
            min={0}
            label="Dias vendidos"
            value={diasVendidos}
            onChange={(e) => setDiasVendidos(Number(e.target.value))}
          />
          <label className="flex items-center gap-2 text-sm text-cinza-preto">
            <input type="checkbox" checked={abono} onChange={(e) => setAbono(e.target.checked)} />
            Abono pecuniário
          </label>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-cinza-preto">Observação</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-cinza-preto focus:border-transparent focus:outline-none focus:ring-2 focus:ring-laranja"
              rows={4}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={simular} disabled={loading}>Simular alocação</Button>
          <Button variant="primary" onClick={salvarProgramada} disabled={loading || alocGozo.length === 0}>
            Salvar como Programada
          </Button>
        </div>
      </Card>

      {(alocGozo.length > 0 || alocVenda.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Simulação de alocação</CardTitle>
          </CardHeader>

          <div className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-cinza-preto">Gozo</h2>
              <ul className="space-y-2 text-sm text-cinza-preto">
                {alocGozo.map((item, index) => {
                  const periodo = periodosMap[item.ferias_periodo_id]
                  return (
                    <li key={`${item.ferias_periodo_id}-${index}`} className="rounded border border-gray-200 p-2">
                      {item.dias} dias • vence em {periodo ? formatDateSafe(periodo.data_vencimento) : '-'}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-cinza-preto">Venda</h2>
              {alocVenda.length === 0 ? (
                <p className="text-sm text-cinza-escuro">Sem venda de dias.</p>
              ) : (
                <ul className="space-y-2 text-sm text-cinza-preto">
                  {alocVenda.map((item, index) => {
                    const periodo = periodosMap[item.ferias_periodo_id]
                    return (
                      <li key={`${item.ferias_periodo_id}-venda-${index}`} className="rounded border border-gray-200 p-2">
                        {item.dias} dias • vence em {periodo ? formatDateSafe(periodo.data_vencimento) : '-'}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}
    </PageContainer>
  )
}
