// ─── PERÍODOS AQUISITIVOS ───────────────────────────────────────────────────

export interface FeriasPeriodo {
  id: string
  funcionario_id: string
  aquisitivo_inicio: string   // 'YYYY-MM-DD'
  aquisitivo_fim: string      // 'YYYY-MM-DD'
  data_vencimento: string     // 'YYYY-MM-DD'
  dias_direito: number
  created_at: string
  updated_at: string
}

export interface FeriasPeriodoSaldo extends FeriasPeriodo {
  creditos_extras: number
  debitos: number
  dias_restantes: number
  status_calculado: 'Disponível' | 'Parcial' | 'Gozado' | 'Vencido'
}

// ─── FÉRIAS ─────────────────────────────────────────────────────────────────

export type FeriasStatus = 'Programada' | 'Aprovada' | 'Em Andamento' | 'Concluída' | 'Cancelada'
export type FeriasTipo = 'Individual' | 'Coletiva'

export interface Ferias {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  dias: number
  tipo: FeriasTipo
  abono_pecuniario: boolean
  dias_vendidos: number
  observacao: string | null
  status: FeriasStatus
  created_at: string
  updated_at: string
}

export interface FeriasComFuncionario extends Ferias {
  funcionarios: {
    nome_completo: string
    codigo: string | null
    unidade_id: string | null
    setor_id: string | null
    unidades?: { titulo: string } | null
    setores?: { titulo: string } | null
  }
}

// ─── ALOCAÇÕES ──────────────────────────────────────────────────────────────

export interface FeriasAlocacao {
  id: string
  ferias_id: string
  ferias_periodo_id: string
  dias: number
  created_at: string
}

export interface FeriasVendaAlocacao {
  id: string
  ferias_id: string
  ferias_periodo_id: string
  dias: number
  created_at: string
}

// ─── MOVIMENTAÇÕES (ledger, somente leitura) ────────────────────────────────

export type MovimentacaoNatureza = 'Crédito' | 'Débito'
export type MovimentacaoTipo =
  | 'Gozo'
  | 'Venda/Abono'
  | 'Coletiva'
  | 'Desconto Ocorrencia'
  | 'Ajuste Manual'
  | 'Estorno'

export interface FeriasMovimentacao {
  id: string
  ferias_periodo_id: string
  data: string
  natureza: MovimentacaoNatureza
  tipo: MovimentacaoTipo
  dias: number
  origem_tabela: string | null
  origem_id: string | null
  observacao: string | null
  created_at: string
}

// ─── PAYLOADS ───────────────────────────────────────────────────────────────

export interface AlocacaoPayload {
  ferias_periodo_id: string
  dias: number
}

export interface CriarFeriasPayload {
  funcionario_id: string
  data_inicio: string
  data_fim: string
  dias: number
  tipo: FeriasTipo
  abono_pecuniario: boolean
  dias_vendidos: number
  observacao?: string | null
  alocacoes_gozo: AlocacaoPayload[]
  alocacoes_venda: AlocacaoPayload[]
}

export interface CriarPeriodoPayload {
  funcionario_id: string
  aquisitivo_inicio: string
  aquisitivo_fim: string
  data_vencimento: string
  dias_direito?: number
}

// ─── HELPERS DE UI ──────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string
  textColor: string
  bgColor: string
  borderColor: string
}
