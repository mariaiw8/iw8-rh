'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export interface Salario {
  id: string
  funcionario_id: string
  salario_bruto: number
  salario_liquido?: number | null
  custo_funcionario?: number | null
  data_vigencia: string
  observacao?: string | null
  created_at?: string
}

export interface SalarioAtual {
  funcionario_id: string
  nome_completo?: string
  codigo?: string
  unidade_id?: string
  unidade_titulo?: string
  setor_id?: string
  setor_titulo?: string
  funcao_titulo?: string
  salario_bruto: number
  salario_liquido?: number | null
  custo_funcionario?: number | null
  data_vigencia: string
}

export interface Transacao {
  id: string
  funcionario_id: string
  tipo_transacao_id: string
  tipo_titulo?: string
  natureza?: string
  valor: number
  data: string
  descricao?: string | null
  created_at?: string
}

export function useFinanceiro() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // === SALARIOS ===

  const loadSalarios = useCallback(async (funcionarioId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('salarios')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .order('data_vigencia', { ascending: false })

      if (error) throw error
      return (data || []) as Salario[]
    } catch (err) {
      console.error('Erro ao carregar salarios:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSalarioAtual = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .single()

      if (error) {
        // Fallback: query salarios directly for the most recent
        const { data: salData, error: salError } = await supabase
          .from('salarios')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .order('data_vigencia', { ascending: false })
          .limit(1)
          .single()

        if (salError) return null
        return salData as SalarioAtual
      }
      return data as SalarioAtual
    } catch (err) {
      console.error('Erro ao carregar salario atual:', err)
      return null
    }
  }, [])

  const createSalario = useCallback(async (payload: {
    funcionario_id: string
    salario_bruto: number
    salario_liquido?: number | null
    custo_funcionario?: number | null
    data_vigencia: string
    observacao?: string | null
  }) => {
    try {
      const { data, error } = await supabase
        .from('salarios')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      toast.success('Salario registrado com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar salario:', err)
      toast.error('Erro ao registrar salario')
      return null
    }
  }, [])

  const updateSalario = useCallback(async (id: string, payload: Partial<Salario>) => {
    try {
      const { error } = await supabase
        .from('salarios')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Salario atualizado')
      return true
    } catch (err) {
      console.error('Erro ao atualizar salario:', err)
      toast.error('Erro ao atualizar salario')
      return false
    }
  }, [])

  const deleteSalario = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('salarios')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Salario excluido')
      return true
    } catch (err) {
      console.error('Erro ao excluir salario:', err)
      toast.error('Erro ao excluir salario')
      return false
    }
  }, [])

  // === TRANSACOES ===

  const loadTransacoes = useCallback(async (funcionarioId: string, filters?: {
    data_inicio?: string
    data_fim?: string
    tipo_transacao_id?: string
    natureza?: string
  }) => {
    setLoading(true)
    try {
      // Try joined query first
      let query = supabase
        .from('transacoes')
        .select(`
          *,
          tipos_transacao:tipo_transacao_id(titulo, natureza)
        `)
        .eq('funcionario_id', funcionarioId)
        .order('data', { ascending: false })

      if (filters?.data_inicio) {
        query = query.gte('data', filters.data_inicio)
      }
      if (filters?.data_fim) {
        query = query.lte('data', filters.data_fim)
      }
      if (filters?.tipo_transacao_id) {
        query = query.eq('tipo_transacao_id', filters.tipo_transacao_id)
      }

      let { data, error } = await query

      // Fallback: query without join if the relationship fails
      if (error) {
        let fallbackQuery = supabase
          .from('transacoes')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .order('data', { ascending: false })

        if (filters?.data_inicio) fallbackQuery = fallbackQuery.gte('data', filters.data_inicio)
        if (filters?.data_fim) fallbackQuery = fallbackQuery.lte('data', filters.data_fim)
        if (filters?.tipo_transacao_id) fallbackQuery = fallbackQuery.eq('tipo_transacao_id', filters.tipo_transacao_id)

        const fallback = await fallbackQuery
        if (fallback.error) throw fallback.error
        data = fallback.data

        // Load tipos separately and map
        const { data: tipos } = await supabase.from('tipos_transacao').select('id, titulo, natureza')
        const tiposMap = new Map((tipos || []).map((t: Record<string, string>) => [t.id, t]))

        let result = (data || []).map((t: Record<string, unknown>) => {
          const tipo = tiposMap.get(t.tipo_transacao_id as string) as Record<string, string> | undefined
          return {
            ...t,
            tipo_titulo: tipo?.titulo || '',
            natureza: tipo?.natureza || '',
          }
        }) as Transacao[]

        if (filters?.natureza && filters.natureza !== 'Todos') {
          result = result.filter((t) => t.natureza === filters.natureza)
        }
        return result
      }

      let result = (data || []).map((t: Record<string, unknown>) => {
        const tipo = t.tipos_transacao as Record<string, string> | null
        return {
          ...t,
          tipo_titulo: tipo?.titulo || '',
          natureza: tipo?.natureza || '',
        }
      }) as Transacao[]

      // Client-side nature filter (joined field)
      if (filters?.natureza && filters.natureza !== 'Todos') {
        result = result.filter((t) => t.natureza === filters.natureza)
      }

      return result
    } catch (err) {
      console.error('Erro ao carregar transacoes:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const createTransacao = useCallback(async (payload: {
    funcionario_id: string
    tipo_transacao_id: string
    valor: number
    data: string
    descricao?: string | null
  }) => {
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      toast.success('Transacao registrada com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar transacao:', err)
      toast.error('Erro ao registrar transacao')
      return null
    }
  }, [])

  const updateTransacao = useCallback(async (id: string, payload: Partial<Transacao>) => {
    try {
      const { error } = await supabase
        .from('transacoes')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Transacao atualizada')
      return true
    } catch (err) {
      console.error('Erro ao atualizar transacao:', err)
      toast.error('Erro ao atualizar transacao')
      return false
    }
  }, [])

  const deleteTransacao = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Transacao excluida')
      return true
    } catch (err) {
      console.error('Erro ao excluir transacao:', err)
      toast.error('Erro ao excluir transacao')
      return false
    }
  }, [])

  return {
    loading,
    loadSalarios,
    loadSalarioAtual,
    createSalario,
    updateSalario,
    deleteSalario,
    loadTransacoes,
    createTransacao,
    updateTransacao,
    deleteTransacao,
  }
}
