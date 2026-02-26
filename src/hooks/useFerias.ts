'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export interface FeriasSaldo {
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
  ferias_saldo_id?: string
  abono_pecuniario?: boolean
  dias_vendidos?: number
  observacao?: string
  created_at?: string
}

export interface FeriasAVencer {
  id: string
  funcionario_id: string
  nome_completo: string
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
  nome_completo: string
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

  const loadFeriasAVencer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vw_ferias_a_vencer')
        .select('*')
        .order('dias_para_vencer', { ascending: true })

      if (error) throw error

      return (data || []).map((d: Record<string, unknown>) => ({
        id: (d.saldo_id || d.id) as string,
        funcionario_id: d.funcionario_id as string,
        nome_completo: (d.nome_completo || d.nome || '') as string,
        codigo: (d.codigo || '') as string,
        periodo_aquisitivo: d.periodo_aquisitivo_inicio && d.periodo_aquisitivo_fim
          ? `${(d.periodo_aquisitivo_inicio as string).slice(0, 10)} a ${(d.periodo_aquisitivo_fim as string).slice(0, 10)}`
          : (d.periodo_aquisitivo || '') as string,
        dias_restantes: (d.dias_restantes || 0) as number,
        data_vencimento: d.data_vencimento as string,
        dias_para_vencer: (d.dias_para_vencer || 0) as number,
        situacao: d.situacao as 'VENCIDA' | 'ALERTA' | 'OK',
      })) as FeriasAVencer[]
    } catch (err) {
      console.error('Erro ao carregar ferias a vencer:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProximasFerias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vw_proximas_ferias')
        .select('*')
        .order('data_inicio', { ascending: true })

      if (error) throw error

      return (data || []).map((d: Record<string, unknown>) => ({
        id: (d.ferias_id || d.id) as string,
        funcionario_id: d.funcionario_id as string,
        nome_completo: (d.nome_completo || d.nome || '') as string,
        codigo: (d.codigo || '') as string,
        unidade: (d.unidade || '') as string,
        setor: (d.setor || '') as string,
        data_inicio: d.data_inicio as string,
        data_fim: d.data_fim as string,
        dias: (d.dias || 0) as number,
        status: d.status as string,
      })) as ProximasFerias[]
    } catch (err) {
      console.error('Erro ao carregar proximas ferias:', err)
      return []
    }
  }, [])

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
        .order('periodo_aquisitivo_inicio', { ascending: false })

      if (error) throw error
      return (data || []) as FeriasSaldo[]
    } catch (err) {
      console.error('Erro ao carregar saldos:', err)
      return []
    }
  }, [])

  const createFerias = useCallback(async (payload: {
    funcionario_id: string
    data_inicio: string
    data_fim: string
    dias: number
    tipo?: string
    status?: string
    ferias_saldo_id?: string
    abono_pecuniario?: boolean
    dias_vendidos?: number
    observacao?: string
  }) => {
    try {
      const { data, error } = await supabase
        .from('ferias')
        .insert({
          ...payload,
          tipo: payload.tipo || 'Individual',
          status: payload.status || 'Programada',
        })
        .select()
        .single()

      if (error) throw error

      // Update saldo if ferias_saldo_id is provided
      if (payload.ferias_saldo_id) {
        const { data: saldo } = await supabase
          .from('ferias_saldo')
          .select('dias_gozados, dias_vendidos')
          .eq('id', payload.ferias_saldo_id)
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
            .eq('id', payload.ferias_saldo_id)
        }
      }

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
      toast.success('Ferias coletivas registradas com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar ferias coletivas:', err)
      toast.error('Erro ao registrar ferias coletivas')
      return null
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
  }
}
