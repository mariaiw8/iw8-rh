import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * POST /api/ferias/criar
 * Cria férias com alocações usando service role (bypassa RLS e triggers de validação).
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    const {
      funcionario_id,
      data_inicio,
      data_fim,
      dias,
      tipo,
      abono_pecuniario,
      dias_vendidos,
      observacao,
      alocacoes_gozo,
      alocacoes_venda,
    } = payload

    if (!funcionario_id || !data_inicio || !data_fim || dias == null) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Criar o registro de férias
    const { data: ferias, error: errFerias } = await admin
      .from('ferias')
      .insert({
        funcionario_id,
        data_inicio,
        data_fim,
        dias,
        tipo: tipo || 'Individual',
        abono_pecuniario: abono_pecuniario ?? false,
        dias_vendidos: dias_vendidos ?? 0,
        observacao: observacao ?? null,
        status: 'Programada',
      })
      .select()
      .single()

    if (errFerias) {
      return NextResponse.json({ error: `Erro ao criar férias: ${errFerias.message}` }, { status: 500 })
    }

    // 2. Inserir alocações de gozo
    if (alocacoes_gozo && alocacoes_gozo.length > 0) {
      const { error } = await admin
        .from('ferias_alocacoes')
        .insert(
          alocacoes_gozo.map((a: { ferias_periodo_id: string; dias: number }) => ({
            ferias_id: ferias.id,
            ferias_periodo_id: a.ferias_periodo_id,
            dias: a.dias,
          }))
        )
      if (error) {
        console.error('Erro ao inserir alocações de gozo:', error.message)
        // Não bloqueia — férias foi criada
      }
    }

    // 3. Inserir alocações de venda
    if (alocacoes_venda && alocacoes_venda.length > 0) {
      const { error } = await admin
        .from('ferias_venda_alocacoes')
        .insert(
          alocacoes_venda.map((a: { ferias_periodo_id: string; dias: number }) => ({
            ferias_id: ferias.id,
            ferias_periodo_id: a.ferias_periodo_id,
            dias: a.dias,
          }))
        )
      if (error) {
        console.error('Erro ao inserir alocações de venda:', error.message)
      }
    }

    return NextResponse.json({ ok: true, ferias })
  } catch (err: any) {
    console.error('Erro em POST /api/ferias/criar:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
