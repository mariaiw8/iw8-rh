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
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Pencil, Save, X, Plus, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, differenceInYears, differenceInMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viuvo(a)', 'Uniao Estavel']

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
  // Familia
  conjuge_nome: z.string().optional(),
  conjuge_nascimento: z.string().optional(),
  filhos: z.array(z.object({
    nome: z.string(),
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

  // Lookup data
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])
  const [funcoes, setFuncoes] = useState<{ id: string; titulo: string; setor_id?: string; cbo?: string }[]>([])

  const { register, handleSubmit, watch, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
  })

  const { fields: filhosFields, append: addFilho, remove: removeFilho } = useFieldArray({
    control,
    name: 'filhos',
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
      const [funcRes, uniRes, setRes, funRes] = await Promise.all([
        supabase.from('funcionarios').select('*').eq('id', id).single(),
        supabase.from('unidades').select('id, titulo').order('titulo'),
        supabase.from('setores').select('id, titulo, unidade_id').order('titulo'),
        supabase.from('funcoes').select('id, titulo, setor_id, cbo').order('titulo'),
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

      // Parse filhos from JSONB or related table
      let filhos: { nome: string; data_nascimento?: string }[] = []
      if (f.filhos && Array.isArray(f.filhos)) {
        filhos = f.filhos
      } else {
        // Try fetching from filhos table
        const filhosRes = await supabase.from('filhos').select('*').eq('funcionario_id', id).order('nome')
        if (!filhosRes.error && filhosRes.data) {
          filhos = filhosRes.data.map((c: Record<string, string>) => ({ nome: c.nome, data_nascimento: c.data_nascimento }))
        }
      }

      reset({
        nome: f.nome_completo || f.nome || '',
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
        telefone1: f.telefone1 || '',
        telefone2_descricao: f.telefone2_descricao || '',
        telefone2: f.telefone2 || '',
        telefone3_descricao: f.telefone3_descricao || '',
        telefone3: f.telefone3 || '',
        unidade_id: f.unidade_id || '',
        setor_id: f.setor_id || '',
        funcao_id: f.funcao_id || '',
        data_admissao: f.data_admissao || '',
        data_desligamento: f.data_desligamento || '',
        motivo_desligamento: f.motivo_desligamento || '',
        seg_qui_entrada: f.seg_qui_entrada || '',
        seg_qui_almoco_inicio: f.seg_qui_almoco_inicio || '',
        seg_qui_almoco_fim: f.seg_qui_almoco_fim || '',
        seg_qui_saida: f.seg_qui_saida || '',
        sexta_entrada: f.sexta_entrada || '',
        sexta_almoco_inicio: f.sexta_almoco_inicio || '',
        sexta_almoco_fim: f.sexta_almoco_fim || '',
        sexta_saida: f.sexta_saida || '',
        conjuge_nome: f.conjuge_nome || '',
        conjuge_nascimento: f.conjuge_nascimento || '',
        filhos,
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
        const { error: uploadError } = await supabase.storage
          .from('arquivos-rh')
          .upload(path, fotoFile, { upsert: true })
        if (uploadError) {
          toast.error('Erro no upload da foto: ' + uploadError.message)
        } else {
          const { data: urlData } = supabase.storage.from('arquivos-rh').getPublicUrl(path)
          fotoUrl = urlData.publicUrl
        }
      }

      const { filhos, nome, ...restData } = data
      const payload = {
        ...restData,
        nome_completo: nome,
        foto_url: fotoUrl || null,
        unidade_id: restData.unidade_id || null,
        setor_id: restData.setor_id || null,
        funcao_id: restData.funcao_id || null,
        data_desligamento: restData.data_desligamento || null,
        motivo_desligamento: restData.data_desligamento ? restData.motivo_desligamento : null,
      }

      const { error } = await supabase.from('funcionarios').update(payload).eq('id', id)
      if (error) {
        toast.error('Erro ao salvar: ' + error.message)
        return
      }

      // Save filhos - try JSONB column first, then separate table
      if (filhos !== undefined) {
        // Try updating filhos as JSONB
        const { error: filhosError } = await supabase.from('funcionarios').update({ filhos }).eq('id', id)
        if (filhosError) {
          // Fallback: use separate table
          await supabase.from('filhos').delete().eq('funcionario_id', id)
          if (filhos.length > 0) {
            await supabase.from('filhos').insert(
              filhos.map((f) => ({ funcionario_id: id, nome: f.nome, data_nascimento: f.data_nascimento || null }))
            )
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
                <Button type="button" variant="ghost" onClick={() => { setEditing(false); loadFuncionario() }}>
                  <X size={16} /> Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Save size={16} /> {isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Editar
              </Button>
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
                <h2 className="text-xl font-bold text-cinza-preto">{(funcionario.nome_completo || funcionario.nome) as string}</h2>
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
                  <Input label="Motivo do Desligamento" {...register('motivo_desligamento')} disabled={!editing} />
                </div>
              )}
            </Card>

            {/* Horario de Expediente */}
            <Card>
              <h3 className="text-lg font-bold text-cinza-preto mb-4">Horario de Expediente</h3>
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

            {/* Familia */}
            <Card>
              <h3 className="text-lg font-bold text-cinza-preto mb-4">Familia</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Nome do Conjuge" {...register('conjuge_nome')} disabled={!editing} />
                  <Input label="Nascimento do Conjuge" type="date" {...register('conjuge_nascimento')} disabled={!editing} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-cinza-estrutural">Filhos</h4>
                    {editing && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => addFilho({ nome: '', data_nascimento: '' })}>
                        <Plus size={14} /> Adicionar Filho(a)
                      </Button>
                    )}
                  </div>
                  {filhosFields.length === 0 ? (
                    <p className="text-sm text-cinza-estrutural">Nenhum filho cadastrado</p>
                  ) : (
                    <div className="space-y-3">
                      {filhosFields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-3">
                          <div className="flex-1">
                            <Input
                              label="Nome"
                              {...register(`filhos.${index}.nome`)}
                              disabled={!editing}
                            />
                          </div>
                          <div className="w-48">
                            <Input
                              label="Data de Nascimento"
                              type="date"
                              {...register(`filhos.${index}.data_nascimento`)}
                              disabled={!editing}
                            />
                          </div>
                          {editing && (
                            <button
                              type="button"
                              onClick={() => removeFilho(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded mb-0.5"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ferias' && (
          <Card>
            <div className="py-12 text-center">
              <p className="text-cinza-estrutural">Modulo de Ferias sera implementado na Etapa 2</p>
            </div>
          </Card>
        )}

        {activeTab === 'ocorrencias' && (
          <Card>
            <div className="py-12 text-center">
              <p className="text-cinza-estrutural">Modulo de Ocorrencias sera implementado na Etapa 2</p>
            </div>
          </Card>
        )}
      </form>
    </PageContainer>
  )
}
