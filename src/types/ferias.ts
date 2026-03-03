export type FeriasStatus = 'Programada' | 'Aprovada' | 'Em Andamento' | 'Concluída' | 'Cancelada';
export type FeriasTipo = 'Individual' | 'Coletiva';

export type Ferias = {
  id: string;
  funcionario_id: string;
  data_inicio: string;
  data_fim: string;
  dias: number;
  tipo: FeriasTipo;
  dias_vendidos: number;
  abono_pecuniario: boolean;
  observacao?: string | null;
  status: FeriasStatus;
  created_at?: string;
  updated_at?: string;
};

export type FeriasPeriodoSaldo = {
  id: string;
  funcionario_id: string;
  aquisitivo_inicio: string;
  aquisitivo_fim: string;
  data_vencimento: string;
  dias_direito: number;
  creditos_extras: number;
  debitos: number;
  dias_restantes: number;
  status_calculado: 'Disponível' | 'Parcial' | 'Gozado' | 'Vencido';
};

export type AlocacaoInput = { ferias_periodo_id: string; dias: number };

export type FeriasAlocacaoRow = {
  dias: number;
  ferias_periodos: {
    data_vencimento: string;
    aquisitivo_inicio: string;
    aquisitivo_fim: string;
  } | null;
};
