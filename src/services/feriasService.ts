import { supabase } from '@/lib/supabase';
import type { AlocacaoInput, Ferias, FeriasPeriodoSaldo, FeriasTipo, FeriasAlocacaoRow } from '@/types/ferias';

const todayISO = () => new Date().toISOString().slice(0, 10);

export async function listarPeriodosComSaldo(funcionarioId: string): Promise<FeriasPeriodoSaldo[]> {
  const { data, error } = await supabase
    .from('v_ferias_periodos_saldo')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .gte('data_vencimento', todayISO())
    .gt('dias_restantes', 0)
    .order('data_vencimento', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FeriasPeriodoSaldo[];
}

export function gerarAlocacoesGuloso(
  periodos: { id: string; dias_restantes: number }[],
  totalDias: number
): AlocacaoInput[] {
  let restante = totalDias;
  const alocs: AlocacaoInput[] = [];

  for (const p of periodos) {
    if (restante <= 0) break;
    const usar = Math.min(restante, p.dias_restantes);
    if (usar > 0) alocs.push({ ferias_periodo_id: p.id, dias: usar });
    restante -= usar;
  }

  if (restante > 0) {
    throw new Error('Saldo insuficiente para alocar os dias solicitados.');
  }
  return alocs;
}

export async function criarFeriasProgramadaRPC(params: {
  funcionarioId: string;
  dataInicio: string;
  dataFim: string;
  dias: number;
  tipo: FeriasTipo;
  diasVendidos: number;
  abono: boolean;
  observacao?: string | null;
  alocGozo: AlocacaoInput[];
  alocVenda: AlocacaoInput[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_criar_ferias_programada', {
    p_funcionario_id: params.funcionarioId,
    p_data_inicio: params.dataInicio,
    p_data_fim: params.dataFim,
    p_dias: params.dias,
    p_tipo: params.tipo,
    p_dias_vendidos: params.diasVendidos ?? 0,
    p_abono: params.abono ?? false,
    p_observacao: params.observacao ?? null,
    p_aloc_gozo: params.alocGozo ?? [],
    p_aloc_venda: params.alocVenda ?? [],
  });

  if (error) throw error;
  return data as string;
}

export async function aprovarFeriasRPC(feriasId: string) {
  const { error } = await supabase.rpc('rpc_aprovar_ferias', { p_ferias_id: feriasId });
  if (error) throw error;
}

export async function cancelarFeriasRPC(feriasId: string) {
  const { error } = await supabase.rpc('rpc_cancelar_ferias', { p_ferias_id: feriasId });
  if (error) throw error;
}

export async function buscarAlocacoes(feriasId: string): Promise<FeriasAlocacaoRow[]> {
  const { data, error } = await supabase
    .from('ferias_alocacoes')
    .select('dias, ferias_periodos(data_vencimento,aquisitivo_inicio,aquisitivo_fim)')
    .eq('ferias_id', feriasId)
    .order('ferias_periodos.data_vencimento', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FeriasAlocacaoRow[];
}

export async function buscarAlocacoesVenda(feriasId: string): Promise<FeriasAlocacaoRow[]> {
  const { data, error } = await supabase
    .from('ferias_venda_alocacoes')
    .select('dias, ferias_periodos(data_vencimento,aquisitivo_inicio,aquisitivo_fim)')
    .eq('ferias_id', feriasId)
    .order('ferias_periodos.data_vencimento', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FeriasAlocacaoRow[];
}

export async function listarFeriasFuncionario(funcionarioId: string): Promise<Ferias[]> {
  const { data, error } = await supabase
    .from('ferias')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('data_inicio', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Ferias[];
}
