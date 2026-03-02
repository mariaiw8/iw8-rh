'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { createClient } from '@/lib/supabase'
import { formatDateSafe } from '@/lib/dateUtils'
import { toast } from 'sonner'
import {
  Settings,
  Gift,
  FileText,
  Layers,
  Save,
  Search,
  Users,
  Percent,
  Wallet,
  Award,
  CheckCircle2,
} from 'lucide-react'

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ValorBase {
  id?: string
  chave: string
  titulo: string
  valor: number
  tipo: 'valor' | 'percentual'
}

interface Estimativa13 {
  funcionario_id: string
  nome_completo: string
  codigo: string
  unidade: string
  salario_bruto: number
  adicional_insalubridade: number
  base_mensal: number
  meses_trabalhados: number
  valor_decimo_terceiro: number
}

interface PainelFinanceiroRow {
  origem: string
  registro_id: string
  funcionario_id: string
  nome_completo: string
  codigo: string
  unidade: string
  descricao: string
  natureza: 'Credito' | 'Debito'
  valor: number
  data: string
  categoria: string
  created_at: string
}

type ActiveSection = 'valores-base' | 'estimativa-13' | 'painel' | null

export default function FinanceiroGeralPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<ActiveSection>(null)

  // Valores Base
  const [valoresBase, setValoresBase] = useState<ValorBase[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Estimativa 13
  const [estimativas, setEstimativas] = useState<Estimativa13[]>([])
  const [loadingEstimativa, setLoadingEstimativa] = useState(false)

  // Painel Financeiro
  const [painelData, setPainelData] = useState<PainelFinanceiroRow[]>([])
  const [loadingPainel, setLoadingPainel] = useState(false)
  const [filtroMesAno, setFiltroMesAno] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filtroFuncionario, setFiltroFuncionario] = useState('')
  const [filtroNatureza, setFiltroNatureza] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')

  // Lancamentos em Massa
  const [massModalOpen, setMassModalOpen] = useState(false)
  const [massOption, setMassOption] = useState<1 | 2 | 3>(1)
  const [massLoading, setMassLoading] = useState(false)

  // Option 1: Reajuste Sindical
  const [reajustePercentual, setReajustePercentual] = useState('')
  const [reajustePreview, setReajustePreview] = useState<{ funcionario_id: string; nome_completo: string; salario_atual: number; salario_novo: number }[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Option 2: Lancamento Salarios
  const [salarioPreview, setSalarioPreview] = useState<{ funcionario_id: string; nome_completo: string; salario_bruto: number }[]>([])

  // Option 3: Participacao nos Lucros
  const [plrValor, setPlrValor] = useState('')
  const [plrFuncionarios, setPlrFuncionarios] = useState<{ funcionario_id: string; nome_completo: string; checked: boolean }[]>([])

  // Funcionarios list for filters
  const [funcionariosList, setFuncionariosList] = useState<{ value: string; label: string }[]>([])
  const [origensList, setOrigensList] = useState<string[]>([])

  const loadValoresBase = useCallback(async () => {
    const { data, error } = await supabase
      .from('valores_base')
      .select('*')
      .order('titulo')
    if (error) {
      console.error('Erro ao carregar valores base:', error)
      return
    }
    setValoresBase((data || []) as ValorBase[])
  }, [])

  const loadEstimativa13 = useCallback(async () => {
    setLoadingEstimativa(true)
    try {
      const anoAtual = new Date().getFullYear()
      const { data, error } = await supabase.rpc('fn_estimativa_decimo_terceiro', { p_ano: anoAtual })
      if (error) throw error
      setEstimativas((data || []) as Estimativa13[])
    } catch (err) {
      console.error('Erro ao carregar estimativa 13o:', err)
      toast.error('Erro ao carregar estimativa de 13o salario')
    } finally {
      setLoadingEstimativa(false)
    }
  }, [])

  const loadPainelFinanceiro = useCallback(async () => {
    setLoadingPainel(true)
    try {
      const { data, error } = await supabase
        .from('vw_painel_financeiro')
        .select('*')
      if (error) throw error
      setPainelData((data || []) as PainelFinanceiroRow[])
      const origens = [...new Set((data || []).map((d: PainelFinanceiroRow) => d.origem).filter(Boolean))]
      setOrigensList(origens)
    } catch (err) {
      console.error('Erro ao carregar painel financeiro:', err)
      toast.error('Erro ao carregar painel financeiro')
    } finally {
      setLoadingPainel(false)
    }
  }, [])

  const loadFuncionariosList = useCallback(async () => {
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome_completo')
      .eq('status', 'Ativo')
      .order('nome_completo')
    setFuncionariosList((data || []).map((f: Record<string, string>) => ({ value: f.id, label: f.nome_completo })))
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadValoresBase(), loadFuncionariosList()])
      setLoading(false)
    }
    init()
  }, [loadValoresBase, loadFuncionariosList])

  async function handleSaveValorBase(chave: string, novoValor: number) {
    setSavingKey(chave)
    try {
      const { error } = await supabase
        .from('valores_base')
        .update({ valor: novoValor, updated_at: new Date().toISOString() })
        .eq('chave', chave)
        .select()
      if (error) throw error
      toast.success('Valor atualizado com sucesso')
      await loadValoresBase()
    } catch (err) {
      console.error('Erro ao salvar valor base:', err)
      toast.error('Erro ao salvar valor')
    } finally {
      setSavingKey(null)
    }
  }

  const painelFiltered = painelData.filter((row) => {
    if (filtroFuncionario && row.funcionario_id !== filtroFuncionario) return false
    if (filtroNatureza && row.natureza !== filtroNatureza) return false
    if (filtroOrigem && row.origem !== filtroOrigem) return false
    if (filtroMesAno && row.data) {
      const rowMonth = row.data.substring(0, 7)
      if (rowMonth !== filtroMesAno) return false
    }
    return true
  })

  async function loadReajustePreview() {
    const pct = parseFloat(reajustePercentual)
    if (isNaN(pct) || pct <= 0) {
      toast.error('Informe um percentual valido')
      return
    }
    setLoadingPreview(true)
    try {
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('funcionario_id, salario_bruto')
      if (error) throw error

      const ids = (data || []).map((d: Record<string, string>) => d.funcionario_id)
      const { data: funcData } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('status', 'Ativo')
        .in('id', ids)
      const nameMap = new Map((funcData || []).map((f: Record<string, string>) => [f.id, f.nome_completo]))

      setReajustePreview(
        (data || []).map((d: Record<string, unknown>) => ({
          funcionario_id: d.funcionario_id as string,
          nome_completo: nameMap.get(d.funcionario_id as string) || '',
          salario_atual: d.salario_bruto as number,
          salario_novo: (d.salario_bruto as number) * (1 + pct / 100),
        }))
      )
    } catch (err) {
      console.error('Erro ao carregar preview:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function loadSalarioPreview() {
    setLoadingPreview(true)
    try {
      const { data, error } = await supabase
        .from('vw_salario_atual')
        .select('funcionario_id, salario_bruto')
      if (error) throw error

      const ids = (data || []).map((d: Record<string, string>) => d.funcionario_id)
      const { data: funcData } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('status', 'Ativo')
        .in('id', ids)
      const nameMap = new Map((funcData || []).map((f: Record<string, string>) => [f.id, f.nome_completo]))

      setSalarioPreview(
        (data || []).map((d: Record<string, unknown>) => ({
          funcionario_id: d.funcionario_id as string,
          nome_completo: nameMap.get(d.funcionario_id as string) || '',
          salario_bruto: d.salario_bruto as number,
        }))
      )
    } catch (err) {
      console.error('Erro ao carregar preview:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function loadPlrFuncionarios() {
    setLoadingPreview(true)
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('status', 'Ativo')
        .order('nome_completo')
      if (error) throw error
      setPlrFuncionarios(
        (data || []).map((f: Record<string, string>) => ({
          funcionario_id: f.id,
          nome_completo: f.nome_completo,
          checked: true,
        }))
      )
    } catch (err) {
      console.error('Erro ao carregar funcionarios:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function applyReajuste() {
    const pct = parseFloat(reajustePercentual)
    if (isNaN(pct) || pct <= 0 || reajustePreview.length === 0) return
    setMassLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      for (const item of reajustePreview) {
        const { error } = await supabase
          .from('salarios')
          .insert({
            funcionario_id: item.funcionario_id,
            salario_bruto: Math.round(item.salario_novo * 100) / 100,
            data_vigencia: today,
            observacao: `Reajuste sindical de ${pct}%`,
          })
          .select()
        if (error) console.error('Erro reajuste:', item.nome_completo, error)
      }
      toast.success(`Reajuste de ${pct}% aplicado para ${reajustePreview.length} funcionarios`)
      setMassModalOpen(false)
      setReajustePreview([])
      setReajustePercentual('')
    } catch (err) {
      console.error('Erro ao aplicar reajuste:', err)
      toast.error('Erro ao aplicar reajuste')
    } finally {
      setMassLoading(false)
    }
  }

  async function applySalariosEmMassa() {
    if (salarioPreview.length === 0) return
    setMassLoading(true)
    try {
      let tipoId: string | null = null
      const { data: tipoData } = await supabase
        .from('tipos_transacao')
        .select('id')
        .ilike('titulo', '%Salario%')
        .limit(1)
      if (tipoData && tipoData.length > 0) {
        tipoId = tipoData[0].id
      } else {
        const { data: newTipo } = await supabase
          .from('tipos_transacao')
          .insert({ titulo: 'Salario', natureza: 'Credito' })
          .select()
          .single()
        tipoId = newTipo?.id || null
      }
      if (!tipoId) {
        toast.error('Tipo de transacao "Salario" nao encontrado')
        return
      }
      const today = new Date().toISOString().split('T')[0]
      for (const item of salarioPreview) {
        const { error } = await supabase
          .from('transacoes')
          .insert({
            funcionario_id: item.funcionario_id,
            tipo_transacao_id: tipoId,
            valor: item.salario_bruto,
            data: today,
            descricao: 'Lancamento de salario em massa',
          })
          .select()
        if (error) console.error('Erro salario:', item.nome_completo, error)
      }
      toast.success(`Salarios lancados para ${salarioPreview.length} funcionarios`)
      setMassModalOpen(false)
      setSalarioPreview([])
    } catch (err) {
      console.error('Erro ao lancar salarios:', err)
      toast.error('Erro ao lancar salarios em massa')
    } finally {
      setMassLoading(false)
    }
  }

  async function applyPLR() {
    const valor = parseFloat(plrValor)
    if (isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor valido')
      return
    }
    const selected = plrFuncionarios.filter((f) => f.checked)
    if (selected.length === 0) {
      toast.error('Selecione ao menos um funcionario')
      return
    }
    setMassLoading(true)
    try {
      for (const item of selected) {
        const { error } = await supabase
          .from('ocorrencias')
          .insert({
            funcionario_id: item.funcionario_id,
            tipo_ocorrencia_id: null,
            data_inicio: new Date().toISOString().split('T')[0],
            descricao: 'Participacao nos Lucros',
            valor: valor,
            observacao: `PLR - R$ ${valor.toFixed(2)}`,
          })
          .select()
        if (error) console.error('Erro PLR:', item.nome_completo, error)
      }
      toast.success(`PLR lancada para ${selected.length} funcionarios`)
      setMassModalOpen(false)
      setPlrFuncionarios([])
      setPlrValor('')
    } catch (err) {
      console.error('Erro ao lancar PLR:', err)
      toast.error('Erro ao lancar participacao nos lucros')
    } finally {
      setMassLoading(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={5} />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-cinza-preto">Financeiro</h1>
          <p className="text-sm text-cinza-estrutural">Gestao financeira completa</p>
        </div>
        <Button size="sm" onClick={() => { setMassModalOpen(true); setMassOption(1) }}>
          <Layers size={14} /> Lancamentos em Massa
        </Button>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => { setActiveSection('valores-base'); loadValoresBase() }}
          className={`text-left bg-white rounded-xl shadow-sm p-6 transition-all hover:shadow-md border-2 ${activeSection === 'valores-base' ? 'border-laranja' : 'border-transparent'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-laranja/10 flex items-center justify-center">
              <Settings size={20} className="text-laranja" />
            </div>
            <h3 className="font-bold text-cinza-preto">Valores Base</h3>
          </div>
          <p className="text-sm text-cinza-estrutural">Parametros financeiros do sistema</p>
        </button>

        <button
          onClick={() => { setActiveSection('estimativa-13'); loadEstimativa13() }}
          className={`text-left bg-white rounded-xl shadow-sm p-6 transition-all hover:shadow-md border-2 ${activeSection === 'estimativa-13' ? 'border-laranja' : 'border-transparent'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Gift size={20} className="text-green-600" />
            </div>
            <h3 className="font-bold text-cinza-preto">Estimativa 13o</h3>
          </div>
          <p className="text-sm text-cinza-estrutural">Estimativa do decimo terceiro do ano</p>
        </button>

        <button
          onClick={() => { setActiveSection('painel'); loadPainelFinanceiro() }}
          className={`text-left bg-white rounded-xl shadow-sm p-6 transition-all hover:shadow-md border-2 ${activeSection === 'painel' ? 'border-laranja' : 'border-transparent'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText size={20} className="text-azul" />
            </div>
            <h3 className="font-bold text-cinza-preto">Painel Financeiro</h3>
          </div>
          <p className="text-sm text-cinza-estrutural">Registros financeiros consolidados</p>
        </button>
      </div>

      {/* SECAO: Valores Base */}
      {activeSection === 'valores-base' && (
        <Card className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Settings size={20} className="text-laranja" />
            <h3 className="text-lg font-bold text-cinza-preto">Valores Base</h3>
          </div>
          {valoresBase.length === 0 ? (
            <EmptyState icon={<Settings size={48} />} title="Nenhum valor base cadastrado" description="Configure os parametros financeiros do sistema" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {valoresBase.map((vb) => (
                <ValorBaseItem key={vb.chave} item={vb} saving={savingKey === vb.chave} onSave={(novoValor) => handleSaveValorBase(vb.chave, novoValor)} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SECAO: Estimativa 13o */}
      {activeSection === 'estimativa-13' && (
        <Card className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Gift size={20} className="text-green-600" />
            <h3 className="text-lg font-bold text-cinza-preto">Estimativa 13o Salario — {new Date().getFullYear()}</h3>
          </div>
          {loadingEstimativa ? (
            <TableSkeleton rows={5} />
          ) : estimativas.length === 0 ? (
            <EmptyState icon={<Gift size={48} />} title="Nenhum dado disponivel" description="Nao foi possivel calcular a estimativa de 13o salario" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>Funcionario</TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Base Mensal</TableHead>
                  <TableHead className="text-center">Meses</TableHead>
                  <TableHead>Valor 13o</TableHead>
                </TableHeader>
                <TableBody>
                  {estimativas.map((e) => (
                    <TableRow key={e.funcionario_id}>
                      <TableCell className="font-medium">{e.nome_completo}</TableCell>
                      <TableCell>{e.codigo || '-'}</TableCell>
                      <TableCell>{e.unidade || '-'}</TableCell>
                      <TableCell>{formatCurrency(e.base_mensal)}</TableCell>
                      <TableCell className="text-center"><Badge variant="info">{e.meses_trabalhados}</Badge></TableCell>
                      <TableCell className="font-bold text-green-700">{formatCurrency(e.valor_decimo_terceiro)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="bg-azul text-white rounded-b-lg px-4 py-3 flex justify-between text-sm font-medium">
                <span>Total ({estimativas.length} funcionarios)</span>
                <span className="font-bold">{formatCurrency(estimativas.reduce((sum, e) => sum + (e.valor_decimo_terceiro || 0), 0))}</span>
              </div>
            </>
          )}
        </Card>
      )}

      {/* SECAO: Painel Financeiro */}
      {activeSection === 'painel' && (
        <Card className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-azul" />
            <h3 className="text-lg font-bold text-cinza-preto">Painel Financeiro</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 print:hidden">
            <div>
              <label className="block text-sm font-medium text-cinza-preto mb-1">Mes/Ano</label>
              <input
                type="month"
                value={filtroMesAno}
                onChange={(e) => setFiltroMesAno(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
              />
            </div>
            <Select label="Funcionario" value={filtroFuncionario} onChange={(e) => setFiltroFuncionario(e.target.value)} options={funcionariosList} placeholder="Todos" />
            <Select label="Natureza" value={filtroNatureza} onChange={(e) => setFiltroNatureza(e.target.value)} options={[{ value: 'Credito', label: 'Credito' }, { value: 'Debito', label: 'Debito' }]} placeholder="Todas" />
            <Select label="Origem" value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)} options={origensList.map((o) => ({ value: o, label: o }))} placeholder="Todas" />
          </div>
          {loadingPainel ? (
            <TableSkeleton rows={8} />
          ) : painelFiltered.length === 0 ? (
            <EmptyState icon={<FileText size={48} />} title="Nenhum registro encontrado" description="Ajuste os filtros para encontrar registros financeiros" />
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Funcionario</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Origem</TableHead>
              </TableHeader>
              <TableBody>
                {painelFiltered.map((row, i) => (
                  <TableRow key={`${row.registro_id}-${i}`}>
                    <TableCell>
                      <Link href={`/funcionarios/${row.funcionario_id}/financeiro`} className="text-azul hover:underline font-medium">
                        {row.nome_completo}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.descricao || '-'}</TableCell>
                    <TableCell><Badge variant={row.natureza === 'Credito' ? 'success' : 'danger'}>{row.natureza}</Badge></TableCell>
                    <TableCell className={`font-medium ${row.natureza === 'Credito' ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(row.valor)}</TableCell>
                    <TableCell>{formatDateSafe(row.data)}</TableCell>
                    <TableCell>{row.categoria || '-'}</TableCell>
                    <TableCell><Badge variant="neutral">{row.origem || '-'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Modal: Lancamentos em Massa */}
      <Modal open={massModalOpen} onClose={() => setMassModalOpen(false)} title="Lancamentos em Massa" size="xl">
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => { setMassOption(1); setReajustePreview([]); setSalarioPreview([]); setPlrFuncionarios([]) }} className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${massOption === 1 ? 'bg-white text-cinza-preto shadow-sm' : 'text-cinza-estrutural hover:text-cinza-preto'}`}>
            <Percent size={14} className="inline mr-1" /> Reajuste Sindical
          </button>
          <button onClick={() => { setMassOption(2); setReajustePreview([]); setSalarioPreview([]); setPlrFuncionarios([]) }} className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${massOption === 2 ? 'bg-white text-cinza-preto shadow-sm' : 'text-cinza-estrutural hover:text-cinza-preto'}`}>
            <Wallet size={14} className="inline mr-1" /> Salarios em Massa
          </button>
          <button onClick={() => { setMassOption(3); setReajustePreview([]); setSalarioPreview([]); setPlrFuncionarios([]) }} className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${massOption === 3 ? 'bg-white text-cinza-preto shadow-sm' : 'text-cinza-estrutural hover:text-cinza-preto'}`}>
            <Award size={14} className="inline mr-1" /> Part. nos Lucros
          </button>
        </div>

        {massOption === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-cinza-estrutural">Aplique um reajuste percentual sobre o salario bruto de todos os funcionarios ativos.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-cinza-preto mb-1">Fonte</label>
                <input type="text" value="Salario Bruto" disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto bg-gray-50" />
              </div>
              <Input label="Percentual de Reajuste (%)" type="number" step="0.01" value={reajustePercentual} onChange={(e) => setReajustePercentual(e.target.value)} placeholder="Ex: 5.5" />
            </div>
            <Button size="sm" variant="secondary" onClick={loadReajustePreview} disabled={loadingPreview}>
              <Search size={14} /> {loadingPreview ? 'Carregando...' : 'Gerar Preview'}
            </Button>
            {reajustePreview.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableHead>Funcionario</TableHead>
                    <TableHead>Salario Atual</TableHead>
                    <TableHead>Salario Novo</TableHead>
                  </TableHeader>
                  <TableBody>
                    {reajustePreview.map((r) => (
                      <TableRow key={r.funcionario_id}>
                        <TableCell className="font-medium">{r.nome_completo}</TableCell>
                        <TableCell>{formatCurrency(r.salario_atual)}</TableCell>
                        <TableCell className="font-bold text-green-700">{formatCurrency(r.salario_novo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end">
                  <Button onClick={applyReajuste} disabled={massLoading}>
                    <CheckCircle2 size={14} /> {massLoading ? 'Aplicando...' : 'Aplicar Reajuste'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {massOption === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-cinza-estrutural">Cria um registro de transacao de salario para cada funcionario ativo com o valor vigente.</p>
            <Button size="sm" variant="secondary" onClick={loadSalarioPreview} disabled={loadingPreview}>
              <Search size={14} /> {loadingPreview ? 'Carregando...' : 'Gerar Preview'}
            </Button>
            {salarioPreview.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableHead>Funcionario</TableHead>
                    <TableHead>Salario Bruto</TableHead>
                  </TableHeader>
                  <TableBody>
                    {salarioPreview.map((s) => (
                      <TableRow key={s.funcionario_id}>
                        <TableCell className="font-medium">{s.nome_completo}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(s.salario_bruto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
                  <strong>Total:</strong> {formatCurrency(salarioPreview.reduce((s, item) => s + item.salario_bruto, 0))} para {salarioPreview.length} funcionarios
                </div>
                <div className="flex justify-end">
                  <Button onClick={applySalariosEmMassa} disabled={massLoading}>
                    <CheckCircle2 size={14} /> {massLoading ? 'Lancando...' : 'Confirmar Lancamento'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {massOption === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-cinza-estrutural">Registra uma ocorrencia de Participacao nos Lucros para os funcionarios selecionados.</p>
            <Input label="Valor (R$)" type="number" step="0.01" value={plrValor} onChange={(e) => setPlrValor(e.target.value)} placeholder="Ex: 1000.00" />
            <Button size="sm" variant="secondary" onClick={loadPlrFuncionarios} disabled={loadingPreview}>
              <Users size={14} /> {loadingPreview ? 'Carregando...' : 'Carregar Funcionarios'}
            </Button>
            {plrFuncionarios.length > 0 && (
              <>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <label className="flex items-center gap-2 text-sm font-medium text-cinza-preto">
                      <input type="checkbox" checked={plrFuncionarios.every((f) => f.checked)} onChange={(e) => setPlrFuncionarios((prev) => prev.map((f) => ({ ...f, checked: e.target.checked })))} className="rounded" />
                      Selecionar todos ({plrFuncionarios.filter((f) => f.checked).length}/{plrFuncionarios.length})
                    </label>
                  </div>
                  {plrFuncionarios.map((f, idx) => (
                    <label key={f.funcionario_id} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <input type="checkbox" checked={f.checked} onChange={(e) => setPlrFuncionarios((prev) => prev.map((item, i) => i === idx ? { ...item, checked: e.target.checked } : item))} className="rounded" />
                      {f.nome_completo}
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={applyPLR} disabled={massLoading || !plrValor}>
                    <CheckCircle2 size={14} /> {massLoading ? 'Lancando...' : 'Confirmar PLR'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}

function ValorBaseItem({ item, saving, onSave }: { item: ValorBase; saving: boolean; onSave: (v: number) => void }) {
  const [editValue, setEditValue] = useState(String(item.valor))
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium text-cinza-preto">{item.titulo}</p>
        {!editing ? (
          <p className="text-lg font-bold text-cinza-preto mt-1">
            {item.tipo === 'percentual' ? `${item.valor}%` : formatCurrency(item.valor)}
          </p>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-32 px-2 py-1 border border-gray-200 rounded text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja" />
            <span className="text-sm text-cinza-estrutural">{item.tipo === 'percentual' ? '%' : 'R$'}</span>
          </div>
        )}
      </div>
      <div className="flex gap-1">
        {editing ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditValue(String(item.valor)) }}>Cancelar</Button>
            <Button size="sm" disabled={saving} onClick={() => { const v = parseFloat(editValue); if (!isNaN(v)) { onSave(v); setEditing(false) } }}>
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
        )}
      </div>
    </div>
  )
}
