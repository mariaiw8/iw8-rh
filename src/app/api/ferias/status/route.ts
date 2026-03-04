import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * PATCH /api/ferias/status
 * Atualiza o status de férias usando service role (bypassa RLS).
 * Também insere/estorna movimentações no ledger, já que o trigger
 * do banco pode não ter SECURITY DEFINER configurado.
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

    // Busca status atual
    const { data: ferias, error: errFetch } = await admin
      .from('ferias')
      .select('id, status')
      .eq('id', feriasId)
      .single()

    if (errFetch || !ferias) {
      return NextResponse.json({ error: 'Férias não encontrada' }, { status: 404 })
    }

    if (ferias.status === novoStatus) {
      return NextResponse.json({ ok: true, message: 'Status já é o mesmo' })
    }

    // Atualiza status
    const { error: errUpdate } = await admin
      .from('ferias')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', feriasId)

    if (errUpdate) {
      return NextResponse.json({ error: `Erro ao atualizar: ${errUpdate.message}` }, { status: 500 })
    }

    // Gerenciar ledger de movimentações
    if (novoStatus === 'Aprovada') {
      await debitarLedger(admin, feriasId)
    } else if (novoStatus === 'Cancelada') {
      await estornarLedger(admin, feriasId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro em PATCH /api/ferias/status:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

/** Debita o saldo do ledger (gozo + venda) ao aprovar férias */
async function debitarLedger(admin: ReturnType<typeof createAdminClient>, feriasId: string) {
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
