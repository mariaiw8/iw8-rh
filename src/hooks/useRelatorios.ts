'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface RelatorioFuncionario {
  nome: string
  codigo: string
  cpf: string
  unidade: string
  setor: string
  funcao: string
  data_admissao: string
  tempo_empresa: string
}

export interface RelatorioFeriasVencer {
  nome: string
  codigo: string
  periodo_aquisitivo: string
  dias_restantes: number
  vencimento: string
  situacao: string
}

export interface RelatorioProgramacaoFerias {
  nome: string
  unidade: string
  setor: string
  data_inicio: string
  data_fim: string
  dias: number
  status: string
}

export interface RelatorioOcorrencia {
  data: string
  funcionario: string
  tipo: string
  categoria: string
  dias: number
  valor: number
  descricao: string
}

export interface RelatorioFolha {
  nome: string
  funcao: string
  setor: string
  salario_bruto: number
  salario_liquido: number
  custo: number
}

export interface RelatorioAniversariante {
  nome: string
  data_nascimento: string
  idade: number
  setor: string
  funcao: string
}

export interface RelatorioResumo {
  headcount: number
  admissoes: number
  desligamentos: number
  turnover: string
  absenteismo: string
  folhaTotal: string
}

export function useRelatorios() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const loadFuncionariosAtivos = useCallback(async (filtros: {
    unidade_id?: string
    setor_id?: string
    funcao_id?: string
  } = {}): Promise<RelatorioFuncionario[]> => {
    setLoading(true)
    try {
      let query = supabase
        .from('funcionarios')
        .select('id, nome_completo, codigo, cpf, data_admissao, status, unidade_id, setor_id, funcao_id')
        .eq('status', 'Ativo')
        .order('nome_completo')

      if (filtros.unidade_id) query = query.eq('unidade_id', filtros.unidade_id)
      if (filtros.setor_id) query = query.eq('setor_id', filtros.setor_id)
      if (filtros.funcao_id) query = query.eq('funcao_id', filtros.funcao_id)

      const [funcRes, uniRes, setRes, funcoesRes] = await Promise.all([
        query,
        supabase.from('unidades').select('id, titulo'),
        supabase.from('setores').select('id, titulo'),
        supabase.from('funcoes').select('id, titulo'),
      ])

      const uniMap = new Map<string, string>()
      for (const u of (uniRes.data || [])) uniMap.set(u.id, u.titulo)
      const setMap = new Map<string, string>()
      for (const s of (setRes.data || [])) setMap.set(s.id, s.titulo)
      const funcaoMap = new Map<string, string>()
      for (const f of (funcoesRes.data || [])) funcaoMap.set(f.id, f.titulo)

      const hoje = new Date()
      return (funcRes.data || []).map((f) => {
        let tempoEmpresa = '-'
        if (f.data_admissao) {
          const admissao = new Date(f.data_admissao + 'T00:00:00')
          const dias = Math.floor((hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24))
          const anos = Math.floor(dias / 365)
          const meses = Math.floor((dias % 365) / 30)
          tempoEmpresa = anos > 0 ? `${anos}a ${meses}m` : `${meses}m`
        }
        return {
          nome: f.nome_completo || '',
          codigo: f.codigo || '',
          cpf: f.cpf || '',
          unidade: uniMap.get(f.unidade_id) || '-',
          setor: setMap.get(f.setor_id) || '-',
          funcao: funcaoMap.get(f.funcao_id) || '-',
          data_admissao: f.data_admissao || '',
          tempo_empresa: tempoEmpresa,
        }
      })
    } catch (err) {
      console.error('Erro ao carregar relatorio funcionarios:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFeriasAVencer = useCallback(async (filtros: {
    situacao?: string
    unidade_id?: string
  } = {}): Promise<RelatorioFeriasVencer[]> => {
    setLoading(true)
    try {
      let query = supabase.from('vw_ferias_a_vencer').select('*')
      if (filtros.situacao && filtros.situacao !== 'Todas') {
        query = query.eq('situacao', filtros.situacao.toUpperCase())
      }

      const { data } = await query

      let results = (data || []).map((f: Record<string, unknown>) => ({
        nome: (f.nome || f.funcionario_nome || '') as string,
        codigo: (f.codigo || '') as string,
        periodo_aquisitivo: (f.periodo_aquisitivo || f.periodo || '') as string,
        dias_restantes: (f.dias_restantes || 0) as number,
        vencimento: (f.vencimento || f.data_vencimento || '') as string,
        situacao: (f.situacao || '') as string,
        unidade_id: (f.unidade_id || '') as string,
      }))

      if (filtros.unidade_id) {
        results = results.filter((r) => (r as Record<string, unknown>).unidade_id === filtros.unidade_id)
      }

      return results
    } catch (err) {
      console.error('Erro ao carregar relatorio ferias a vencer:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProgramacaoFerias = useCallback(async (filtros: {
    data_inicio?: string
    data_fim?: string
    unidade_id?: string
    status?: string
  } = {}): Promise<RelatorioProgramacaoFerias[]> => {
    setLoading(true)
    try {
      let query = supabase.from('ferias').select('id, funcionario_id, data_inicio, data_fim, dias, status')
      if (filtros.data_inicio) query = query.gte('data_inicio', filtros.data_inicio)
      if (filtros.data_fim) query = query.lte('data_fim', filtros.data_fim)
      if (filtros.status) query = query.eq('status', filtros.status)

      const [feriasRes, funcRes, uniRes, setRes] = await Promise.all([
        query.order('data_inicio'),
        supabase.from('funcionarios').select('id, nome_completo, unidade_id, setor_id'),
        supabase.from('unidades').select('id, titulo'),
        supabase.from('setores').select('id, titulo'),
      ])

      const funcMap = new Map<string, Record<string, string>>()
      for (const f of (funcRes.data || [])) funcMap.set(f.id, f as Record<string, string>)
      const uniMap = new Map<string, string>()
      for (const u of (uniRes.data || [])) uniMap.set(u.id, u.titulo)
      const setMap = new Map<string, string>()
      for (const s of (setRes.data || [])) setMap.set(s.id, s.titulo)

      let results = (feriasRes.data || []).map((f) => {
        const func = funcMap.get(f.funcionario_id) || {}
        return {
          nome: (func as Record<string, string>).nome_completo || '',
          unidade: uniMap.get((func as Record<string, string>).unidade_id) || '-',
          setor: setMap.get((func as Record<string, string>).setor_id) || '-',
          data_inicio: f.data_inicio || '',
          data_fim: f.data_fim || '',
          dias: f.dias || 0,
          status: f.status || '',
          unidade_id: (func as Record<string, string>).unidade_id || '',
        }
      })

      if (filtros.unidade_id) {
        results = results.filter((r) => (r as Record<string, unknown>).unidade_id === filtros.unidade_id)
      }

      return results
    } catch (err) {
      console.error('Erro ao carregar relatorio programacao ferias:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOcorrencias = useCallback(async (filtros: {
    data_inicio?: string
    data_fim?: string
    tipo_id?: string
    categoria?: string
    funcionario_id?: string
  } = {}): Promise<RelatorioOcorrencia[]> => {
    setLoading(true)
    try {
      let query = supabase.from('ocorrencias').select('id, funcionario_id, tipo_ocorrencia_id, descricao, data_inicio, data_fim, dias, valor')
      if (filtros.data_inicio) query = query.gte('data_inicio', filtros.data_inicio)
      if (filtros.data_fim) query = query.lte('data_inicio', filtros.data_fim)
      if (filtros.tipo_id) query = query.eq('tipo_ocorrencia_id', filtros.tipo_id)
      if (filtros.funcionario_id) query = query.eq('funcionario_id', filtros.funcionario_id)

      const [ocRes, funcRes, tiposRes] = await Promise.all([
        query.order('data_inicio', { ascending: false }),
        supabase.from('funcionarios').select('id, nome_completo'),
        supabase.from('tipos_ocorrencia').select('id, titulo, categoria'),
      ])

      const funcMap = new Map<string, string>()
      for (const f of (funcRes.data || [])) funcMap.set(f.id, f.nome_completo)
      const tipoMap = new Map<string, { titulo: string; categoria: string }>()
      for (const t of (tiposRes.data || [])) tipoMap.set(t.id, { titulo: t.titulo, categoria: t.categoria })

      let results = (ocRes.data || []).map((o) => {
        const tipo = tipoMap.get(o.tipo_ocorrencia_id) || { titulo: '-', categoria: '-' }
        return {
          data: o.data_inicio || '',
          funcionario: funcMap.get(o.funcionario_id) || '-',
          tipo: tipo.titulo,
          categoria: tipo.categoria,
          dias: o.dias || 0,
          valor: o.valor || 0,
          descricao: o.descricao || '',
        }
      })

      if (filtros.categoria) {
        results = results.filter((r) => r.categoria === filtros.categoria)
      }

      return results
    } catch (err) {
      console.error('Erro ao carregar relatorio ocorrencias:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFolhaPagamento = useCallback(async (filtros: {
    unidade_id?: string
    setor_id?: string
  } = {}): Promise<RelatorioFolha[]> => {
    setLoading(true)
    try {
      const [salRes, funcRes, funcoesRes, setoresRes] = await Promise.all([
        supabase.from('vw_salario_atual').select('funcionario_id, salario_bruto, salario_liquido, custo_funcionario'),
        supabase.from('funcionarios').select('id, nome_completo, funcao_id, setor_id, unidade_id').eq('status', 'Ativo'),
        supabase.from('funcoes').select('id, titulo'),
        supabase.from('setores').select('id, titulo'),
      ])

      const funcaoMap = new Map<string, string>()
      for (const f of (funcoesRes.data || [])) funcaoMap.set(f.id, f.titulo)
      const setorMap = new Map<string, string>()
      for (const s of (setoresRes.data || [])) setorMap.set(s.id, s.titulo)

      const funcMap = new Map<string, Record<string, string>>()
      for (const f of (funcRes.data || [])) funcMap.set(f.id, f as Record<string, string>)

      let results = (salRes.data || []).map((s) => {
        const func = funcMap.get(s.funcionario_id) || {}
        return {
          nome: (func as Record<string, string>).nome_completo || '-',
          funcao: funcaoMap.get((func as Record<string, string>).funcao_id) || '-',
          setor: setorMap.get((func as Record<string, string>).setor_id) || '-',
          salario_bruto: s.salario_bruto || 0,
          salario_liquido: s.salario_liquido || 0,
          custo: s.custo_funcionario || 0,
          unidade_id: (func as Record<string, string>).unidade_id || '',
          setor_id: (func as Record<string, string>).setor_id || '',
        }
      })

      if (filtros.unidade_id) {
        results = results.filter((r) => (r as Record<string, unknown>).unidade_id === filtros.unidade_id)
      }
      if (filtros.setor_id) {
        results = results.filter((r) => (r as Record<string, unknown>).setor_id === filtros.setor_id)
      }

      return results.sort((a, b) => a.nome.localeCompare(b.nome))
    } catch (err) {
      console.error('Erro ao carregar relatorio folha:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAniversariantes = useCallback(async (mes: number): Promise<RelatorioAniversariante[]> => {
    setLoading(true)
    try {
      const [funcRes, funcoesRes, setoresRes] = await Promise.all([
        supabase.from('funcionarios').select('id, nome_completo, data_nascimento, funcao_id, setor_id').eq('status', 'Ativo'),
        supabase.from('funcoes').select('id, titulo'),
        supabase.from('setores').select('id, titulo'),
      ])

      const funcaoMap = new Map<string, string>()
      for (const f of (funcoesRes.data || [])) funcaoMap.set(f.id, f.titulo)
      const setorMap = new Map<string, string>()
      for (const s of (setoresRes.data || [])) setorMap.set(s.id, s.titulo)

      const hoje = new Date()
      return (funcRes.data || [])
        .filter((f) => {
          if (!f.data_nascimento) return false
          const m = parseInt(f.data_nascimento.split('-')[1], 10)
          return m === mes
        })
        .map((f) => {
          const nascimento = new Date(f.data_nascimento + 'T00:00:00')
          const idade = Math.floor((hoje.getTime() - nascimento.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
          return {
            nome: f.nome_completo || '',
            data_nascimento: f.data_nascimento || '',
            idade,
            setor: setorMap.get(f.setor_id) || '-',
            funcao: funcaoMap.get(f.funcao_id) || '-',
          }
        })
        .sort((a, b) => {
          const diaA = parseInt(a.data_nascimento.split('-')[2], 10)
          const diaB = parseInt(b.data_nascimento.split('-')[2], 10)
          return diaA - diaB
        })
    } catch (err) {
      console.error('Erro ao carregar relatorio aniversariantes:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadResumoIndicadores = useCallback(async (periodo: {
    data_inicio: string
    data_fim: string
  }): Promise<RelatorioResumo> => {
    setLoading(true)
    try {
      const [funcRes, salRes] = await Promise.all([
        supabase.from('funcionarios').select('id, data_admissao, data_desligamento, status'),
        supabase.from('vw_salario_atual').select('salario_bruto'),
      ])

      const todos = funcRes.data || []
      const ativos = todos.filter((f) => f.status === 'Ativo')
      const admissoes = todos.filter((f) => f.data_admissao && f.data_admissao >= periodo.data_inicio && f.data_admissao <= periodo.data_fim).length
      const desligamentos = todos.filter((f) => f.data_desligamento && f.data_desligamento >= periodo.data_inicio && f.data_desligamento <= periodo.data_fim).length
      const media = ativos.length || 1
      const turnover = ((desligamentos / media) * 100).toFixed(1)
      const folhaTotal = (salRes.data || []).reduce((s, r) => s + (r.salario_bruto || 0), 0)

      return {
        headcount: ativos.length,
        admissoes,
        desligamentos,
        turnover: turnover + '%',
        absenteismo: '-',
        folhaTotal: folhaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      }
    } catch (err) {
      console.error('Erro ao carregar resumo indicadores:', err)
      return { headcount: 0, admissoes: 0, desligamentos: 0, turnover: '0%', absenteismo: '-', folhaTotal: 'R$ 0,00' }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    loadFuncionariosAtivos,
    loadFeriasAVencer,
    loadProgramacaoFerias,
    loadOcorrencias,
    loadFolhaPagamento,
    loadAniversariantes,
    loadResumoIndicadores,
  }
}
