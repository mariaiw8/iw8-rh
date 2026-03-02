'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export interface FeriasSaldo {
  id: string
  funcionario_id: string
  periodo_aquisitivo_inicio: string
  periodo_aquisitivo_fim: string
  periodo_inicio: string
  periodo_fim: string
  dias_direito: number
  dias_gozados: number
  dias_vendidos: number
  dias_programados?: number
  dias_restantes: number
  data_vencimento: string
  status: 'Disponível' | 'Parcial' | 'Gozado' | 'Vencido'
}

export interface FeriasExtrato {
  funcionario_id: string
  nome: string
  codigo: string
  tipo_movimento: 'CRÉDITO' | 'DÉBITO'
  descricao: string
  data_movimento: string
  dias: number
  referencia_id: string
  referencia_tabela: string
  periodo_aquisitivo_inicio?: string
  periodo_aquisitivo_fim?: string
  data_vencimento?: string
  saldo_status?: string
}

export interface Ferias {
  id: string
  funcionario_id: string
  funcionario_nome?: string
  funcionario_codigo?: string
  unidade?: string
  setor?: string
  data_inicio: string
  data_fim: string
  dias: number
  tipo: string
  status: string
  periodo_aquisitivo_id?: string
  abono_pecuniario?: boolean
  dias_vendidos?: number
  observacao?: string
  created_at?: string
}

export interface FeriasAVencer {
  id: string
  funcionario_id: string
  nome: string
  nome_completo?: string
  codigo?: string
  periodo_aquisitivo: string
  dias_restantes: number
  data_vencimento: string
  dias_para_vencer: number
  situacao: 'VENCIDA' | 'ALERTA' | 'OK'
}

export interface ProximasFerias {
  id: string
  funcionario_id: string
  nome: string
  nome_completo?: string
  codigo?: string
  unidade?: string
  setor?: string
  data_inicio: string
  data_fim: string
  dias: number
  status: string
}

export interface FeriasColetivas {
  id: string
  titulo: string
  data_inicio: string
  data_fim: string
  dias: number
  unidade_id?: string
  setor_id?: string
  unidade_nome?: string
  setor_nome?: string
  observacao?: string
  created_at?: string
}

export function useFerias() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const enrichWithNames = useCallback(async <T extends { funcionario_id?: string; nome?: string; nome_completo?: string }>(items: T[]): Promise<T[]> => {
    if (!items.length || (items[0].nome_completo || items[0].nome)) return items
    const ids = [...new Set(items.map(f => f.funcionario_id).filter(Boolean))] as string[]
    if (!ids.length) return items
    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id, nome_completo')
      .in('id', ids)
    const nameMap = new Map((funcs || []).map((f: { id: string; nome_completo: string }) => [f.id, f.nome_completo]))
    return items.map(f => ({
      ...f,
      nome_completo: nameMap.get(f.funcionario_id!) || f.nome_completo || f.nome || 'Sem nome',
      nome: nameMap.get(f.funcionario_id!) || f.nome || 'Sem nome',
    }))
  }, [])

  const loadFeriasAVencer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vw_ferias_a_vencer')
        .select('*')
        .order('dias_para_vencer', { ascending: true })

      if (error) throw error
      const items = (data || []) as FeriasAVencer[]
      return await enrichWithNames(items)
    } catch (err) {
      console.error('Erro ao carregar ferias a vencer:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [enrichWithNames])

  const loadProximasFerias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vw_proximas_ferias')
        .select('*')
        .order('data_inicio', { ascending: true })

      if (error) throw error
      const items = (data || []) as ProximasFerias[]
      return await enrichWithNames(items)
    } catch (err) {
      console.error('Erro ao carregar proximas ferias:', err)
      return []
    }
  }, [enrichWithNames])

  const loadFeriasFuncionario = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('ferias')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .order('data_inicio', { ascending: false })

      if (error) throw error
      return (data || []) as Ferias[]
    } catch (err) {
      console.error('Erro ao carregar ferias:', err)
      return []
    }
  }, [])

  const loadSaldosFuncionario = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('ferias_saldo')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .order('periodo_inicio', { ascending: false })

      if (error) throw error
      return (data || []) as FeriasSaldo[]
    } catch (err) {
      console.error('Erro ao carregar saldos:', err)
      return []
    }
  }, [])

  // Helper to recalculate dias_restantes and status on a ferias_saldo row
  const recalcSaldo = useCallback(async (saldoId: string) => {
    const { data: s } = await supabase
      .from('ferias_saldo')
      .select('dias_direito, dias_gozados, dias_vendidos, data_vencimento')
      .eq('id', saldoId)
      .single()
    if (!s) return

    const restantes = Math.max(0, (s.dias_direito || 0) - (s.dias_gozados || 0) - (s.dias_vendidos || 0))
    const vencido = s.data_vencimento && new Date(s.data_vencimento + 'T00:00:00') < new Date()
    let status: string
    if (vencido && restantes > 0) {
      status = 'Vencido'
    } else if (restantes <= 0) {
      status = 'Gozado'
    } else if ((s.dias_gozados || 0) + (s.dias_vendidos || 0) > 0) {
      status = 'Parcial'
    } else {
      status = 'Disponível'
    }

    await supabase
      .from('ferias_saldo')
      .update({ dias_restantes: restantes, status })
      .eq('id', saldoId)
  }, [])

  const createFerias = useCallback(async (payload: {
    funcionario_id: string
    data_inicio: string
    data_fim: string
    dias: number
    tipo?: string
    status?: string
    periodo_aquisitivo_id?: string
    abono_pecuniario?: boolean
    dias_vendidos?: number
    observacao?: string
  }) => {
    try {
      // Map periodo_aquisitivo_id to the DB column ferias_saldo_id
      const saldoId = payload.periodo_aquisitivo_id || null
      const { periodo_aquisitivo_id, ...rest } = payload

      const { data, error } = await supabase
        .from('ferias')
        .insert({
          ...rest,
          ferias_saldo_id: saldoId,
          tipo: payload.tipo || 'Individual',
          status: payload.status || 'Programada',
        })
        .select()
        .single()

      if (error) throw error

      // Update saldo if linked to a period
      if (saldoId) {
        const { data: saldo } = await supabase
          .from('ferias_saldo')
          .select('dias_gozados, dias_vendidos')
          .eq('id', saldoId)
          .single()

        if (saldo) {
          const updatePayload: Record<string, number> = {
            dias_gozados: (saldo.dias_gozados || 0) + payload.dias,
          }
          if (payload.dias_vendidos && payload.dias_vendidos > 0) {
            updatePayload.dias_vendidos = (saldo.dias_vendidos || 0) + payload.dias_vendidos
          }
          await supabase
            .from('ferias_saldo')
            .update(updatePayload)
            .eq('id', saldoId)
        }
        await recalcSaldo(saldoId)
      }

      toast.success('Ferias registradas com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar ferias:', err)
      toast.error('Erro ao registrar ferias')
      return null
    }
  }, [recalcSaldo])

  const updateFerias = useCallback(async (id: string, payload: Partial<Ferias>) => {
    try {
      // Load old record so we can revert saldo
      const { data: old } = await supabase
        .from('ferias')
        .select('dias, dias_vendidos, ferias_saldo_id')
        .eq('id', id)
        .single()

      const { error } = await supabase
        .from('ferias')
        .update(payload)
        .eq('id', id)

      if (error) throw error

      // Revert old saldo
      if (old?.ferias_saldo_id) {
        const { data: saldo } = await supabase
          .from('ferias_saldo')
          .select('dias_gozados, dias_vendidos')
          .eq('id', old.ferias_saldo_id)
          .single()
        if (saldo) {
          await supabase.from('ferias_saldo').update({
            dias_gozados: Math.max(0, (saldo.dias_gozados || 0) - (old.dias || 0)),
            dias_vendidos: Math.max(0, (saldo.dias_vendidos || 0) - (old.dias_vendidos || 0)),
          }).eq('id', old.ferias_saldo_id)
        }
        await recalcSaldo(old.ferias_saldo_id)
      }

      // Apply new saldo (reload the updated record)
      const { data: updated } = await supabase
        .from('ferias')
        .select('dias, dias_vendidos, ferias_saldo_id')
        .eq('id', id)
        .single()

      if (updated?.ferias_saldo_id) {
        const { data: saldo } = await supabase
          .from('ferias_saldo')
          .select('dias_gozados, dias_vendidos')
          .eq('id', updated.ferias_saldo_id)
          .single()
        if (saldo) {
          await supabase.from('ferias_saldo').update({
            dias_gozados: (saldo.dias_gozados || 0) + (updated.dias || 0),
            dias_vendidos: (saldo.dias_vendidos || 0) + (updated.dias_vendidos || 0),
          }).eq('id', updated.ferias_saldo_id)
        }
        await recalcSaldo(updated.ferias_saldo_id)
      }

      toast.success('Ferias atualizadas com sucesso')
      return true
    } catch (err) {
      console.error('Erro ao atualizar ferias:', err)
      toast.error('Erro ao atualizar ferias')
      return false
    }
  }, [recalcSaldo])

  const deleteFerias = useCallback(async (id: string) => {
    try {
      // Load record before deleting to revert saldo
      const { data: old } = await supabase
        .from('ferias')
        .select('dias, dias_vendidos, ferias_saldo_id')
        .eq('id', id)
        .single()

      // Delete linked transactions
      await supabase.from('transacoes').delete().eq('origem_tabela', 'ferias').eq('origem_id', id)

      const { error } = await supabase
        .from('ferias')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Revert saldo
      if (old?.ferias_saldo_id) {
        const { data: saldo } = await supabase
          .from('ferias_saldo')
          .select('dias_gozados, dias_vendidos')
          .eq('id', old.ferias_saldo_id)
          .single()
        if (saldo) {
          await supabase.from('ferias_saldo').update({
            dias_gozados: Math.max(0, (saldo.dias_gozados || 0) - (old.dias || 0)),
            dias_vendidos: Math.max(0, (saldo.dias_vendidos || 0) - (old.dias_vendidos || 0)),
          }).eq('id', old.ferias_saldo_id)
        }
        await recalcSaldo(old.ferias_saldo_id)
      }

      toast.success('Ferias excluidas com sucesso')
      return true
    } catch (err) {
      console.error('Erro ao excluir ferias:', err)
      toast.error('Erro ao excluir ferias')
      return false
    }
  }, [recalcSaldo])

  const venderFerias = useCallback(async (periodoId: string, diasVender: number) => {
    try {
      const { data: saldo } = await supabase
        .from('ferias_saldo')
        .select('dias_vendidos, dias_restantes')
        .eq('id', periodoId)
        .single()

      if (!saldo) throw new Error('Saldo nao encontrado')
      if (diasVender > 10) throw new Error('Maximo de 10 dias por periodo')
      if ((saldo.dias_vendidos || 0) + diasVender > 10) {
        throw new Error(`Ja foram vendidos ${saldo.dias_vendidos} dias neste periodo. Maximo restante: ${10 - (saldo.dias_vendidos || 0)}`)
      }

      const { error } = await supabase
        .from('ferias_saldo')
        .update({ dias_vendidos: (saldo.dias_vendidos || 0) + diasVender })
        .eq('id', periodoId)

      if (error) throw error

      // Recalculate dias_restantes and status
      await recalcSaldo(periodoId)

      toast.success(`${diasVender} dias vendidos com sucesso`)
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao vender ferias'
      console.error('Erro ao vender ferias:', err)
      toast.error(message)
      return false
    }
  }, [recalcSaldo])

  const updateSaldoDireito = useCallback(async (saldoId: string, diasDireito: number) => {
    try {
      const { error } = await supabase
        .from('ferias_saldo')
        .update({ dias_direito: diasDireito })
        .eq('id', saldoId)

      if (error) throw error
      toast.success('Dias de direito atualizados')
      return true
    } catch (err) {
      console.error('Erro ao atualizar saldo:', err)
      toast.error('Erro ao atualizar saldo')
      return false
    }
  }, [])

  // Ferias Coletivas
  const loadFeriasColetivas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ferias_coletivas')
        .select('*, unidades:unidade_id(titulo), setores:setor_id(titulo)')
        .order('data_inicio', { ascending: false })

      if (error) throw error
      return (data || []).map((fc: Record<string, unknown>) => ({
        ...fc,
        unidade_nome: (fc.unidades as Record<string, string>)?.titulo || 'Todas',
        setor_nome: (fc.setores as Record<string, string>)?.titulo || 'Todos',
      })) as FeriasColetivas[]
    } catch (err) {
      console.error('Erro ao carregar ferias coletivas:', err)
      return []
    }
  }, [])

  const createFeriasColetivas = useCallback(async (payload: {
    titulo: string
    data_inicio: string
    data_fim: string
    dias: number
    unidade_id?: string | null
    setor_id?: string | null
    observacao?: string
  }) => {
    try {
      const { data, error } = await supabase
        .from('ferias_coletivas')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      // Deduct from affected employees' saldos
      // Build employee filter based on unidade/setor
      let empQuery = supabase.from('funcionarios').select('id').eq('status', 'Ativo')
      if (payload.unidade_id) empQuery = empQuery.eq('unidade_id', payload.unidade_id)
      if (payload.setor_id) empQuery = empQuery.eq('setor_id', payload.setor_id)
      const { data: employees } = await empQuery

      if (employees && employees.length > 0) {
        for (const emp of employees) {
          // Find the oldest available saldo for this employee
          const { data: saldos } = await supabase
            .from('ferias_saldo')
            .select('id, dias_gozados, dias_restantes')
            .eq('funcionario_id', emp.id)
            .in('status', ['Disponível', 'Parcial'])
            .gt('dias_restantes', 0)
            .order('periodo_aquisitivo_inicio', { ascending: true })
            .limit(1)

          const saldo = saldos?.[0]
          const saldoId = saldo?.id || null

          // Create individual ferias record linked to the coletiva
          await supabase.from('ferias').insert({
            funcionario_id: emp.id,
            ferias_saldo_id: saldoId,
            data_inicio: payload.data_inicio,
            data_fim: payload.data_fim,
            dias: payload.dias,
            tipo: 'Coletiva',
            status: 'Programada',
            observacao: `Ferias coletivas: ${payload.titulo}`,
          })

          // Update saldo if found
          if (saldo) {
            await supabase.from('ferias_saldo').update({
              dias_gozados: (saldo.dias_gozados || 0) + payload.dias,
            }).eq('id', saldo.id)
            await recalcSaldo(saldo.id)
          }
        }
      }

      toast.success('Ferias coletivas registradas com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar ferias coletivas:', err)
      toast.error('Erro ao registrar ferias coletivas')
      return null
    }
  }, [recalcSaldo])

  const deleteFeriasColetivas = useCallback(async (id: string) => {
    try {
      // Load the coletiva to find related individual ferias records
      const { data: coletiva } = await supabase
        .from('ferias_coletivas')
        .select('titulo')
        .eq('id', id)
        .single()

      if (coletiva) {
        // Find individual ferias records created for this coletiva
        const { data: feriasRecs } = await supabase
          .from('ferias')
          .select('id, dias, dias_vendidos, ferias_saldo_id')
          .eq('tipo', 'Coletiva')
          .like('observacao', `%${coletiva.titulo}%`)

        if (feriasRecs) {
          for (const f of feriasRecs) {
            if (f.ferias_saldo_id) {
              const { data: saldo } = await supabase
                .from('ferias_saldo')
                .select('dias_gozados, dias_vendidos')
                .eq('id', f.ferias_saldo_id)
                .single()
              if (saldo) {
                await supabase.from('ferias_saldo').update({
                  dias_gozados: Math.max(0, (saldo.dias_gozados || 0) - (f.dias || 0)),
                  dias_vendidos: Math.max(0, (saldo.dias_vendidos || 0) - (f.dias_vendidos || 0)),
                }).eq('id', f.ferias_saldo_id)
                await recalcSaldo(f.ferias_saldo_id)
              }
            }
            await supabase.from('ferias').delete().eq('id', f.id)
          }
        }
      }

      const { error } = await supabase
        .from('ferias_coletivas')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Ferias coletivas excluidas')
      return true
    } catch (err) {
      console.error('Erro ao excluir ferias coletivas:', err)
      toast.error('Erro ao excluir ferias coletivas')
      return false
    }
  }, [recalcSaldo])

  const loadExtrato = useCallback(async (funcionarioId: string) => {
    try {
      // TAREFA 4a: Use RPC fn_extrato_ferias - already ordered by data DESC
      const { data, error } = await supabase
        .rpc('fn_extrato_ferias', { p_funcionario_id: funcionarioId })

      if (error) {
        // Fallback to view if RPC not available
        const { data: viewData, error: viewError } = await supabase
          .from('vw_ferias_extrato')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .order('data_movimento', { ascending: false })
        if (viewError) throw viewError
        return (viewData || []) as FeriasExtrato[]
      }
      return (data || []) as FeriasExtrato[]
    } catch (err) {
      console.error('Erro ao carregar extrato:', err)
      return []
    }
  }, [])

  const loadSaldos = useCallback(async (funcionarioId: string) => {
    try {
      // TAREFA 4b: Use RPC fn_resumo_periodos_ferias
      const { data, error } = await supabase
        .rpc('fn_resumo_periodos_ferias', { p_funcionario_id: funcionarioId })

      if (error) {
        // Fallback to direct table query if RPC not available
        const { data: tableData, error: tableError } = await supabase
          .from('ferias_saldo')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .order('periodo_aquisitivo_inicio', { ascending: false })
        if (tableError) throw tableError
        return (tableData || []) as FeriasSaldo[]
      }
      return (data || []) as FeriasSaldo[]
    } catch (err) {
      console.error('Erro ao carregar saldos:', err)
      return []
    }
  }, [])

  const loadPeriodosDisponiveis = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('ferias_saldo')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .in('status', ['Disponível', 'Parcial'])
        .order('periodo_aquisitivo_inicio')

      if (error) throw error
      return (data || []) as FeriasSaldo[]
    } catch (err) {
      console.error('Erro ao carregar periodos disponiveis:', err)
      return []
    }
  }, [])

  return {
    loading,
    loadFeriasAVencer,
    loadProximasFerias,
    loadFeriasFuncionario,
    loadSaldosFuncionario,
    createFerias,
    updateFerias,
    deleteFerias,
    venderFerias,
    updateSaldoDireito,
    loadFeriasColetivas,
    createFeriasColetivas,
    deleteFeriasColetivas,
    loadExtrato,
    loadSaldos,
    loadPeriodosDisponiveis,
  }
}
