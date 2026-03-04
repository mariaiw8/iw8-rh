import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * PATCH /api/ferias/status
 * Atualiza o status de férias usando service role (bypassa RLS).
 * Ledger de movimentações é gerenciado pelo trigger fn_ferias_status_ledger no banco.
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

    // Ledger de movimentações é gerenciado pelo trigger fn_ferias_status_ledger no banco.
    // NÃO inserir movimentações aqui para evitar duplicação.

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

