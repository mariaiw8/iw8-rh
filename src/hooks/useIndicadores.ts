'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface IndicadoresData {
  turnover: number
  turnoverHistorico: { mes: string; valor: number }[]
  absenteismo: number
  tempoMedioEmpresa: string
  tempoMedioDias: number
  custoMedioPorFuncionario: number
  headcountHistorico: { mes: string; total: number }[]
  distribuicaoTipoSetor: { tipo: string; funcionarios: number }[]
  faixasTempoEmpresa: { faixa: string; funcionarios: number }[]
  ocorrenciasPorCategoria: { categoria: string; total: number }[]
}

function diasUteisMes(ano: number, mes: number): number {
  // mes is 0-indexed
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  let uteis = 0
  for (let d = 1; d <= diasNoMes; d++) {
    const dia = new Date(ano, mes, d).getDay()
    if (dia !== 0 && dia !== 6) uteis++
  }
  return uteis
}

function formatMesAno(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

export function useIndicadores() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const loadIndicadores = useCallback(async (): Promise<IndicadoresData> => {
    setLoading(true)
    try {
      const now = new Date()
      const mesAtual = now.getMonth()
      const anoAtual = now.getFullYear()

      // Parallel queries
      const [
        ativosRes,
        todosRes,
        ocorrenciasRes,
        tiposOcorrenciaRes,
        setoresRes,
        salarioRes,
      ] = await Promise.all([
        supabase.from('funcionarios').select('id, data_admissao, data_desligamento, setor_id, status'),
        supabase.from('funcionarios').select('id, data_admissao, data_desligamento, status'),
        supabase.from('ocorrencias').select('tipo_ocorrencia_id, dias, data_inicio'),
        supabase.from('tipos_ocorrencia').select('id, categoria'),
        supabase.from('setores').select('id, tipo'),
        supabase.from('vw_salario_atual').select('funcionario_id, salario_bruto, custo_funcionario'),
      ])

      const funcionarios = ativosRes.data || []
      const todos = todosRes.data || []
      const ativos = funcionarios.filter((f) => f.status === 'Ativo')
      const totalAtivos = ativos.length

      // --- TURNOVER ---
      const inicioMesAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`
      const fimMesAtual = new Date(anoAtual, mesAtual + 1, 0).toISOString().split('T')[0]

      const desligamentosMes = todos.filter((f) =>
        f.data_desligamento && f.data_desligamento >= inicioMesAtual && f.data_desligamento <= fimMesAtual
      ).length

      // Count active at start of month and end of month
      const ativosInicioMes = todos.filter((f) => {
        const admitido = f.data_admissao && f.data_admissao < inicioMesAtual
        const naoDesligado = !f.data_desligamento || f.data_desligamento >= inicioMesAtual
        return admitido && naoDesligado
      }).length || totalAtivos

      const mediaFunc = ((ativosInicioMes + totalAtivos) / 2) || 1
      const turnover = (desligamentosMes / mediaFunc) * 100

      // Turnover historico - ultimos 6 meses
      const turnoverHistorico: { mes: string; valor: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anoAtual, mesAtual - i, 1)
        const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        const desl = todos.filter((f) =>
          f.data_desligamento && f.data_desligamento >= inicio && f.data_desligamento <= fim
        ).length
        const media = totalAtivos || 1
        turnoverHistorico.push({
          mes: formatMesAno(d),
          valor: parseFloat(((desl / media) * 100).toFixed(1)),
        })
      }

      // --- ABSENTEISMO ---
      const tiposCategoriaMap = new Map<string, string>()
      for (const t of (tiposOcorrenciaRes.data || [])) {
        tiposCategoriaMap.set(t.id, t.categoria)
      }

      const ocorrenciasMes = (ocorrenciasRes.data || []).filter((o) => {
        return o.data_inicio >= inicioMesAtual && o.data_inicio <= fimMesAtual
      })

      const diasAusencia = ocorrenciasMes
        .filter((o) => tiposCategoriaMap.get(o.tipo_ocorrencia_id) === 'Ausência')
        .reduce((sum, o) => sum + (o.dias || 0), 0)

      const diasUteis = diasUteisMes(anoAtual, mesAtual)
      const absenteismo = totalAtivos > 0 ? (diasAusencia / (diasUteis * totalAtivos)) * 100 : 0

      // --- TEMPO MEDIO DE EMPRESA ---
      const hoje = new Date()
      let totalDias = 0
      let count = 0
      for (const f of ativos) {
        if (f.data_admissao) {
          const admissao = new Date(f.data_admissao + 'T00:00:00')
          const diff = Math.floor((hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24))
          totalDias += diff
          count++
        }
      }

      const tempoMedioDias = count > 0 ? Math.floor(totalDias / count) : 0
      const anos = Math.floor(tempoMedioDias / 365)
      const meses = Math.floor((tempoMedioDias % 365) / 30)
      const tempoMedioEmpresa = anos > 0 ? `${anos} ano${anos > 1 ? 's' : ''} e ${meses} mes${meses !== 1 ? 'es' : ''}` : `${meses} mes${meses !== 1 ? 'es' : ''}`

      // --- CUSTO MEDIO POR FUNCIONARIO ---
      const salarios = salarioRes.data || []
      const custoTotal = salarios.reduce((s, r) => s + (r.custo_funcionario || r.salario_bruto || 0), 0)
      const custoMedioPorFuncionario = totalAtivos > 0 ? custoTotal / totalAtivos : 0

      // --- HEADCOUNT HISTORICO (12 meses) ---
      const headcountHistorico: { mes: string; total: number }[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(anoAtual, mesAtual - i, 1)
        const fimDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        const ativosNoMes = todos.filter((f) => {
          const admitido = f.data_admissao && f.data_admissao <= fimDoMes
          const naoDesligado = !f.data_desligamento || f.data_desligamento > fimDoMes
          return admitido && naoDesligado
        }).length
        headcountHistorico.push({
          mes: formatMesAno(d),
          total: ativosNoMes,
        })
      }

      // --- DISTRIBUICAO POR TIPO DE SETOR ---
      const setorTipoMap = new Map<string, string>()
      for (const s of (setoresRes.data || [])) {
        setorTipoMap.set(s.id, s.tipo || 'Outro')
      }

      const tipoCount: Record<string, number> = {}
      for (const f of ativos) {
        const tipo = f.setor_id ? (setorTipoMap.get(f.setor_id) || 'Outro') : 'Outro'
        tipoCount[tipo] = (tipoCount[tipo] || 0) + 1
      }
      const distribuicaoTipoSetor = Object.entries(tipoCount).map(([tipo, funcionarios]) => ({
        tipo,
        funcionarios,
      }))

      // --- FAIXAS DE TEMPO DE EMPRESA ---
      const faixas = { '< 1 ano': 0, '1-3 anos': 0, '3-5 anos': 0, '5-10 anos': 0, '10+ anos': 0 }
      for (const f of ativos) {
        if (f.data_admissao) {
          const admissao = new Date(f.data_admissao + 'T00:00:00')
          const diffAnos = (hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
          if (diffAnos < 1) faixas['< 1 ano']++
          else if (diffAnos < 3) faixas['1-3 anos']++
          else if (diffAnos < 5) faixas['3-5 anos']++
          else if (diffAnos < 10) faixas['5-10 anos']++
          else faixas['10+ anos']++
        }
      }
      const faixasTempoEmpresa = Object.entries(faixas).map(([faixa, funcionarios]) => ({
        faixa,
        funcionarios,
      }))

      // --- OCORRENCIAS POR CATEGORIA (mes atual) ---
      const catCount: Record<string, number> = {}
      for (const o of ocorrenciasMes) {
        const cat = tiposCategoriaMap.get(o.tipo_ocorrencia_id) || 'Outro'
        catCount[cat] = (catCount[cat] || 0) + 1
      }
      const ocorrenciasPorCategoria = Object.entries(catCount).map(([categoria, total]) => ({
        categoria,
        total,
      }))

      return {
        turnover: parseFloat(turnover.toFixed(1)),
        turnoverHistorico,
        absenteismo: parseFloat(absenteismo.toFixed(1)),
        tempoMedioEmpresa,
        tempoMedioDias,
        custoMedioPorFuncionario,
        headcountHistorico,
        distribuicaoTipoSetor,
        faixasTempoEmpresa,
        ocorrenciasPorCategoria,
      }
    } catch (err) {
      console.error('Erro ao carregar indicadores:', err)
      return {
        turnover: 0,
        turnoverHistorico: [],
        absenteismo: 0,
        tempoMedioEmpresa: '0 meses',
        tempoMedioDias: 0,
        custoMedioPorFuncionario: 0,
        headcountHistorico: [],
        distribuicaoTipoSetor: [],
        faixasTempoEmpresa: [],
        ocorrenciasPorCategoria: [],
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, loadIndicadores }
}
