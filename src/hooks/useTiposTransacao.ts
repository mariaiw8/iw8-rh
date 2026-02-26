'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export interface TipoTransacao {
  id: string
  titulo: string
  natureza: 'Credito' | 'Debito'
  created_at?: string
}

export function useTiposTransacao() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const loadTipos = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tipos_transacao')
        .select('*')
        .order('natureza')
        .order('titulo')

      if (error) throw error
      return (data || []) as TipoTransacao[]
    } catch (err) {
      console.error('Erro ao carregar tipos de transacao:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const createTipo = useCallback(async (payload: {
    titulo: string
    natureza: 'Credito' | 'Debito'
  }) => {
    try {
      const { data, error } = await supabase
        .from('tipos_transacao')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      toast.success('Tipo de transacao cadastrado')
      return data
    } catch (err) {
      console.error('Erro ao cadastrar tipo:', err)
      toast.error('Erro ao cadastrar tipo de transacao')
      return null
    }
  }, [])

  const updateTipo = useCallback(async (id: string, payload: Partial<TipoTransacao>) => {
    try {
      const { error } = await supabase
        .from('tipos_transacao')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Tipo de transacao atualizado')
      return true
    } catch (err) {
      console.error('Erro ao atualizar tipo:', err)
      toast.error('Erro ao atualizar tipo de transacao')
      return false
    }
  }, [])

  const deleteTipo = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('tipos_transacao')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Tipo de transacao excluido')
      return true
    } catch (err) {
      console.error('Erro ao excluir tipo:', err)
      toast.error('Erro ao excluir tipo de transacao')
      return false
    }
  }, [])

  return {
    loading,
    loadTipos,
    createTipo,
    updateTipo,
    deleteTipo,
  }
}
