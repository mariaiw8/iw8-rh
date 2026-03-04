import { createClient } from '@/lib/supabase'
import type {
  FeriasPeriodoSaldo,
  Ferias,
  FeriasComFuncionario,
  FeriasMovimentacao,
  CriarFeriasPayload,
  CriarPeriodoPayload,
  AlocacaoPayload,
} from '@/types/ferias'

const supabase = createClient()

// ══════════════════════════════════════════════════════════════════════════════
// PERÍODOS
// ══════════════════════════════════════════════════════════════════════════════

/** Busca todos os períodos de um funcionário com saldo calculado */
export async function getPeriodosByFuncionario(
  funcionarioId: string
): Promise<FeriasPeriodoSaldo[]> {
  const { data, error } = await supabase
    .from('v_ferias_periodos_saldo')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('aquisitivo_inicio', { ascending: false })
  if (error) throw new Error(`Erro ao buscar períodos: ${error.message}`)
  return data ?? []
}

/** Busca períodos com saldo disponível, ordenados por vencimento (mais urgente primeiro) */
export async function getPeriodosDisponiveisByFuncionario(
  funcionarioId: string
): Promise<FeriasPeriodoSaldo[]> {
  const { data, error } = await supabase
    .from('v_ferias_periodos_saldo')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .gt('dias_restantes', 0)
    .neq('status_calculado', 'Vencido')
    .order('data_vencimento', { ascending: true })
  if (error) throw new Error(`Erro ao buscar períodos disponíveis: ${error.message}`)
  return data ?? []
}

/** Cria um novo período aquisitivo para um funcionário */
export async function criarPeriodo(payload: CriarPeriodoPayload) {
  const { data, error } = await supabase
    .from('ferias_periodos')
    .insert({
      funcionario_id: payload.funcionario_id,
      aquisitivo_inicio: payload.aquisitivo_inicio,
      aquisitivo_fim: payload.aquisitivo_fim,
      data_vencimento: payload.data_vencimento,
      dias_direito: payload.dias_direito ?? 30,
    })
    .select()
    .single()
  if (error) throw new Error(`Erro ao criar período: ${error.message}`)
  return data
}

/** Deleta um período (só permitido se não tiver movimentações) */
export async function deletarPeriodo(periodoId: string) {
  const { error } = await supabase
    .from('ferias_periodos')
    .delete()
    .eq('id', periodoId)
  if (error) throw new Error(`Erro ao deletar período: ${error.message}`)
}

// ══════════════════════════════════════════════════════════════════════════════
// FÉRIAS
// ══════════════════════════════════════════════════════════════════════════════

/** Busca todas as férias de um funcionário */
export async function getFeriasByFuncionario(funcionarioId: string): Promise<Ferias[]> {
  const { data, error } = await supabase
    .from('ferias')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('data_inicio', { ascending: false })
  if (error) throw new Error(`Erro ao buscar férias: ${error.message}`)
  return data ?? []
}

/** Busca todas as férias com dados do funcionário (para aba global de férias) */
export async function getAllFerias(filtros?: {
  status?: string
  tipo?: string
  unidade_id?: string
  setor_id?: string
  dataInicio?: string
  dataFim?: string
}): Promise<FeriasComFuncionario[]> {
  let query = supabase
    .from('ferias')
    .select(`
      *,
      funcionarios (
        nome_completo,
        codigo,
        unidade_id,
        setor_id,
        unidades:unidade_id ( titulo ),
        setores:setor_id ( titulo )
      )
    `)
    .order('data_inicio', { ascending: false })

  if (filtros?.status)     query = query.eq('status', filtros.status)
  if (filtros?.tipo)       query = query.eq('tipo', filtros.tipo)
  if (filtros?.dataInicio) query = query.gte('data_inicio', filtros.dataInicio)
  if (filtros?.dataFim)    query = query.lte('data_fim', filtros.dataFim)

  const { data, error } = await query
  if (error) throw new Error(`Erro ao buscar férias: ${error.message}`)
  return (data ?? []) as FeriasComFuncionario[]
}

/**
 * Calcula a distribuição automática de dias entre períodos disponíveis.
 * Prioriza o período que vence primeiro (FIFO por vencimento).
 * NÃO salva nada — apenas retorna o plano de alocação para preview.
 */
export async function calcularAlocacoesAutomaticas(
  funcionarioId: string,
  diasGozo: number,
  diasVenda: number
): Promise<{
  alocacoesGozo: AlocacaoPayload[]
  alocacoesVenda: AlocacaoPayload[]
  saldoTotalDisponivel: number
  periodos: FeriasPeriodoSaldo[]
}> {
  const periodos = await getPeriodosDisponiveisByFuncionario(funcionarioId)
  const saldoTotal = periodos.reduce((acc, p) => acc + p.dias_restantes, 0)
  const totalNecessario = diasGozo + diasVenda

  if (totalNecessario > saldoTotal) {
    throw new Error(
      `Saldo insuficiente. Disponível: ${saldoTotal} dias, necessário: ${totalNecessario} dias.`
    )
  }

  // Distribuir dias de gozo (mais urgente primeiro)
  let restanteGozo = diasGozo
  const alocacoesGozo: AlocacaoPayload[] = []
  const saldoAposGozo = new Map<string, number>()

  for (const p of periodos) {
    saldoAposGozo.set(p.id, p.dias_restantes)
    if (restanteGozo <= 0) continue
    const usar = Math.min(restanteGozo, p.dias_restantes)
    if (usar > 0) {
      alocacoesGozo.push({ ferias_periodo_id: p.id, dias: usar })
      saldoAposGozo.set(p.id, p.dias_restantes - usar)
      restanteGozo -= usar
    }
  }

  // Distribuir dias de venda (sobre o saldo restante após gozo)
  let restanteVenda = diasVenda
  const alocacoesVenda: AlocacaoPayload[] = []

  for (const p of periodos) {
    if (restanteVenda <= 0) break
    const disponivelAposGozo = saldoAposGozo.get(p.id) ?? 0
    if (disponivelAposGozo <= 0) continue
    const usar = Math.min(restanteVenda, disponivelAposGozo)
    alocacoesVenda.push({ ferias_periodo_id: p.id, dias: usar })
    restanteVenda -= usar
  }

  return { alocacoesGozo, alocacoesVenda, saldoTotalDisponivel: saldoTotal, periodos }
}

/**
 * Cria férias com alocações de período.
 * Fluxo: INSERT ferias → INSERT ferias_alocacoes → INSERT ferias_venda_alocacoes
 * Status inicial sempre 'Programada' (não debita saldo ainda).
 */
export async function criarFerias(payload: CriarFeriasPayload): Promise<Ferias> {
  // 1. Criar o registro de férias
  const { data: ferias, error: errFerias } = await supabase
    .from('ferias')
    .insert({
      funcionario_id: payload.funcionario_id,
      data_inicio: payload.data_inicio,
      data_fim: payload.data_fim,
      dias: payload.dias,
      tipo: payload.tipo,
      abono_pecuniario: payload.abono_pecuniario,
      dias_vendidos: payload.dias_vendidos,
      observacao: payload.observacao ?? null,
      status: 'Programada',
    })
    .select()
    .single()
  if (errFerias) throw new Error(`Erro ao criar férias: ${errFerias.message}`)

  // 2. Inserir alocações de gozo
  if (payload.alocacoes_gozo.length > 0) {
    const { error } = await supabase
      .from('ferias_alocacoes')
      .insert(
        payload.alocacoes_gozo.map(a => ({
          ferias_id: ferias.id,
          ferias_periodo_id: a.ferias_periodo_id,
          dias: a.dias,
        }))
      )
    if (error) throw new Error(`Erro ao criar alocações de gozo: ${error.message}`)
  }

  // 3. Inserir alocações de venda (se houver abono pecuniário)
  if (payload.alocacoes_venda.length > 0) {
    const { error } = await supabase
      .from('ferias_venda_alocacoes')
      .insert(
        payload.alocacoes_venda.map(a => ({
          ferias_id: ferias.id,
          ferias_periodo_id: a.ferias_periodo_id,
          dias: a.dias,
        }))
      )
    if (error) throw new Error(`Erro ao criar alocações de venda: ${error.message}`)
  }

  return ferias
}

/**
 * Atualiza o status de uma férias.
 * Os triggers do banco cuidam automaticamente de debitar/estornar o ledger.
 * Aprovada → debita | Cancelada → estorna | outros → mantém débito
 */
export async function atualizarStatusFerias(
  feriasId: string,
  novoStatus: 'Aprovada' | 'Em Andamento' | 'Concluída' | 'Cancelada'
): Promise<void> {
  const { error } = await supabase
    .from('ferias')
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq('id', feriasId)
  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`)
}

/**
 * Deleta férias. Só funciona se status for 'Programada'.
 * Férias Aprovadas ou posteriores devem ser Canceladas, não deletadas.
 */
export async function deletarFerias(feriasId: string): Promise<void> {
  const { error } = await supabase
    .from('ferias')
    .delete()
    .eq('id', feriasId)
    .eq('status', 'Programada')
  if (error) throw new Error(`Erro ao deletar férias: ${error.message}`)
}

/** Busca alocações de uma férias (para exibir no detalhe) */
export async function getAlocacoesByFerias(feriasId: string) {
  const [gozo, venda] = await Promise.all([
    supabase
      .from('ferias_alocacoes')
      .select('*, ferias_periodos(aquisitivo_inicio, aquisitivo_fim, data_vencimento)')
      .eq('ferias_id', feriasId),
    supabase
      .from('ferias_venda_alocacoes')
      .select('*, ferias_periodos(aquisitivo_inicio, aquisitivo_fim, data_vencimento)')
      .eq('ferias_id', feriasId),
  ])
  if (gozo.error) throw new Error(gozo.error.message)
  if (venda.error) throw new Error(venda.error.message)
  return { alocacoesGozo: gozo.data ?? [], alocacoesVenda: venda.data ?? [] }
}

// ══════════════════════════════════════════════════════════════════════════════
// MOVIMENTAÇÕES (ledger — somente leitura)
// ══════════════════════════════════════════════════════════════════════════════

/** Busca extrato de movimentações de um período específico */
export async function getMovimentacoesByPeriodo(
  periodoId: string
): Promise<FeriasMovimentacao[]> {
  const { data, error } = await supabase
    .from('ferias_movimentacoes')
    .select('*')
    .eq('ferias_periodo_id', periodoId)
    .order('data', { ascending: false })
  if (error) throw new Error(`Erro ao buscar movimentações: ${error.message}`)
  return data ?? []
}

/** Busca todas as movimentações de um funcionário (todos os períodos) */
export async function getMovimentacoesByFuncionario(
  funcionarioId: string
): Promise<(FeriasMovimentacao & { ferias_periodos: { aquisitivo_inicio: string; aquisitivo_fim: string } })[]> {
  const { data, error } = await supabase
    .from('ferias_movimentacoes')
    .select('*, ferias_periodos!inner(funcionario_id, aquisitivo_inicio, aquisitivo_fim)')
    .eq('ferias_periodos.funcionario_id', funcionarioId)
    .order('data', { ascending: false })
  if (error) throw new Error(`Erro ao buscar movimentações: ${error.message}`)
  return (data ?? []) as any
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS DE UI
// ══════════════════════════════════════════════════════════════════════════════

export function getStatusFeriasConfig(status: string) {
  const map: Record<string, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
    'Programada':   { label: 'Programada',   textColor: 'text-gray-600',    bgColor: 'bg-gray-100',    borderColor: 'border-gray-300'  },
    'Aprovada':     { label: 'Aprovada',      textColor: 'text-laranja',     bgColor: 'bg-orange-50',   borderColor: 'border-laranja'   },
    'Em Andamento': { label: 'Em Andamento',  textColor: 'text-azul-medio',  bgColor: 'bg-blue-50',     borderColor: 'border-azul'      },
    'Concluída':    { label: 'Concluída',     textColor: 'text-green-700',   bgColor: 'bg-green-50',    borderColor: 'border-green-200' },
    'Cancelada':    { label: 'Cancelada',     textColor: 'text-red-700',     bgColor: 'bg-red-50',      borderColor: 'border-red-200'   },
  }
  return map[status] ?? { label: status, textColor: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' }
}

export function getStatusPeriodoConfig(status: string) {
  const map: Record<string, { label: string; textColor: string; bgColor: string }> = {
    'Disponível': { label: 'Disponível', textColor: 'text-green-700', bgColor: 'bg-green-50'  },
    'Parcial':    { label: 'Parcial',    textColor: 'text-laranja',   bgColor: 'bg-orange-50' },
    'Gozado':     { label: 'Gozado',     textColor: 'text-azul-medio',bgColor: 'bg-blue-50'   },
    'Vencido':    { label: 'Vencido',    textColor: 'text-red-700',   bgColor: 'bg-red-50'    },
  }
  return map[status] ?? { label: status, textColor: 'text-gray-600', bgColor: 'bg-gray-100' }
}

/** Calcula dias corridos entre duas datas (inclusive) */
export function calcularDiasCorridos(dataInicio: string, dataFim: string): number {
  const d1 = new Date(dataInicio + 'T00:00:00')
  const d2 = new Date(dataFim + 'T00:00:00')
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
}

/** Formata data 'YYYY-MM-DD' para 'DD/MM/YYYY' */
export function formatarData(data: string | null | undefined): string {
  if (!data) return '—'
  const [y, m, d] = data.split('-')
  return `${d}/${m}/${y}`
}

/** Formata período aquisitivo para exibição: "Jun/2024 – Jun/2025" */
export function formatarPeriodoAquisitivo(inicio: string, fim: string): string {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [yi, mi] = inicio.split('-')
  const [yf, mf] = fim.split('-')
  return `${meses[parseInt(mi) - 1]}/${yi} – ${meses[parseInt(mf) - 1]}/${yf}`
}
