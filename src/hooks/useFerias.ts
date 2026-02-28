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
  ferias_saldo_id?: string
  abono_pecuniario?: boolean
  dias_vendidos?: number
  observacao?: string
  created_at?: string
}

export interface FeriasAVencer {
  id: string
  funcionario_id: string
  nome: string
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
  total_afetados?: number
  observacao?: string
  created_at?: string
}

// Tipo para a view vw_ferias_gestao
export interface FeriasGestao {
  id: string
  funcionario_id: string
  ferias_saldo_id?: string
  data_inicio: string
  data_fim: string
  dias: number
  tipo: string
  status: string
  abono_pecuniario?: boolean
  ferias_dias_vendidos?: number
  observacao?: string
  created_at?: string
  nome_completo: string
  codigo?: string
  unidade?: string
  setor?: string
  periodo_aquisitivo_inicio?: string
  periodo_aquisitivo_fim?: string
  dias_direito?: number
  dias_restantes?: number
  saldo_status?: string
}

// Tipo para saldo com informações do funcionário
export interface SaldoComFuncionario {
  id: string
  funcionario_id: string
  periodo_aquisitivo_inicio: string
  periodo_aquisitivo_fim: string
  dias_direito: number
  dias_gozados: number
  dias_vendidos: number
  dias_restantes: number
  data_vencimento: string
  status: string
  nome_completo: string
  codigo?: string
  unidade?: string
  setor?: string
  unidade_id?: string
  setor_id?: string
}

export function useFerias() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const enrichWithNames = useCallback(async <T extends { funcionario_id?: string; nome?: string }>(items: T[]): Promise<T[]> => {
    if (!items.length || items[0].nome) return items
    const ids = [...new Set(items.map(f => f.funcionario_id).filter(Boolean))] as string[]
    if (!ids.length) return items
    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id, nome_completo')
      .in('id', ids)
    const nameMap = new Map((funcs || []).map((f: { id: string; nome_completo: string }) => [f.id, f.nome_completo]))
    return items.map(f => ({
      ...f,
      nome: nameMap.get(f.funcionario_id!) || f.nome || 'Sem nome',
    }))
  }, [])

  // === VIEWS ===

  const loadFeriasGestao = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vw_ferias_gestao')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as FeriasGestao[]
    } catch (err) {
      console.error('Erro ao carregar gestao de ferias:', err)
      // Fallback: query directly
      try {
        const { data } = await supabase
          .from('ferias')
          .select('*, funcionarios!inner(nome_completo, codigo, unidade_id, setor_id)')
          .order('created_at', { ascending: false })
        return (data || []).map((f: Record<string, unknown>) => {
          const func = f.funcionarios as Record<string, string>
          return {
            ...f,
            nome_completo: func?.nome_completo || '',
            codigo: func?.codigo || '',
          }
        }) as FeriasGestao[]
      } catch {
        return []
      }
    }
  }, [])

  const loadFeriasColetvasResumo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vw_ferias_coletivas_resumo')
        .select('*')
        .order('data_inicio', { ascending: false })

      if (error) throw error
      return (data || []) as FeriasColetivas[]
    } catch (err) {
      console.error('Erro ao carregar ferias coletivas resumo:', err)
      // Fallback
      try {
        const { data } = await supabase
          .from('ferias_coletivas')
          .select('*, unidades:unidade_id(titulo), setores:setor_id(titulo)')
          .order('data_inicio', { ascending: false })
        return (data || []).map((fc: Record<string, unknown>) => ({
          ...fc,
          unidade_nome: (fc.unidades as Record<string, string>)?.titulo || null,
          setor_nome: (fc.setores as Record<string, string>)?.titulo || null,
          total_afetados: 0,
        })) as FeriasColetivas[]
      } catch {
        return []
      }
    }
  }, [])

  // === LEGACY LOADERS ===

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

  // === SALDOS COM FUNCIONÁRIO (para página de saldos) ===

  const loadAllSaldos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ferias_saldo')
        .select('*, funcionarios!inner(nome_completo, codigo, unidade_id, setor_id, unidades:unidade_id(titulo), setores:setor_id(titulo))')
        .order('data_vencimento', { ascending: true })

      if (error) throw error
      return (data || []).map((s: Record<string, unknown>) => {
        const func = s.funcionarios as Record<string, unknown>
        return {
          id: s.id,
          funcionario_id: s.funcionario_id,
          periodo_aquisitivo_inicio: s.periodo_aquisitivo_inicio,
          periodo_aquisitivo_fim: s.periodo_aquisitivo_fim,
          dias_direito: s.dias_direito,
          dias_gozados: s.dias_gozados,
          dias_vendidos: s.dias_vendidos,
          dias_restantes: s.dias_restantes,
          data_vencimento: s.data_vencimento,
          status: s.status,
          nome_completo: (func?.nome_completo as string) || '',
          codigo: (func?.codigo as string) || '',
          unidade_id: (func?.unidade_id as string) || '',
          setor_id: (func?.setor_id as string) || '',
          unidade: ((func?.unidades as Record<string, string>)?.titulo) || '',
          setor: ((func?.setores as Record<string, string>)?.titulo) || '',
        }
      }) as SaldoComFuncionario[]
    } catch (err) {
      console.error('Erro ao carregar todos os saldos:', err)
      return []
    }
  }, [])

  // === CRUD FÉRIAS ===

  const createFerias = useCallback(async (payload: {
    funcionario_id: string
    data_inicio: string
    data_fim: string
    dias: number
    tipo?: string
    status?: string
    periodo_aquisitivo_id?: string
    ferias_saldo_id?: string
    abono_pecuniario?: boolean
    dias_vendidos?: number
    observacao?: string
  }) => {
    try {
      const insertPayload: Record<string, unknown> = {
        funcionario_id: payload.funcionario_id,
        data_inicio: payload.data_inicio,
        data_fim: payload.data_fim,
        dias: payload.dias,
        tipo: payload.tipo || 'Individual',
        status: payload.status || 'Programada',
        abono_pecuniario: payload.abono_pecuniario || false,
        dias_vendidos: payload.dias_vendidos || 0,
        observacao: payload.observacao || null,
      }

      // Map periodo_aquisitivo_id to ferias_saldo_id
      const saldoId = payload.ferias_saldo_id || payload.periodo_aquisitivo_id
      if (saldoId) {
        insertPayload.ferias_saldo_id = saldoId
      }

      const { data, error } = await supabase
        .from('ferias')
        .insert(insertPayload)
        .select()
        .single()

      if (error) throw error
      toast.success('Ferias registradas com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar ferias:', err)
      toast.error('Erro ao registrar ferias')
      return null
    }
  }, [])

  const updateFerias = useCallback(async (id: string, payload: Partial<Ferias>) => {
    try {
      const { error } = await supabase
        .from('ferias')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Ferias atualizadas com sucesso')
      return true
    } catch (err) {
      console.error('Erro ao atualizar ferias:', err)
      toast.error('Erro ao atualizar ferias')
      return false
    }
  }, [])

  const cancelFerias = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('ferias')
        .update({ status: 'Cancelada' })
        .eq('id', id)

      if (error) throw error
      toast.success('Ferias canceladas com sucesso')
      return true
    } catch (err) {
      console.error('Erro ao cancelar ferias:', err)
      toast.error('Erro ao cancelar ferias')
      return false
    }
  }, [])

  const deleteFerias = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('ferias')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Ferias excluidas com sucesso')
      return true
    } catch (err) {
      console.error('Erro ao excluir ferias:', err)
      toast.error('Erro ao excluir ferias')
      return false
    }
  }, [])

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
      toast.success(`${diasVender} dias vendidos com sucesso`)
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao vender ferias'
      console.error('Erro ao vender ferias:', err)
      toast.error(message)
      return false
    }
  }, [])

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

  // === FÉRIAS COLETIVAS ===

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
      toast.success('Ferias coletivas registradas com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar ferias coletivas:', err)
      toast.error('Erro ao registrar ferias coletivas')
      return null
    }
  }, [])

  const updateFeriasColetivas = useCallback(async (id: string, payload: {
    titulo?: string
    data_inicio?: string
    data_fim?: string
    dias?: number
    unidade_id?: string | null
    setor_id?: string | null
    observacao?: string
  }) => {
    try {
      const { error } = await supabase
        .from('ferias_coletivas')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Ferias coletivas atualizadas')
      return true
    } catch (err) {
      console.error('Erro ao atualizar ferias coletivas:', err)
      toast.error('Erro ao atualizar ferias coletivas')
      return false
    }
  }, [])

  const deleteFeriasColetivas = useCallback(async (id: string) => {
    try {
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
  }, [])

  // Buscar funcionários afetados por coletiva
  const loadFuncionariosColetiva = useCallback(async (dataInicio: string, dataFim: string, titulo: string) => {
    try {
      const { data, error } = await supabase
        .from('ferias')
        .select('*, funcionarios!inner(nome_completo, codigo)')
        .eq('tipo', 'Coletiva')
        .eq('data_inicio', dataInicio)
        .eq('data_fim', dataFim)
        .like('observacao', `Férias coletivas: ${titulo}%`)

      if (error) throw error
      return (data || []).map((f: Record<string, unknown>) => {
        const func = f.funcionarios as Record<string, string>
        return {
          ...f,
          nome_completo: func?.nome_completo || '',
          codigo: func?.codigo || '',
        }
      })
    } catch (err) {
      console.error('Erro ao carregar funcionarios da coletiva:', err)
      return []
    }
  }, [])

  // Contar funcionários que seriam afetados por filtros
  const countFuncionariosAfetados = useCallback(async (unidadeId?: string | null, setorId?: string | null) => {
    try {
      let query = supabase
        .from('funcionarios')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Ativo')

      if (unidadeId) query = query.eq('unidade_id', unidadeId)
      if (setorId) query = query.eq('setor_id', setorId)

      const { count, error } = await query
      if (error) throw error
      return count || 0
    } catch (err) {
      console.error('Erro ao contar funcionarios:', err)
      return 0
    }
  }, [])

  // === EXTRATO / SALDOS ===

  const loadExtrato = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('vw_ferias_extrato')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .order('data_movimento', { ascending: false })

      if (error) throw error
      return (data || []) as FeriasExtrato[]
    } catch (err) {
      console.error('Erro ao carregar extrato:', err)
      return []
    }
  }, [])

  const loadSaldos = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('ferias_saldo')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .order('periodo_aquisitivo_inicio', { ascending: false })

      if (error) throw error
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

  // Gerar saldos para funcionários elegíveis
  const gerarSaldos = useCallback(async (funcionarioIds: string[]) => {
    let count = 0
    for (const funcId of funcionarioIds) {
      try {
        // Buscar data de admissão
        const { data: func } = await supabase
          .from('funcionarios')
          .select('data_admissao')
          .eq('id', funcId)
          .single()

        if (!func?.data_admissao) continue

        const admissao = new Date(func.data_admissao + 'T00:00:00')
        const hoje = new Date()
        let inicio = new Date(admissao)

        // Gerar períodos aquisitivos faltantes
        while (inicio < hoje) {
          const fim = new Date(inicio)
          fim.setFullYear(fim.getFullYear() + 1)
          fim.setDate(fim.getDate() - 1)

          const vencimento = new Date(fim)
          vencimento.setMonth(vencimento.getMonth() + 11)

          const periodoInicio = inicio.toISOString().split('T')[0]
          const periodoFim = fim.toISOString().split('T')[0]

          // Verificar se já existe
          const { data: existing } = await supabase
            .from('ferias_saldo')
            .select('id')
            .eq('funcionario_id', funcId)
            .eq('periodo_aquisitivo_inicio', periodoInicio)
            .maybeSingle()

          if (!existing) {
            const { error } = await supabase
              .from('ferias_saldo')
              .insert({
                funcionario_id: funcId,
                periodo_aquisitivo_inicio: periodoInicio,
                periodo_aquisitivo_fim: periodoFim,
                dias_direito: 30,
                dias_gozados: 0,
                dias_vendidos: 0,
                dias_restantes: 30,
                data_vencimento: vencimento.toISOString().split('T')[0],
                status: 'Disponível',
              })
            if (!error) count++
          }

          inicio = new Date(fim)
          inicio.setDate(inicio.getDate() + 1)
        }
      } catch (err) {
        console.error(`Erro ao gerar saldo para ${funcId}:`, err)
      }
    }

    if (count > 0) {
      toast.success(`${count} saldo(s) gerado(s) com sucesso`)
    } else {
      toast.info('Nenhum saldo novo para gerar')
    }
    return count
  }, [])

  // Buscar funcionários elegíveis (sem saldo para período completo)
  const loadFuncionariosElegiveis = useCallback(async () => {
    try {
      const { data: funcs, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, codigo, data_admissao')
        .eq('status', 'Ativo')
        .not('data_admissao', 'is', null)
        .order('nome_completo')

      if (error) throw error
      if (!funcs) return []

      const hoje = new Date()
      const elegiveis: { id: string; nome_completo: string; codigo?: string; periodos_faltantes: number }[] = []

      for (const func of funcs) {
        const admissao = new Date(func.data_admissao + 'T00:00:00')
        let inicio = new Date(admissao)
        let periodosFaltantes = 0

        while (inicio < hoje) {
          const fim = new Date(inicio)
          fim.setFullYear(fim.getFullYear() + 1)
          fim.setDate(fim.getDate() - 1)

          if (fim <= hoje) {
            const periodoInicio = inicio.toISOString().split('T')[0]
            const { data: existing } = await supabase
              .from('ferias_saldo')
              .select('id')
              .eq('funcionario_id', func.id)
              .eq('periodo_aquisitivo_inicio', periodoInicio)
              .maybeSingle()

            if (!existing) periodosFaltantes++
          }

          inicio = new Date(fim)
          inicio.setDate(inicio.getDate() + 1)
        }

        if (periodosFaltantes > 0) {
          elegiveis.push({
            id: func.id,
            nome_completo: func.nome_completo,
            codigo: func.codigo,
            periodos_faltantes: periodosFaltantes,
          })
        }
      }

      return elegiveis
    } catch (err) {
      console.error('Erro ao buscar funcionarios elegiveis:', err)
      return []
    }
  }, [])

  return {
    loading,
    // Views
    loadFeriasGestao,
    loadFeriasColetvasResumo,
    // Legacy
    loadFeriasAVencer,
    loadProximasFerias,
    loadFeriasFuncionario,
    loadSaldosFuncionario,
    // CRUD
    createFerias,
    updateFerias,
    cancelFerias,
    deleteFerias,
    venderFerias,
    updateSaldoDireito,
    // Coletivas
    loadFeriasColetivas,
    createFeriasColetivas,
    updateFeriasColetivas,
    deleteFeriasColetivas,
    loadFuncionariosColetiva,
    countFuncionariosAfetados,
    // Extrato / Saldos
    loadExtrato,
    loadSaldos,
    loadPeriodosDisponiveis,
    loadAllSaldos,
    gerarSaldos,
    loadFuncionariosElegiveis,
  }
}
