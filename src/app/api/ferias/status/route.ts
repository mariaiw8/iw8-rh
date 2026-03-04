import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * PATCH /api/ferias/status
 * Atualiza o status de férias usando service role (bypassa RLS).
 * Gerencia o ledger de movimentações diretamente (sem depender de triggers).
 * Usa SQL raw para bypassar triggers de validação de saldo no banco.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { feriasId, novoStatus } = await request.json()

    if (!feriasId || !novoStatus) {
      return NextResponse.json({ error: 'feriasId e novoStatus são obrigatórios' }, { status: 400 })
    }

    const validStatuses = ['Aprovada', 'Em Andamento', 'Concluída', 'Cancelada']
    if (!validStatuses.includes(novoStatus)) {
      return NextResponse.json({ error: `Status inválido: ${novoStatus}` }, { status: 400 })
    }

    const admin = createAdminClient()

    // Busca férias com alocações para validar antes de atualizar
    const { data: ferias, error: errFetch } = await admin
      .from('ferias')
      .select('id, status, dias, dias_vendidos, funcionario_id')
      .eq('id', feriasId)
      .single()

    if (errFetch || !ferias) {
      return NextResponse.json({ error: 'Férias não encontrada' }, { status: 404 })
    }

    if (ferias.status === novoStatus) {
      return NextResponse.json({ ok: true, message: 'Status já é o mesmo' })
    }

    // Validação de saldo antes de aprovar
    if (novoStatus === 'Aprovada') {
      const validacao = await validarSaldoParaAprovacao(admin, feriasId, ferias.funcionario_id)
      if (!validacao.ok) {
        return NextResponse.json({ error: validacao.error }, { status: 400 })
      }
    }

    // Atualiza status usando SQL raw para bypassar triggers de validação
    const { error: errUpdate } = await admin.rpc('fn_atualizar_status_ferias_bypass', {
      p_ferias_id: feriasId,
      p_novo_status: novoStatus,
    })

    // Se o RPC não existe, tenta update direto
    if (errUpdate && errUpdate.message?.includes('function') && errUpdate.message?.includes('does not exist')) {
      const { error: errDirect } = await admin
        .from('ferias')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', feriasId)

      if (errDirect) {
        return NextResponse.json({ error: `Erro ao atualizar: ${errDirect.message}` }, { status: 500 })
      }
    } else if (errUpdate) {
      return NextResponse.json({ error: `Erro ao atualizar: ${errUpdate.message}` }, { status: 500 })
    }

    // Gerenciar ledger de movimentações (verifica se trigger já inseriu antes de duplicar)
    if (novoStatus === 'Aprovada') {
      await debitarLedgerSemDuplicar(admin, feriasId)
    } else if (novoStatus === 'Cancelada') {
      await estornarLedger(admin, feriasId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro em PATCH /api/ferias/status:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

/**
 * Valida se há saldo suficiente nos períodos para aprovar as férias.
 * Verifica cada alocação contra o saldo disponível no período.
 */
async function validarSaldoParaAprovacao(
  admin: ReturnType<typeof createAdminClient>,
  feriasId: string,
  funcionarioId: string
): Promise<{ ok: boolean; error?: string }> {
  // Busca alocações de gozo
  const { data: alocacoesGozo } = await admin
    .from('ferias_alocacoes')
    .select('ferias_periodo_id, dias')
    .eq('ferias_id', feriasId)

  // Busca alocações de venda
  const { data: alocacoesVenda } = await admin
    .from('ferias_venda_alocacoes')
    .select('ferias_periodo_id, dias')
    .eq('ferias_id', feriasId)

  const todasAlocacoes = [...(alocacoesGozo ?? []), ...(alocacoesVenda ?? [])]
  if (todasAlocacoes.length === 0) {
    // Sem alocações — permite aprovação (férias sem débito de período, e.g. ajuste manual)
    return { ok: true }
  }

  // Agrupa dias por período
  const diasPorPeriodo = new Map<string, number>()
  for (const a of todasAlocacoes) {
    diasPorPeriodo.set(a.ferias_periodo_id, (diasPorPeriodo.get(a.ferias_periodo_id) ?? 0) + a.dias)
  }

  // Busca saldo atual dos períodos envolvidos
  const periodoIds = Array.from(diasPorPeriodo.keys())
  const { data: periodos } = await admin
    .from('v_ferias_periodos_saldo')
    .select('id, dias_restantes, aquisitivo_inicio, aquisitivo_fim')
    .in('id', periodoIds)

  if (!periodos) {
    return { ok: false, error: 'Não foi possível verificar saldo dos períodos' }
  }

  for (const p of periodos) {
    const diasNecessarios = diasPorPeriodo.get(p.id) ?? 0
    const saldoApos = (p.dias_restantes ?? 0) - diasNecessarios
    if (saldoApos < 0) {
      return {
        ok: false,
        error: `Saldo insuficiente no período ${p.aquisitivo_inicio} a ${p.aquisitivo_fim}. ` +
          `Disponível: ${p.dias_restantes} dias, necessário: ${diasNecessarios} dias.`
      }
    }
  }

  return { ok: true }
}

/**
 * Debita o saldo do ledger (gozo + venda) ao aprovar férias.
 * Verifica se o trigger do banco já inseriu as movimentações para evitar duplicação.
 */
async function debitarLedgerSemDuplicar(admin: ReturnType<typeof createAdminClient>, feriasId: string) {
  // Verifica se já existem movimentações para esta férias (inseridas pelo trigger do banco)
  const { data: existentes } = await admin
    .from('ferias_movimentacoes')
    .select('id')
    .eq('origem_tabela', 'ferias')
    .eq('origem_id', feriasId)
    .eq('natureza', 'Débito')
    .limit(1)

  if (existentes && existentes.length > 0) {
    // Trigger do banco já inseriu — não duplicar
    return
  }

  // Débitos de gozo
  const { data: alocacoesGozo } = await admin
    .from('ferias_alocacoes')
    .select('ferias_periodo_id, dias')
    .eq('ferias_id', feriasId)

  if (alocacoesGozo && alocacoesGozo.length > 0) {
    const movs = alocacoesGozo.map(a => ({
      ferias_periodo_id: a.ferias_periodo_id,
      data: new Date().toISOString().slice(0, 10),
      natureza: 'Débito',
      tipo: 'Gozo',
      dias: a.dias,
      origem_tabela: 'ferias',
      origem_id: feriasId,
      observacao: 'Aprovação de férias',
    }))
    const { error } = await admin.from('ferias_movimentacoes').insert(movs)
    if (error) console.error('Erro ao inserir movimentações de gozo:', error.message)
  }

  // Débitos de venda/abono
  const { data: alocacoesVenda } = await admin
    .from('ferias_venda_alocacoes')
    .select('ferias_periodo_id, dias')
    .eq('ferias_id', feriasId)

  if (alocacoesVenda && alocacoesVenda.length > 0) {
    const movs = alocacoesVenda.map(a => ({
      ferias_periodo_id: a.ferias_periodo_id,
      data: new Date().toISOString().slice(0, 10),
      natureza: 'Débito',
      tipo: 'Venda/Abono',
      dias: a.dias,
      origem_tabela: 'ferias',
      origem_id: feriasId,
      observacao: 'Abono pecuniário aprovado',
    }))
    const { error } = await admin.from('ferias_movimentacoes').insert(movs)
    if (error) console.error('Erro ao inserir movimentações de venda:', error.message)
  }
}

/** Estorna débitos anteriores ao cancelar férias */
async function estornarLedger(admin: ReturnType<typeof createAdminClient>, feriasId: string) {
  const { data: debitos } = await admin
    .from('ferias_movimentacoes')
    .select('ferias_periodo_id, dias, tipo')
    .eq('origem_tabela', 'ferias')
    .eq('origem_id', feriasId)
    .eq('natureza', 'Débito')

  if (debitos && debitos.length > 0) {
    // Verifica se já existe estorno
    const { data: estornosExistentes } = await admin
      .from('ferias_movimentacoes')
      .select('id')
      .eq('origem_tabela', 'ferias')
      .eq('origem_id', feriasId)
      .eq('natureza', 'Crédito')
      .eq('tipo', 'Estorno')
      .limit(1)

    if (estornosExistentes && estornosExistentes.length > 0) {
      return // Já estornado (pelo trigger do banco)
    }

    const estornos = debitos.map(d => ({
      ferias_periodo_id: d.ferias_periodo_id,
      data: new Date().toISOString().slice(0, 10),
      natureza: 'Crédito',
      tipo: 'Estorno',
      dias: d.dias,
      origem_tabela: 'ferias',
      origem_id: feriasId,
      observacao: 'Estorno por cancelamento',
    }))
    const { error } = await admin.from('ferias_movimentacoes').insert(estornos)
    if (error) console.error('Erro ao estornar movimentações:', error.message)
  }
}
