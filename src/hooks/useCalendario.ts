'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface CalendarioEvento {
  id: string
  titulo: string
  tipo: 'ferias' | 'ocorrencia' | 'ferias_coletivas'
  funcionario_nome?: string
  data_inicio: string
  data_fim: string
  dias?: number
  cor: string
}

export function useCalendario() {
  const supabase = createClient()

  const loadEventos = useCallback(async (inicio: string, fim: string) => {
    try {
      // Try to use the vw_calendario view first
      const { data: viewData, error: viewError } = await supabase
        .from('vw_calendario')
        .select('*')
        .gte('data_fim', inicio)
        .lte('data_inicio', fim)

      if (!viewError && viewData) {
        return viewData.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          titulo: (e.titulo || e.nome || '') as string,
          tipo: (e.tipo_evento || e.tipo || 'ferias') as CalendarioEvento['tipo'],
          funcionario_nome: (e.funcionario_nome || e.nome || '') as string,
          data_inicio: (e.data_inicio || e.inicio) as string,
          data_fim: (e.data_fim || e.fim) as string,
          dias: (e.dias || 0) as number,
          cor: (e.cor || '#F5AF00') as string,
        })) as CalendarioEvento[]
      }

      // Fallback: load from individual tables
      const [feriasRes, ocorrenciasRes, coletivasRes] = await Promise.all([
        supabase
          .from('ferias')
          .select('id, funcionario_id, data_inicio, data_fim, dias, status, funcionarios:funcionario_id(nome_completo)')
          .gte('data_fim', inicio)
          .lte('data_inicio', fim)
          .neq('status', 'Cancelada'),
        supabase
          .from('ocorrencias')
          .select('id, funcionario_id, data_inicio, data_fim, dias, funcionarios:funcionario_id(nome_completo), tipos_ocorrencia:tipo_ocorrencia_id(titulo, cor)')
          .gte('data_inicio', inicio)
          .lte('data_inicio', fim),
        supabase
          .from('ferias_coletivas')
          .select('*')
          .gte('data_fim', inicio)
          .lte('data_inicio', fim),
      ])

      const eventos: CalendarioEvento[] = []

      // Ferias individuais
      if (feriasRes.data) {
        feriasRes.data.forEach((f: Record<string, unknown>) => {
          const func = f.funcionarios as Record<string, string> | null
          eventos.push({
            id: f.id as string,
            titulo: `Ferias - ${func?.nome_completo || ''}`,
            tipo: 'ferias',
            funcionario_nome: func?.nome_completo || '',
            data_inicio: f.data_inicio as string,
            data_fim: f.data_fim as string,
            dias: f.dias as number,
            cor: '#F5AF00',
          })
        })
      }

      // Ocorrencias
      if (ocorrenciasRes.data) {
        ocorrenciasRes.data.forEach((o: Record<string, unknown>) => {
          const func = o.funcionarios as Record<string, string> | null
          const tipo = o.tipos_ocorrencia as Record<string, string> | null
          eventos.push({
            id: o.id as string,
            titulo: `${tipo?.titulo || 'Ocorrencia'} - ${func?.nome_completo || ''}`,
            tipo: 'ocorrencia',
            funcionario_nome: func?.nome_completo || '',
            data_inicio: o.data_inicio as string,
            data_fim: (o.data_fim || o.data_inicio) as string,
            dias: o.dias as number,
            cor: tipo?.cor || '#888',
          })
        })
      }

      // Ferias coletivas
      if (coletivasRes.data) {
        coletivasRes.data.forEach((fc: Record<string, unknown>) => {
          eventos.push({
            id: fc.id as string,
            titulo: `Coletivas: ${fc.titulo as string}`,
            tipo: 'ferias_coletivas',
            data_inicio: fc.data_inicio as string,
            data_fim: fc.data_fim as string,
            dias: fc.dias as number,
            cor: '#E57B25',
          })
        })
      }

      return eventos
    } catch (err) {
      console.error('Erro ao carregar calendario:', err)
      return []
    }
  }, [])

  return { loadEventos }
}
