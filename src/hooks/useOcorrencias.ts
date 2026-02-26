'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export interface TipoOcorrencia {
  id: string
  titulo: string
  categoria: string
  cor: string
  created_at?: string
}

export interface Ocorrencia {
  id: string
  funcionario_id: string
  funcionario_nome?: string
  funcionario_codigo?: string
  tipo_ocorrencia_id: string
  tipo_titulo?: string
  tipo_cor?: string
  tipo_categoria?: string
  descricao?: string
  data_inicio: string
  data_fim?: string
  dias: number
  valor?: number
  arquivo_url?: string
  observacao?: string
  created_at?: string
}

export function useOcorrencias() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // Tipos de Ocorrencia
  const loadTipos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_ocorrencia')
        .select('*')
        .order('titulo')

      if (error) throw error
      return (data || []) as TipoOcorrencia[]
    } catch (err) {
      console.error('Erro ao carregar tipos:', err)
      return []
    }
  }, [])

  const createTipo = useCallback(async (payload: {
    titulo: string
    categoria: string
    cor: string
  }) => {
    try {
      const { data, error } = await supabase
        .from('tipos_ocorrencia')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      toast.success('Tipo de ocorrencia cadastrado')
      return data
    } catch (err) {
      console.error('Erro ao cadastrar tipo:', err)
      toast.error('Erro ao cadastrar tipo de ocorrencia')
      return null
    }
  }, [])

  const updateTipo = useCallback(async (id: string, payload: Partial<TipoOcorrencia>) => {
    try {
      const { error } = await supabase
        .from('tipos_ocorrencia')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Tipo de ocorrencia atualizado')
      return true
    } catch (err) {
      console.error('Erro ao atualizar tipo:', err)
      toast.error('Erro ao atualizar tipo')
      return false
    }
  }, [])

  const deleteTipo = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('tipos_ocorrencia')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Tipo de ocorrencia excluido')
      return true
    } catch (err) {
      console.error('Erro ao excluir tipo:', err)
      toast.error('Erro ao excluir tipo')
      return false
    }
  }, [])

  // Ocorrencias
  const loadOcorrencias = useCallback(async (filters?: {
    tipo_id?: string
    categoria?: string
    funcionario_id?: string
    data_inicio?: string
    data_fim?: string
  }) => {
    setLoading(true)
    try {
      let query = supabase
        .from('ocorrencias')
        .select(`
          *,
          funcionarios:funcionario_id(nome_completo, codigo),
          tipos_ocorrencia:tipo_ocorrencia_id(titulo, cor, categoria)
        `)
        .order('data_inicio', { ascending: false })

      if (filters?.tipo_id) {
        query = query.eq('tipo_ocorrencia_id', filters.tipo_id)
      }
      if (filters?.funcionario_id) {
        query = query.eq('funcionario_id', filters.funcionario_id)
      }
      if (filters?.data_inicio) {
        query = query.gte('data_inicio', filters.data_inicio)
      }
      if (filters?.data_fim) {
        query = query.lte('data_inicio', filters.data_fim)
      }

      const { data, error } = await query

      if (error) throw error

      const result = (data || []).map((o: Record<string, unknown>) => {
        const func = o.funcionarios as Record<string, string> | null
        const tipo = o.tipos_ocorrencia as Record<string, string> | null
        return {
          ...o,
          funcionario_nome: func?.nome_completo || '',
          funcionario_codigo: func?.codigo || '',
          tipo_titulo: tipo?.titulo || '',
          tipo_cor: tipo?.cor || '#888',
          tipo_categoria: tipo?.categoria || '',
        }
      })

      // Client-side category filter since it's on a joined table
      if (filters?.categoria) {
        return result.filter((o: Record<string, unknown>) => o.tipo_categoria === filters.categoria) as Ocorrencia[]
      }

      return result as Ocorrencia[]
    } catch (err) {
      console.error('Erro ao carregar ocorrencias:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOcorrenciasFuncionario = useCallback(async (funcionarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('ocorrencias')
        .select(`
          *,
          tipos_ocorrencia:tipo_ocorrencia_id(titulo, cor, categoria)
        `)
        .eq('funcionario_id', funcionarioId)
        .order('data_inicio', { ascending: false })

      if (error) throw error

      return (data || []).map((o: Record<string, unknown>) => {
        const tipo = o.tipos_ocorrencia as Record<string, string> | null
        return {
          ...o,
          tipo_titulo: tipo?.titulo || '',
          tipo_cor: tipo?.cor || '#888',
          tipo_categoria: tipo?.categoria || '',
        }
      }) as Ocorrencia[]
    } catch (err) {
      console.error('Erro ao carregar ocorrencias:', err)
      return []
    }
  }, [])

  const createOcorrencia = useCallback(async (payload: {
    funcionario_id: string
    tipo_ocorrencia_id: string
    descricao?: string
    data_inicio: string
    data_fim?: string
    dias?: number
    valor?: number
    arquivo_url?: string
    observacao?: string
  }) => {
    try {
      const { data, error } = await supabase
        .from('ocorrencias')
        .insert({
          ...payload,
          dias: payload.dias || 1,
        })
        .select()
        .single()

      if (error) throw error
      toast.success('Ocorrencia registrada com sucesso')
      return data
    } catch (err) {
      console.error('Erro ao registrar ocorrencia:', err)
      toast.error('Erro ao registrar ocorrencia')
      return null
    }
  }, [])

  const updateOcorrencia = useCallback(async (id: string, payload: Partial<Ocorrencia>) => {
    try {
      const { error } = await supabase
        .from('ocorrencias')
        .update(payload)
        .eq('id', id)

      if (error) throw error
      toast.success('Ocorrencia atualizada')
      return true
    } catch (err) {
      console.error('Erro ao atualizar ocorrencia:', err)
      toast.error('Erro ao atualizar ocorrencia')
      return false
    }
  }, [])

  const deleteOcorrencia = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('ocorrencias')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Ocorrencia excluida')
      return true
    } catch (err) {
      console.error('Erro ao excluir ocorrencia:', err)
      toast.error('Erro ao excluir ocorrencia')
      return false
    }
  }, [])

  const uploadArquivo = useCallback(async (funcionarioId: string, file: File) => {
    try {
      const date = new Date().toISOString().split('T')[0]
      const ext = file.name.split('.').pop()
      const path = `atestados/${funcionarioId}/${date}_${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('arquivos-rh')
        .upload(path, file, { cacheControl: '3600' })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('arquivos-rh').getPublicUrl(path)
      return urlData.publicUrl
    } catch (err) {
      console.error('Erro no upload:', err)
      toast.error('Erro ao enviar arquivo')
      return null
    }
  }, [])

  return {
    loading,
    loadTipos,
    createTipo,
    updateTipo,
    deleteTipo,
    loadOcorrencias,
    loadOcorrenciasFuncionario,
    createOcorrencia,
    updateOcorrencia,
    deleteOcorrencia,
    uploadArquivo,
  }
}
