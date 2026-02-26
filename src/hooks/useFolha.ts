'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface FolhaResumo {
  totalBruto: number
  totalLiquido: number
  custoTotal: number
  totalFuncionarios: number
}

export interface FolhaPorUnidade {
  unidade_id: string
  unidade_titulo: string
  num_funcionarios: number
  total_bruto: number
  total_liquido: number
  custo_total: number
}

export interface FolhaPorSetor {
  setor_id: string
  setor_titulo: string
  setor_tipo?: string
  unidade_titulo?: string
  num_funcionarios: number
  total_bruto: number
}

export interface TopSalario {
  funcionario_id: string
  nome_completo: string
  funcao_titulo?: string
  setor_titulo?: string
  salario_bruto: number
}

export function useFolha() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const loadResumoGeral = useCallback(async (): Promise<FolhaResumo> => {
    setLoading(true)
    try {
      // Try the view first
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('salario_bruto, salario_liquido, custo_funcionario')

      if (error) throw error

      const items = data || []
      return {
        totalBruto: items.reduce((s: number, r: Record<string, number | null>) => s + (r.salario_bruto || 0), 0),
        totalLiquido: items.reduce((s: number, r: Record<string, number | null>) => s + (r.salario_liquido || 0), 0),
        custoTotal: items.reduce((s: number, r: Record<string, number | null>) => s + (r.custo_funcionario || 0), 0),
        totalFuncionarios: items.length,
      }
    } catch (err) {
      console.error('Erro ao carregar resumo da folha:', err)
      // Fallback: query directly
      try {
        const { data: funcData } = await supabase
          .from('funcionarios')
          .select('id')
          .eq('status', 'Ativo')

        const ids = (funcData || []).map((f: Record<string, string>) => f.id)
        if (ids.length === 0) return { totalBruto: 0, totalLiquido: 0, custoTotal: 0, totalFuncionarios: 0 }

        // Get latest salary for each employee
        const { data: salData } = await supabase
          .from('salarios')
          .select('funcionario_id, salario_bruto, salario_liquido, custo_funcionario, data_vigencia')
          .in('funcionario_id', ids)
          .order('data_vigencia', { ascending: false })

        // Pick most recent per employee
        const latest = new Map<string, Record<string, number | null>>()
        for (const s of (salData || [])) {
          if (!latest.has(s.funcionario_id as string)) {
            latest.set(s.funcionario_id as string, s as Record<string, number | null>)
          }
        }

        const items = Array.from(latest.values())
        return {
          totalBruto: items.reduce((s, r) => s + (r.salario_bruto || 0), 0),
          totalLiquido: items.reduce((s, r) => s + (r.salario_liquido || 0), 0),
          custoTotal: items.reduce((s, r) => s + (r.custo_funcionario || 0), 0),
          totalFuncionarios: ids.length,
        }
      } catch {
        return { totalBruto: 0, totalLiquido: 0, custoTotal: 0, totalFuncionarios: 0 }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFolhaPorUnidade = useCallback(async (): Promise<FolhaPorUnidade[]> => {
    try {
      // Get all current salaries with employee unit info
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('funcionario_id, salario_bruto, salario_liquido, custo_funcionario')

      if (error) throw error

      // Get employee -> unit mapping
      const { data: funcData } = await supabase
        .from('funcionarios')
        .select('id, unidade_id')
        .eq('status', 'Ativo')

      const { data: uniData } = await supabase
        .from('unidades')
        .select('id, titulo')

      const funcMap = new Map<string, string>()
      for (const f of (funcData || [])) {
        if (f.unidade_id) funcMap.set(f.id, f.unidade_id)
      }

      const uniMap = new Map<string, string>()
      for (const u of (uniData || [])) {
        uniMap.set(u.id, u.titulo)
      }

      // Group by unit
      const groups = new Map<string, { bruto: number; liquido: number; custo: number; count: number }>()
      for (const s of (data || [])) {
        const uniId = funcMap.get(s.funcionario_id) || 'sem-unidade'
        const group = groups.get(uniId) || { bruto: 0, liquido: 0, custo: 0, count: 0 }
        group.bruto += s.salario_bruto || 0
        group.liquido += s.salario_liquido || 0
        group.custo += s.custo_funcionario || 0
        group.count += 1
        groups.set(uniId, group)
      }

      return Array.from(groups.entries()).map(([id, g]) => ({
        unidade_id: id,
        unidade_titulo: uniMap.get(id) || 'Sem Unidade',
        num_funcionarios: g.count,
        total_bruto: g.bruto,
        total_liquido: g.liquido,
        custo_total: g.custo,
      }))
    } catch (err) {
      console.error('Erro ao carregar folha por unidade:', err)
      return []
    }
  }, [])

  const loadFolhaPorSetor = useCallback(async (): Promise<FolhaPorSetor[]> => {
    try {
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('funcionario_id, salario_bruto')

      if (error) throw error

      const { data: funcData } = await supabase
        .from('funcionarios')
        .select('id, setor_id')
        .eq('status', 'Ativo')

      const { data: setData } = await supabase
        .from('setores')
        .select('id, titulo, unidade_id')

      const { data: uniData } = await supabase
        .from('unidades')
        .select('id, titulo')

      const funcMap = new Map<string, string>()
      for (const f of (funcData || [])) {
        if (f.setor_id) funcMap.set(f.id, f.setor_id)
      }

      const setMap = new Map<string, { titulo: string; unidade_id: string }>()
      for (const s of (setData || [])) {
        setMap.set(s.id, { titulo: s.titulo, unidade_id: s.unidade_id })
      }

      const uniMap = new Map<string, string>()
      for (const u of (uniData || [])) {
        uniMap.set(u.id, u.titulo)
      }

      const groups = new Map<string, { bruto: number; count: number }>()
      for (const s of (data || [])) {
        const setId = funcMap.get(s.funcionario_id) || 'sem-setor'
        const group = groups.get(setId) || { bruto: 0, count: 0 }
        group.bruto += s.salario_bruto || 0
        group.count += 1
        groups.set(setId, group)
      }

      return Array.from(groups.entries()).map(([id, g]) => {
        const setor = setMap.get(id)
        return {
          setor_id: id,
          setor_titulo: setor?.titulo || 'Sem Setor',
          unidade_titulo: setor ? uniMap.get(setor.unidade_id) || '' : '',
          num_funcionarios: g.count,
          total_bruto: g.bruto,
        }
      })
    } catch (err) {
      console.error('Erro ao carregar folha por setor:', err)
      return []
    }
  }, [])

  const loadTopSalarios = useCallback(async (limit = 10): Promise<TopSalario[]> => {
    try {
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('funcionario_id, salario_bruto')
        .order('salario_bruto', { ascending: false })
        .limit(limit)

      if (error) throw error

      const ids = (data || []).map((d: Record<string, string>) => d.funcionario_id)
      if (ids.length === 0) return []

      const { data: funcData } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, funcao_id, setor_id')
        .in('id', ids)

      const { data: funcoesData } = await supabase
        .from('funcoes')
        .select('id, titulo')

      const { data: setoresData } = await supabase
        .from('setores')
        .select('id, titulo')

      const funcMap = new Map<string, Record<string, string>>()
      for (const f of (funcData || [])) {
        funcMap.set(f.id, f as Record<string, string>)
      }

      const funcaoMap = new Map<string, string>()
      for (const f of (funcoesData || [])) {
        funcaoMap.set(f.id, f.titulo)
      }

      const setorMap = new Map<string, string>()
      for (const s of (setoresData || [])) {
        setorMap.set(s.id, s.titulo)
      }

      return (data || []).map((d: Record<string, unknown>) => {
        const func = funcMap.get(d.funcionario_id as string)
        return {
          funcionario_id: d.funcionario_id as string,
          nome_completo: func?.nome_completo || '',
          funcao_titulo: func?.funcao_id ? funcaoMap.get(func.funcao_id) || '' : '',
          setor_titulo: func?.setor_id ? setorMap.get(func.setor_id) || '' : '',
          salario_bruto: d.salario_bruto as number,
        }
      })
    } catch (err) {
      console.error('Erro ao carregar top salarios:', err)
      return []
    }
  }, [])

  return {
    loading,
    loadResumoGeral,
    loadFolhaPorUnidade,
    loadFolhaPorSetor,
    loadTopSalarios,
  }
}
