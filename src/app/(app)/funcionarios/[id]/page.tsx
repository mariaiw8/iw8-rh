'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FileUpload } from '@/components/ui/FileUpload'
import { Skeleton } from '@/components/ui/LoadingSkeleton'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Pencil, Save, X, Plus, Trash2, Clock, Building2, Calendar, DollarSign, ClipboardList, ExternalLink, FileText, TrendingUp, TrendingDown, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, differenceInYears, differenceInMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function safeFormat(dateStr: string | null | undefined, fmt: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr + 'T00:00:00'), fmt)
  } catch {
    return dateStr
  }
}

import { useFerias, type FeriasSaldo, type Ferias, type FeriasExtrato } from '@/hooks/useFerias'
import { useOcorrencias, type Ocorrencia, type TipoOcorrencia } from '@/hooks/useOcorrencias'
import { SaldoFerias } from '@/components/ferias/SaldoFerias'
import { FeriasAlert } from '@/components/ferias/FeriasAlert'
import { FeriasForm, type FeriasFormData } from '@/components/ferias/FeriasForm'
import { VenderFeriasForm } from '@/components/ferias/VenderFeriasForm'
import { OcorrenciaForm, type OcorrenciaFormData } from '@/components/ocorrencias/OcorrenciaForm'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viuvo(a)', 'Uniao Estavel']

const PARENTESCOS = [
  { value: 'Cônjuge', label: 'Cônjuge' },
  { value: 'Filho(a)', label: 'Filho(a)' },
  { value: 'Dependente', label: 'Dependente' },
  { value: 'Pai', label: 'Pai' },
  { value: 'Mãe', label: 'Mãe' },
  { value: 'Irmão(ã)', label: 'Irmão(ã)' },
  { value: 'Outro', label: 'Outro' },
]

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

const funcionarioSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatorio'),
  apelido: z.string().optional(),
  codigo: z.string().optional(),
  data_nascimento: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  carteira_trabalho: z.string().optional(),
  cnh: z.string().optional(),
  estado_civil: z.string().optional(),
  tamanho_camiseta: z.string().optional(),
  tamanho_calca: z.string().optional(),
  numero_sapato: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  telefone1_descricao: z.string().optional(),
  telefone1: z.string().optional(),
  telefone2_descricao: z.string().optional(),
  telefone2: z.string().optional(),
  telefone3_descricao: z.string().optional(),
  telefone3: z.string().optional(),
  unidade_id: z.string().optional(),
  setor_id: z.string().optional(),
  funcao_id: z.string().optional(),
  data_admissao: z.string().optional(),
  data_desligamento: z.string().optional(),
  motivo_desligamento: z.string().optional(),
  // Horario
  seg_qui_entrada: z.string().optional(),
  seg_qui_almoco_inicio: z.string().optional(),
  seg_qui_almoco_fim: z.string().optional(),
  seg_qui_saida: z.string().optional(),
  sexta_entrada: z.string().optional(),
  sexta_almoco_inicio: z.string().optional(),
  sexta_almoco_fim: z.string().optional(),
  sexta_saida: z.string().optional(),
  // Familia (salva na tabela "familia")
  familiares: z.array(z.object({
    id: z.string().optional(),
    nome: z.string().min(1, 'Nome obrigatório'),
    parentesco: z.string().min(1, 'Parentesco obrigatório'),
    data_nascimento: z.string().optional(),
  })).optional(),
})

type FuncionarioFormData = z.infer<typeof funcionarioSchema>

type TabKey = 'dados' | 'ferias' | 'ocorrencias'

export default function FuncionarioDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true')
  const [activeTab, setActiveTab] = useState<TabKey>('dados')
  const [funcionario, setFuncionario] = useState<Record<string, unknown> | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  // Track newly added familiar indices for animation
  const [recentlyAdded, setRecentlyAdded] = useState<Set<number>>(new Set())

  // Lookup data
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{
    id: string; titulo: string; unidade_id?: string;
    horario_seg_qui_entrada?: string; horario_seg_qui_saida?: string;
    horario_seg_qui_almoco_inicio?: string; horario_seg_qui_almoco_fim?: string;
    horario_sex_entrada?: string; horario_sex_saida?: string;
    horario_sex_almoco_inicio?: string; horario_sex_almoco_fim?: string;
  }[]>([])
  const [funcoes, setFuncoes] = useState<{ id: string; titulo: string; setor_id?: string; cbo?: string }[]>([])
  const [motivosDesligamento, setMotivosDesligamento] = useState<{ id: string; titulo: string }[]>([])

  const { register, handleSubmit, watch, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
  })

  const { fields: familiaFields, append: addFamiliar, remove: removeFamiliar } = useFieldArray({
    control,
    name: 'familiares',
  })

  const unidadeId = watch('unidade_id')
  const setorId = watch('setor_id')
  const funcaoId = watch('funcao_id')
  const dataDesligamento = watch('data_desligamento')

  const filteredSetores = unidadeId ? setores.filter((s) => s.unidade_id === unidadeId) : setores
  const filteredFuncoes = setorId ? funcoes.filter((f) => f.setor_id === setorId) : funcoes

  // Auto-fill CBO when funcao changes
  useEffect(() => {
    if (funcaoId) {
      const funcao = funcoes.find((f) => f.id === funcaoId)
      if (funcao?.cbo) {
        // CBO is read-only display, no need to set in form
      }
    }
  }, [funcaoId, funcoes])

  const loadFuncionario = useCallback(async () => {
    setLoading(true)
    try {
      const [funcRes, uniRes, setRes, funRes, motivosRes] = await Promise.all([
        supabase.from('funcionarios').select('*').eq('id', id).single(),
        supabase.from('unidades').select('id, titulo').order('titulo'),
        supabase.from('setores').select('id, titulo, unidade_id, horario_seg_qui_entrada, horario_seg_qui_saida, horario_seg_qui_almoco_inicio, horario_seg_qui_almoco_fim, horario_sex_entrada, horario_sex_saida, horario_sex_almoco_inicio, horario_sex_almoco_fim').order('titulo'),
        supabase.from('funcoes').select('id, titulo, setor_id, cbo').order('titulo'),
        supabase.from('motivos_desligamento').select('id, titulo').order('titulo'),
      ])

      if (funcRes.error) {
        toast.error('Funcionario nao encontrado')
        router.push('/funcionarios')
        return
      }

      const f = funcRes.data
      setFuncionario(f)
      setFotoPreview(f.foto_url || null)
      setUnidades(uniRes.data || [])
      setSetores(setRes.data || [])
      setFuncoes(funRes.data || [])
      if (!motivosRes.error) setMotivosDesligamento(motivosRes.data || [])

      // Carregar familiares da tabela "familia"
      let familiares: { id?: string; nome: string; parentesco: string; data_nascimento?: string }[] = []
      const famRes = await supabase.from('familia').select('id, nome, parentesco, data_nascimento').eq('funcionario_id', id).order('nome')
      if (!famRes.error && famRes.data) {
        familiares = famRes.data.map((fm: Record<string, string>) => ({
          id: fm.id,
          nome: fm.nome || '',
          parentesco: fm.parentesco || '',
          data_nascimento: fm.data_nascimento || '',
        }))
      }

      reset({
        nome: f.nome_completo || f.nome || '',
        apelido: f.apelido || '',
        codigo: f.codigo || '',
        data_nascimento: f.data_nascimento || '',
        cpf: f.cpf || '',
        rg: f.rg || '',
        carteira_trabalho: f.carteira_trabalho || '',
        cnh: f.cnh || '',
        estado_civil: f.estado_civil || '',
        tamanho_camiseta: f.tamanho_camiseta || '',
        tamanho_calca: f.tamanho_calca || '',
        numero_sapato: f.numero_sapato || '',
        endereco: f.endereco || '',
        cidade: f.cidade || '',
        estado: f.estado || '',
        cep: f.cep || '',
        telefone1_descricao: f.telefone1_descricao || '',
        telefone1: f.telefone1_numero || f.telefone1 || '',
        telefone2_descricao: f.telefone2_descricao || '',
        telefone2: f.telefone2_numero || f.telefone2 || '',
        telefone3_descricao: f.telefone3_descricao || '',
        telefone3: f.telefone3_numero || f.telefone3 || '',
        unidade_id: f.unidade_id || '',
        setor_id: f.setor_id || '',
        funcao_id: f.funcao_id || '',
        data_admissao: f.data_admissao || '',
        data_desligamento: f.data_desligamento || '',
        motivo_desligamento: f.motivo_desligamento || '',
        seg_qui_entrada: f.horario_seg_qui_entrada || f.seg_qui_entrada || '',
        seg_qui_almoco_inicio: f.horario_seg_qui_almoco_inicio || f.seg_qui_almoco_inicio || '',
        seg_qui_almoco_fim: f.horario_seg_qui_almoco_fim || f.seg_qui_almoco_fim || '',
        seg_qui_saida: f.horario_seg_qui_saida || f.seg_qui_saida || '',
        sexta_entrada: f.horario_sex_entrada || f.sexta_entrada || '',
        sexta_almoco_inicio: f.horario_sex_almoco_inicio || f.sexta_almoco_inicio || '',
        sexta_almoco_fim: f.horario_sex_almoco_fim || f.sexta_almoco_fim || '',
        sexta_saida: f.horario_sex_saida || f.sexta_saida || '',
        familiares,
      })
    } catch (err) {
      console.error('Erro:', err)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [id, supabase, router, reset])

  useEffect(() => {
    loadFuncionario()
  }, [loadFuncionario])

  async function onSubmit(data: FuncionarioFormData) {
    try {
      // Upload photo if changed
      let fotoUrl = funcionario?.foto_url as string | undefined
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const path = `fotos/${id}.${ext}`
        // Remove existing file first to avoid RLS insert conflicts
        await supabase.storage.from('arquivos-rh').remove([path])
        const { error: uploadError } = await supabase.storage
          .from('arquivos-rh')
          .upload(path, fotoFile, { upsert: true, cacheControl: '3600' })
        if (uploadError) {
          // Fallback: try with a timestamped path
          const tsPath = `fotos/${id}_${Date.now()}.${ext}`
          const { error: retryError } = await supabase.storage
            .from('arquivos-rh')
            .upload(tsPath, fotoFile, { cacheControl: '3600' })
          if (retryError) {
            toast.error('Erro no upload da foto: ' + retryError.message)
          } else {
            const { data: urlData } = supabase.storage.from('arquivos-rh').getPublicUrl(tsPath)
            fotoUrl = urlData.publicUrl
          }
        } else {
          const { data: urlData } = supabase.storage.from('arquivos-rh').getPublicUrl(path)
          fotoUrl = urlData.publicUrl
        }
      }

      const { familiares, nome, apelido, ...restData } = data
      const basePayload: Record<string, unknown> = {
        nome_completo: nome,
        apelido: apelido || null,
        foto_url: fotoUrl || null,
        codigo: restData.codigo || null,
        data_nascimento: restData.data_nascimento || null,
        cpf: restData.cpf || null,
        rg: restData.rg || null,
        carteira_trabalho: restData.carteira_trabalho || null,
        cnh: restData.cnh || null,
        estado_civil: restData.estado_civil || null,
        tamanho_camiseta: restData.tamanho_camiseta || null,
        tamanho_calca: restData.tamanho_calca || null,
        numero_sapato: restData.numero_sapato || null,
        endereco: restData.endereco || null,
        cidade: restData.cidade || null,
        estado: restData.estado || null,
        cep: restData.cep || null,
        telefone1_descricao: restData.telefone1_descricao || null,
        telefone1_numero: restData.telefone1 || null,
        telefone2_descricao: restData.telefone2_descricao || null,
        telefone2_numero: restData.telefone2 || null,
        telefone3_descricao: restData.telefone3_descricao || null,
        telefone3_numero: restData.telefone3 || null,
        unidade_id: restData.unidade_id || null,
        setor_id: restData.setor_id || null,
        funcao_id: restData.funcao_id || null,
        data_admissao: restData.data_admissao || null,
        data_desligamento: restData.data_desligamento || null,
        motivo_desligamento: restData.data_desligamento ? restData.motivo_desligamento : null,
        horario_seg_qui_entrada: restData.seg_qui_entrada || null,
        horario_seg_qui_almoco_inicio: restData.seg_qui_almoco_inicio || null,
        horario_seg_qui_almoco_fim: restData.seg_qui_almoco_fim || null,
        horario_seg_qui_saida: restData.seg_qui_saida || null,
        horario_sex_entrada: restData.sexta_entrada || null,
        horario_sex_almoco_inicio: restData.sexta_almoco_inicio || null,
        horario_sex_almoco_fim: restData.sexta_almoco_fim || null,
        horario_sex_saida: restData.sexta_saida || null,
      }

      const { error } = await supabase.from('funcionarios').update(basePayload).eq('id', id)
      if (error) {
        toast.error('Erro ao salvar: ' + error.message)
        return
      }

      // Salvar familiares na tabela "familia"
      if (familiares !== undefined) {
        // Remover todos os familiares existentes e reinserir
        await supabase.from('familia').delete().eq('funcionario_id', id)
        if (familiares.length > 0) {
          const { error: famError } = await supabase.from('familia').insert(
            familiares.map((fm) => ({
              funcionario_id: id,
              nome: fm.nome,
              parentesco: fm.parentesco,
              data_nascimento: fm.data_nascimento || null,
            }))
          )
          if (famError) {
            toast.error('Erro ao salvar familiares: ' + famError.message)
            return
          }
        }
      }

      toast.success('Dados salvos com sucesso')
      setEditing(false)
      loadFuncionario()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      toast.error('Erro ao salvar dados')
    }
  }

  function handleAddFamiliar() {
    const currentFamiliares = watch('familiares') || []
    // Check if the last added familiar has a name filled (basic validation)
    addFamiliar({ nome: '', parentesco: '', data_nascimento: '' })
    const newIndex = currentFamiliares.length
    setRecentlyAdded((prev) => {
      const next = new Set(prev)
      next.add(newIndex)
      return next
    })
    // Clear highlight after animation
    setTimeout(() => {
      setRecentlyAdded((prev) => {
        const next = new Set(prev)
        next.delete(newIndex)
        return next
      })
    }, 2000)
  }

  function getTempoEmpresa() {
    if (!funcionario?.data_admissao) return null
    const admissao = new Date((funcionario.data_admissao as string) + 'T00:00:00')
    const ref = funcionario.data_desligamento
      ? new Date((funcionario.data_desligamento as string) + 'T00:00:00')
      : new Date()
    const anos = differenceInYears(ref, admissao)
    const meses = differenceInMonths(ref, admissao) % 12
    if (anos > 0) return `${anos} ano${anos > 1 ? 's' : ''} e ${meses} mes${meses !== 1 ? 'es' : ''}`
    return `${meses} mes${meses !== 1 ? 'es' : ''}`
  }

  function getCBO() {
    const fId = watch('funcao_id') || (funcionario?.funcao_id as string)
    const funcao = funcoes.find((f) => f.id === fId)
    return funcao?.cbo || '-'
  }

  function getWeeklyHours(): number | null {
    const sqe = watch('seg_qui_entrada')
    const sqs = watch('seg_qui_saida')
    const sqai = watch('seg_qui_almoco_inicio')
    const sqaf = watch('seg_qui_almoco_fim')
    const sxe = watch('sexta_entrada')
    const sxs = watch('sexta_saida')
    const sxai = watch('sexta_almoco_inicio')
    const sxaf = watch('sexta_almoco_fim')

    function timeToMinutes(t?: string): number | null {
      if (!t) return null
      const parts = t.split(':')
      if (parts.length < 2) return null
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
    }

    let total = 0
    let hasAny = false

    const me = timeToMinutes(sqe), ms = timeToMinutes(sqs)
    const mai = timeToMinutes(sqai), maf = timeToMinutes(sqaf)
    if (me != null && ms != null) {
      hasAny = true
      let daily = ms - me
      if (mai != null && maf != null) daily -= (maf - mai)
      total += daily * 4
    }

    const fe = timeToMinutes(sxe), fs = timeToMinutes(sxs)
    const fai = timeToMinutes(sxai), faf = timeToMinutes(sxaf)
    if (fe != null && fs != null) {
      hasAny = true
      let daily = fs - fe
      if (fai != null && faf != null) daily -= (faf - fai)
      total += daily
    }

    if (!hasAny) return null
    return Math.round((total / 60) * 10) / 10
  }

  function getSetorExpediente() {
    const sId = watch('setor_id')
    if (!sId) return null
    const setor = setores.find((s) => s.id === sId)
    if (!setor) return null
    return setor
  }

  function applySetorSchedule() {
    const setor = getSetorExpediente()
    if (!setor) return
    // Check if the sector actually has schedule data
    if (!setor.horario_seg_qui_entrada && !setor.horario_sex_entrada) {
      toast.error('Este setor nao tem horario padrao cadastrado')
      return
    }
    setValue('seg_qui_entrada', setor.horario_seg_qui_entrada || '')
    setValue('seg_qui_almoco_inicio', setor.horario_seg_qui_almoco_inicio || '')
    setValue('seg_qui_almoco_fim', setor.horario_seg_qui_almoco_fim || '')
    setValue('seg_qui_saida', setor.horario_seg_qui_saida || '')
    setValue('sexta_entrada', setor.horario_sex_entrada || '')
    setValue('sexta_almoco_inicio', setor.horario_sex_almoco_inicio || '')
    setValue('sexta_almoco_fim', setor.horario_sex_almoco_fim || '')
    setValue('sexta_saida', setor.horario_sex_saida || '')
    toast.success('Horario do setor aplicado')
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageContainer>
    )
  }

  if (!funcionario) return null

  const tempoEmpresa = getTempoEmpresa()
  const displayApelido = funcionario.apelido as string | undefined

  return (
    <PageContainer>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Back + Actions */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.push('/funcionarios')}
            className="flex items-center gap-2 text-cinza-estrutural hover:text-cinza-preto transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button type="button" variant="ghost" onClick={() => { setEditing(false); setFotoFile(null); loadFuncionario() }}>
                  <X size={16} /> Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Save size={16} /> {isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={() => router.push(`/funcionarios/${id}/financeiro`)}>
                  <DollarSign size={16} /> Financeiro
                </Button>
                <Button type="button" onClick={() => setEditing(true)}>
                  <Pencil size={16} /> Editar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Header Card */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div>
              {editing ? (
                <FileUpload
                  preview={fotoPreview}
                  onFileSelect={(file) => {
                    setFotoFile(file)
                    setFotoPreview(URL.createObjectURL(file))
                  }}
                  onRemove={() => {
                    setFotoFile(null)
                    setFotoPreview(null)
                  }}
                />
              ) : (
                <Avatar src={fotoPreview} name={(funcionario.nome_completo || funcionario.nome) as string} size="xl" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-cinza-preto">
                  {(funcionario.nome_completo || funcionario.nome) as string}
                  {displayApelido && (
                    <span className="text-cinza-estrutural font-normal text-base ml-2">({displayApelido})</span>
                  )}
                </h2>
                <Badge variant={(funcionario.status as string) === 'Ativo' ? 'success' : 'neutral'}>
                  {funcionario.status as string}
                </Badge>
              </div>
              <p className="text-cinza-estrutural text-sm">
                {funcionario.codigo ? `Codigo: ${String(funcionario.codigo)}` : ''}
                {funcionario.codigo && funcionario.funcao_id ? ' | ' : ''}
                {funcoes.find((f) => f.id === (funcionario.funcao_id as string))?.titulo ?? ''}
              </p>
              {tempoEmpresa && (
                <p className="text-xs text-cinza-estrutural mt-1 flex items-center gap-1">
                  <Clock size={12} /> Tempo de empresa: {tempoEmpresa}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: 'dados' as TabKey, label: 'Dados Pessoais' },
            { key: 'ferias' as TabKey, label: 'Ferias' },
            { key: 'ocorrencias' as TabKey, label: 'Ocorrencias' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === t.key ? 'bg-white text-cinza-preto shadow-sm' : 'text-cinza-estrutural hover:text-cinza-preto'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'dados' && (
          <div className="space-y-6">
            {/* Informacoes Pessoais */}
            <Card>
              <h3 className="text-lg font-bold text-cinza-preto mb-4">Informacoes Pessoais</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label="Nome Completo *" {...register('nome')} error={errors.nome?.message} disabled={!editing} />
                <Input label="Apelido" {...register('apelido')} disabled={!editing} placeholder="Ex: Joaozinho" />
                <Input label="Codigo" {...register('codigo')} disabled={!editing} />
                <Input label="Data de Nascimento" type="date" {...register('data_nascimento')} disabled={!editing} />
                <Input label="CPF" {...register('cpf')} placeholder="000.000.000-00" disabled={!editing} />
                <Input label="RG" {...register('rg')} disabled={!editing} />
                <Input label="Carteira de Trabalho" {...register('carteira_trabalho')} disabled={!editing} />
                <Input label="CNH" {...register('cnh')} disabled={!editing} />
                <Select
                  label="Estado Civil"
                  {...register('estado_civil')}
                  options={ESTADOS_CIVIS.map((e) => ({ value: e, label: e }))}
                  placeholder="Selecione"
                  disabled={!editing}
                />
              </div>
            </Card>

            {/* Vestuario/EPI */}
            <Card>
              <h3 className="text-lg font-bold text-cinza-preto mb-4">Vestuario / EPI</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="Tamanho Camiseta" {...register('tamanho_camiseta')} disabled={!editing} />
                <Input label="Tamanho Calca" {...register('tamanho_calca')} disabled={!editing} />
                <Input label="Numero do Sapato" {...register('numero_sapato')} disabled={!editing} />
              </div>
            </Card>

            {/* Contato */}
            <Card>
              <h3 className="text-lg font-bold text-cinza-preto mb-4">Contato</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-3">
                  <Input label="Endereco" {...register('endereco')} disabled={!editing} />
                </div>
                <Input label="Cidade" {...register('cidade')} disabled={!editing} />
                <Select
                  label="Estado"
                  {...register('estado')}
                  options={UFS.map((uf) => ({ value: uf, label: uf }))}
                  placeholder="Selecione"
                  disabled={!editing}
                />
                <Input label="CEP" {...register('cep')} disabled={!editing} />
              </div>
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="grid grid-cols-3 gap-4">
                    <Input
                      label={`Descricao Telefone ${n}`}
                      {...register(`telefone${n}_descricao` as keyof FuncionarioFormData)}
                      placeholder="Ex: Pessoal"
                      disabled={!editing}
                    />
                    <div className="col-span-2">
                      <Input
                        label={`Telefone ${n}`}
                        value={(watch(`telefone${n}` as keyof FuncionarioFormData) as string) || ''}
                        onChange={(e) => setValue(`telefone${n}` as keyof FuncionarioFormData, formatPhone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        disabled={!editing}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Vinculo Profissional */}
            <Card>
              <h3 className="text-lg font-bold text-cinza-preto mb-4">Vinculo Profissional</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select
                  label="Unidade"
                  {...register('unidade_id')}
                  options={unidades.map((u) => ({ value: u.id, label: u.titulo }))}
                  placeholder="Selecione"
                  disabled={!editing}
                />
                <Select
                  label="Setor"
                  {...register('setor_id')}
                  options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))}
                  placeholder="Selecione"
                  disabled={!editing}
                />
                <Select
                  label="Funcao"
                  {...register('funcao_id')}
                  options={filteredFuncoes.map((f) => ({ value: f.id, label: f.titulo }))}
                  placeholder="Selecione"
                  disabled={!editing}
                />
                <div>
                  <label className="block text-sm font-medium text-cinza-preto mb-1">CBO</label>
                  <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-estrutural bg-gray-50">
                    {getCBO()}
                  </div>
                </div>
                <Input label="Data de Admissao" type="date" {...register('data_admissao')} disabled={!editing} />
                <Input label="Data de Desligamento" type="date" {...register('data_desligamento')} disabled={!editing} />
              </div>
              {dataDesligamento && (
                <div className="mt-4">
                  {motivosDesligamento.length > 0 ? (
                    <Select
                      label="Motivo do Desligamento"
                      {...register('motivo_desligamento')}
                      options={motivosDesligamento.map((m) => ({ value: m.titulo, label: m.titulo }))}
                      placeholder="Selecione o motivo"
                      disabled={!editing}
                    />
                  ) : (
                    <Input label="Motivo do Desligamento" {...register('motivo_desligamento')} disabled={!editing} />
                  )}
                </div>
              )}
            </Card>

            {/* Horario de Expediente */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-cinza-preto">Horario de Expediente</h3>
                  {(() => {
                    const wh = getWeeklyHours()
                    if (wh == null) return null
                    return (
                      <Badge variant="info">
                        <Clock size={12} className="mr-1" />
                        {wh.toString().replace('.', ',')}h Semanais
                      </Badge>
                    )
                  })()}
                </div>
                {editing && setorId && (
                  <Button type="button" variant="ghost" size="sm" onClick={applySetorSchedule}>
                    <Building2 size={14} />
                    Horario Padrao do Setor
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-cinza-estrutural mb-3">Segunda a Quinta</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Entrada" type="time" {...register('seg_qui_entrada')} disabled={!editing} />
                    <Input label="Inicio Almoco" type="time" {...register('seg_qui_almoco_inicio')} disabled={!editing} />
                    <Input label="Fim Almoco" type="time" {...register('seg_qui_almoco_fim')} disabled={!editing} />
                    <Input label="Saida" type="time" {...register('seg_qui_saida')} disabled={!editing} />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-cinza-estrutural mb-3">Sexta-feira</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Entrada" type="time" {...register('sexta_entrada')} disabled={!editing} />
                    <Input label="Inicio Almoco" type="time" {...register('sexta_almoco_inicio')} disabled={!editing} />
                    <Input label="Fim Almoco" type="time" {...register('sexta_almoco_fim')} disabled={!editing} />
                    <Input label="Saida" type="time" {...register('sexta_saida')} disabled={!editing} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Familia / Dependentes */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cinza-preto">Familia / Dependentes</h3>
                {editing && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleAddFamiliar}>
                    <Plus size={14} /> Adicionar Familiar
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {familiaFields.length === 0 ? (
                  <p className="text-sm text-cinza-estrutural">Nenhum familiar cadastrado</p>
                ) : (
                  familiaFields.map((field, index) => (
                    <div
                      key={field.id}
                      className={`flex items-end gap-3 transition-all duration-500 ${
                        recentlyAdded.has(index) ? 'bg-green-50 border border-green-200 rounded-lg p-3' : ''
                      }`}
                    >
                      <div className="w-40">
                        <Select
                          label="Parentesco"
                          placeholder="Selecione"
                          options={PARENTESCOS}
                          {...register(`familiares.${index}.parentesco`)}
                          disabled={!editing}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          label="Nome"
                          {...register(`familiares.${index}.nome`)}
                          disabled={!editing}
                          error={errors.familiares?.[index]?.nome?.message}
                        />
                      </div>
                      <div className="w-48">
                        <Input
                          label="Data de Nascimento"
                          type="date"
                          {...register(`familiares.${index}.data_nascimento`)}
                          disabled={!editing}
                        />
                      </div>
                      {editing && (
                        <button
                          type="button"
                          onClick={() => removeFamiliar(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded mb-0.5"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ferias' && (
          <FeriasTab
            funcionarioId={id}
            funcionarioNome={(funcionario.nome_completo || funcionario.nome) as string}
          />
        )}

        {activeTab === 'ocorrencias' && (
          <OcorrenciasTab
            funcionarioId={id}
            funcionarioNome={(funcionario.nome_completo || funcionario.nome) as string}
          />
        )}
      </form>
    </PageContainer>
  )
}

// =================== FERIAS TAB ===================
function getSaldoStatusBadge(status: string) {
  switch (status) {
    case 'Disponível': return <Badge variant="success">Disponivel</Badge>
    case 'Parcial': return <Badge variant="warning">Parcial</Badge>
    case 'Gozado': return <Badge variant="neutral">Gozado</Badge>
    case 'Vencido': return <Badge variant="danger">Vencido</Badge>
    default: return <Badge>{status}</Badge>
  }
}

function FeriasTab({ funcionarioId, funcionarioNome }: { funcionarioId: string; funcionarioNome: string }) {
  const {
    loadSaldos,
    loadExtrato,
    loadFeriasFuncionario,
    loadSaldosFuncionario,
    createFerias,
    deleteFerias,
    venderFerias,
    updateSaldoDireito,
    loadPeriodosDisponiveis,
  } = useFerias()

  const supabase = createClient()

  const [saldos, setSaldos] = useState<FeriasSaldo[]>([])
  const [ferias, setFerias] = useState<Ferias[]>([])
  const [extrato, setExtrato] = useState<FeriasExtrato[]>([])
  const [loadingFerias, setLoadingFerias] = useState(true)
  const [showFeriasForm, setShowFeriasForm] = useState(false)
  const [showVenderForm, setShowVenderForm] = useState(false)
  const [editingExtrato, setEditingExtrato] = useState<FeriasExtrato | null>(null)

  const loadData = useCallback(async () => {
    setLoadingFerias(true)
    try {
      const [s, f, e] = await Promise.all([
        loadSaldos(funcionarioId),
        loadFeriasFuncionario(funcionarioId),
        loadExtrato(funcionarioId),
      ])
      setSaldos(s)
      setFerias(f)
      setExtrato(e)
    } finally {
      setLoadingFerias(false)
    }
  }, [funcionarioId, loadSaldos, loadExtrato, loadFeriasFuncionario])

  useEffect(() => {
    loadData()
  }, [loadData])

  const proximaFerias = ferias.find((f) => f.status === 'Programada')
  const alertCount = saldos.filter((s) => {
    const vencimento = new Date(s.data_vencimento + 'T00:00:00')
    const now = new Date()
    const diffMs = vencimento.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays > 0 && diffDays <= 120 && s.dias_restantes > 0
  }).length
  const vencidaCount = saldos.filter((s) => s.status === 'Vencido').length

  // Resumo from saldos (same as ferias page)
  const resumo = {
    diasDireito: saldos.reduce((acc, s) => acc + (s.dias_direito || 0), 0),
    diasGozados: saldos.reduce((acc, s) => acc + (s.dias_gozados || 0), 0),
    diasDisponiveis: saldos
      .filter((s) => s.status === 'Disponível' || s.status === 'Parcial')
      .reduce((acc, s) => acc + (s.dias_restantes || 0), 0),
    periodosVencidos: saldos.filter((s) => s.status === 'Vencido').length,
  }

  async function handleCreateFerias(data: FeriasFormData) {
    await createFerias({
      funcionario_id: data.funcionario_id,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      dias: data.dias,
      tipo: data.tipo,
      periodo_aquisitivo_id: data.periodo_aquisitivo_id || undefined,
      abono_pecuniario: data.abono_pecuniario,
      dias_vendidos: data.dias_vendidos,
      observacao: data.observacao || undefined,
    })
    loadData()
  }

  async function handleVender(periodoId: string, dias: number, valor?: number) {
    const ok = await venderFerias(periodoId, dias)
    if (ok && valor && valor > 0) {
      // Create ferias record for the sale
      const { data: saldoData } = await supabase
        .from('ferias_saldo')
        .select('periodo_aquisitivo_inicio, periodo_aquisitivo_fim')
        .eq('id', periodoId)
        .single()

      const hoje = new Date().toISOString().split('T')[0]
      const { data: feriasRec } = await supabase
        .from('ferias')
        .insert({
          funcionario_id: funcionarioId,
          ferias_saldo_id: periodoId,
          data_inicio: hoje,
          data_fim: hoje,
          dias: 0,
          abono_pecuniario: true,
          dias_vendidos: dias,
          status: 'Concluída',
          tipo: 'Individual',
        })
        .select('id')
        .single()

      // Register financial transaction
      const { data: tipoVenda } = await supabase
        .from('tipos_transacao')
        .select('id')
        .eq('titulo', 'Venda de Férias')
        .maybeSingle()

      if (tipoVenda && feriasRec) {
        const inicio = saldoData?.periodo_aquisitivo_inicio || ''
        const fim = saldoData?.periodo_aquisitivo_fim || ''
        await supabase.from('transacoes').insert({
          funcionario_id: funcionarioId,
          tipo_transacao_id: tipoVenda.id,
          valor: valor,
          data: hoje,
          descricao: `Venda de ${dias} dias de ferias — Periodo ${inicio} a ${fim}`,
          origem_tabela: 'ferias',
          origem_id: feriasRec.id,
        })
      }
    }
    if (ok) loadData()
    return ok
  }

  async function handleDeleteFerias(id: string) {
    if (!confirm('Deseja excluir estas ferias?')) return
    await deleteFerias(id)
    loadData()
  }

  async function handleUpdateDireito(saldoId: string, dias: number) {
    const ok = await updateSaldoDireito(saldoId, dias)
    if (ok) loadData()
    return ok
  }

  async function handleSaveExtrato(item: FeriasExtrato, newData: { data?: string; dias?: number }) {
    try {
      if (item.tipo_movimento === 'CRÉDITO' && item.referencia_tabela === 'ferias_saldo') {
        const updatePayload: Record<string, unknown> = {}
        if (newData.dias !== undefined) updatePayload.dias_direito = newData.dias
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('ferias_saldo')
            .update(updatePayload)
            .eq('id', item.referencia_id)
          if (error) throw error
        }
      } else if (item.referencia_tabela === 'ferias') {
        const updatePayload: Record<string, unknown> = {}
        if (newData.dias !== undefined) updatePayload.dias = newData.dias
        if (newData.data !== undefined) updatePayload.data_inicio = newData.data
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('ferias')
            .update(updatePayload)
            .eq('id', item.referencia_id)
          if (error) throw error
        }
      } else if (item.referencia_tabela === 'ocorrencias') {
        const updatePayload: Record<string, unknown> = {}
        if (newData.dias !== undefined) updatePayload.dias = newData.dias
        if (newData.data !== undefined) updatePayload.data_inicio = newData.data
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('ocorrencias')
            .update(updatePayload)
            .eq('id', item.referencia_id)
          if (error) throw error
        }
      }
      toast.success('Movimentacao atualizada')
      setEditingExtrato(null)
      loadData()
    } catch (err) {
      console.error('Erro ao editar extrato:', err)
      toast.error('Erro ao editar movimentacao')
    }
  }

  if (loadingFerias) {
    return (
      <Card>
        <div className="space-y-4">
          <div className="h-20 bg-gray-100 rounded animate-pulse" />
          <div className="h-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mini Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SaldoFerias saldos={saldos} onUpdateDireito={handleUpdateDireito} />
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-cinza-estrutural mb-1">Proximas Ferias</p>
          {proximaFerias ? (
            <>
              <p className="text-lg font-bold text-cinza-preto">
                {safeFormat(proximaFerias.data_inicio)}
              </p>
              <p className="text-xs text-cinza-estrutural mt-1">
                ate {safeFormat(proximaFerias.data_fim)} ({proximaFerias.dias} dias)
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-cinza-preto">-</p>
              <p className="text-xs text-cinza-estrutural mt-1">Nenhuma programada</p>
            </>
          )}
        </div>
        <FeriasAlert alertCount={alertCount} vencidaCount={vencidaCount} />
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
            <Calendar size={14} />
            Dias de Direito
          </div>
          <div className="text-2xl font-bold text-blue-700">{resumo.diasDireito}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
            <TrendingDown size={14} />
            Dias Gozados
          </div>
          <div className="text-2xl font-bold text-green-700">{resumo.diasGozados}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
          <div className="flex items-center gap-2 text-sm text-emerald-600 mb-1">
            <TrendingUp size={14} />
            Dias Disponiveis
          </div>
          <div className="text-2xl font-bold text-emerald-700">{resumo.diasDisponiveis}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
          <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
            <Ban size={14} />
            Periodos Vencidos
          </div>
          <div className="text-2xl font-bold text-red-700">{resumo.periodosVencidos}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="button" onClick={() => setShowFeriasForm(true)}>
          <Plus size={16} /> Adicionar Ferias
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowVenderForm(true)}>
          <DollarSign size={16} /> Vender Ferias
        </Button>
      </div>

      {/* Extrato de Movimentacoes */}
      <Card>
        <h3 className="text-lg font-bold text-cinza-preto mb-4 flex items-center gap-2">
          <FileText size={18} className="text-azul-medio" />
          Extrato de Movimentacoes
        </h3>
        {extrato.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="Nenhuma movimentacao"
            description="Nenhum registro de ferias encontrado"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Status</TableHead>
            </TableHeader>
            <TableBody>
              {extrato.map((e, idx) => (
                <TableRow
                  key={`${e.referencia_id}-${idx}`}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setEditingExtrato(e)}
                >
                  <TableCell>
                    {safeFormat(e.data_movimento)}
                  </TableCell>
                  <TableCell>
                    {e.tipo_movimento === 'CRÉDITO' ? (
                      <Badge variant="success">CREDITO</Badge>
                    ) : (
                      <Badge variant="danger">DEBITO</Badge>
                    )}
                  </TableCell>
                  <TableCell>{e.descricao}</TableCell>
                  <TableCell>
                    <span className={e.dias > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {e.dias > 0 ? `+${e.dias}` : e.dias}
                    </span>
                  </TableCell>
                  <TableCell>
                    {e.tipo_movimento === 'CRÉDITO' && e.saldo_status
                      ? getSaldoStatusBadge(e.saldo_status)
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Historico */}
      <Card>
        <h3 className="text-lg font-bold text-cinza-preto mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-azul-medio" />
          Historico de Ferias
        </h3>
        {ferias.length === 0 ? (
          <EmptyState
            icon={<Calendar size={40} />}
            title="Nenhum registro"
            description="Nenhuma ferias registrada para este funcionario"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Periodo Aquisitivo</TableHead>
              <TableHead>Data Inicio</TableHead>
              <TableHead>Data Fim</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observacao</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableHeader>
            <TableBody>
              {ferias.map((f) => {
                const saldo = saldos.find((s) => s.id === f.periodo_aquisitivo_id)
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      {saldo
                        ? `${safeFormat(saldo.periodo_aquisitivo_inicio, 'dd/MM/yy')} - ${safeFormat(saldo.periodo_aquisitivo_fim, 'dd/MM/yy')}`
                        : '-'}
                    </TableCell>
                    <TableCell>{safeFormat(f.data_inicio)}</TableCell>
                    <TableCell>{safeFormat(f.data_fim)}</TableCell>
                    <TableCell>{f.dias}</TableCell>
                    <TableCell>{f.tipo}</TableCell>
                    <TableCell>
                      <Badge variant={
                        f.status === 'Programada' ? 'info'
                        : f.status === 'Em Andamento' ? 'warning'
                        : f.status === 'Concluida' || f.status === 'Concluída' ? 'success'
                        : 'neutral'
                      }>{f.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{f.observacao || '-'}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleDeleteFerias(f.id)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <FeriasForm
        open={showFeriasForm}
        onClose={() => setShowFeriasForm(false)}
        onSubmit={handleCreateFerias}
        funcionarioId={funcionarioId}
        funcionarioNome={funcionarioNome}
      />
      <VenderFeriasForm
        open={showVenderForm}
        onClose={() => setShowVenderForm(false)}
        saldos={saldos}
        onSubmit={handleVender}
      />

      {/* Edit Extrato Modal */}
      {editingExtrato && (
        <EditExtratoModal
          item={editingExtrato}
          onClose={() => setEditingExtrato(null)}
          onSave={handleSaveExtrato}
        />
      )}
    </div>
  )
}

// =================== EDIT EXTRATO MODAL ===================
function EditExtratoModal({
  item,
  onClose,
  onSave,
}: {
  item: FeriasExtrato
  onClose: () => void
  onSave: (item: FeriasExtrato, data: { data?: string; dias?: number }) => Promise<void>
}) {
  const [data, setData] = useState(item.data_movimento || '')
  const [dias, setDias] = useState(Math.abs(item.dias))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(item, { data, dias })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Editar Movimentacao">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p><strong>Tipo:</strong> {item.tipo_movimento}</p>
          <p><strong>Descricao:</strong> {item.descricao}</p>
          <p><strong>Tabela:</strong> {item.referencia_tabela}</p>
        </div>
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <Input
          label="Dias"
          type="number"
          value={dias.toString()}
          onChange={(e) => setDias(parseInt(e.target.value) || 0)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// =================== OCORRENCIAS TAB ===================
function OcorrenciasTab({ funcionarioId, funcionarioNome }: { funcionarioId: string; funcionarioNome: string }) {
  const {
    loadOcorrenciasFuncionario,
    loadTipos,
    createOcorrencia,
    deleteOcorrencia,
  } = useOcorrencias()

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [tipos, setTipos] = useState<TipoOcorrencia[]>([])
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterTipo, setFilterTipo] = useState('')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')

  const loadData = useCallback(async () => {
    setLoadingOcorrencias(true)
    try {
      const [o, t] = await Promise.all([
        loadOcorrenciasFuncionario(funcionarioId),
        loadTipos(),
      ])
      setOcorrencias(o)
      setTipos(t)
    } finally {
      setLoadingOcorrencias(false)
    }
  }, [funcionarioId, loadOcorrenciasFuncionario, loadTipos])

  useEffect(() => {
    loadData()
  }, [loadData])

  let filtered = ocorrencias
  if (filterTipo) {
    filtered = filtered.filter((o) => o.tipo_ocorrencia_id === filterTipo)
  }
  if (filterDataInicio) {
    filtered = filtered.filter((o) => o.data_inicio >= filterDataInicio)
  }
  if (filterDataFim) {
    filtered = filtered.filter((o) => o.data_inicio <= filterDataFim)
  }

  async function handleCreate(data: OcorrenciaFormData) {
    await createOcorrencia({
      funcionario_id: data.funcionario_id,
      tipo_ocorrencia_id: data.tipo_ocorrencia_id,
      descricao: data.descricao || undefined,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim || undefined,
      dias: data.dias,
      valor: data.valor || undefined,
      arquivo_url: data.arquivo_url || undefined,
      observacao: data.observacao || undefined,
    })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir esta ocorrencia?')) return
    await deleteOcorrencia(id)
    loadData()
  }

  if (loadingOcorrencias) {
    return (
      <Card>
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action + Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <Button type="button" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Registrar Ocorrencia
        </Button>
        <Select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          options={[{ value: '', label: 'Todos os tipos' }, ...tipos.map((t) => ({ value: t.id, label: t.titulo }))]}
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDataInicio}
            onChange={(e) => setFilterDataInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-cinza-estrutural text-sm">ate</span>
          <input
            type="date"
            value={filterDataFim}
            onChange={(e) => setFilterDataFim(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      <Card>
        <h3 className="text-lg font-bold text-cinza-preto mb-4 flex items-center gap-2">
          <ClipboardList size={18} className="text-laranja" />
          Ocorrencias
          {filtered.length > 0 && <Badge variant="neutral">{filtered.length}</Badge>}
        </h3>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} />}
            title="Nenhuma ocorrencia"
            description="Nenhuma ocorrencia registrada"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Anexo</TableHead>
              <TableHead>Observacao</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{safeFormat(o.data_inicio)}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: o.tipo_cor || '#888' }}
                    >
                      {o.tipo_titulo}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{o.descricao || '-'}</TableCell>
                  <TableCell>{o.dias}</TableCell>
                  <TableCell>
                    {o.valor ? `R$ ${Number(o.valor).toFixed(2).replace('.', ',')}` : '-'}
                  </TableCell>
                  <TableCell>
                    {o.arquivo_url ? (
                      <a href={o.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-azul-medio hover:text-azul">
                        <ExternalLink size={16} />
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">{o.observacao || '-'}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleDelete(o.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                      <Trash2 size={14} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <OcorrenciaForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        funcionarioId={funcionarioId}
        funcionarioNome={funcionarioNome}
        tipos={tipos}
      />
    </div>
  )
}
