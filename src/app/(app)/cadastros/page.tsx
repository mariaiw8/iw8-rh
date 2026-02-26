'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { createClient } from '@/lib/supabase'
import { SearchInput } from '@/components/ui/SearchInput'
import { Plus, Pencil, Trash2, MapPin, Layers, Briefcase, Clock, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

// === SCHEMAS ===
const unidadeSchema = z.object({
  titulo: z.string().min(1, 'Titulo obrigatorio'),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  telefone: z.string().optional(),
})

const setorSchema = z.object({
  titulo: z.string().min(1, 'Titulo obrigatorio'),
  tipo: z.string().optional(),
  unidade_id: z.string().optional(),
  // Expediente
  horario_seg_qui_entrada: z.string().optional(),
  horario_seg_qui_almoco_inicio: z.string().optional(),
  horario_seg_qui_almoco_fim: z.string().optional(),
  horario_seg_qui_saida: z.string().optional(),
  horario_sex_entrada: z.string().optional(),
  horario_sex_almoco_inicio: z.string().optional(),
  horario_sex_almoco_fim: z.string().optional(),
  horario_sex_saida: z.string().optional(),
})

const funcaoSchema = z.object({
  titulo: z.string().min(1, 'Titulo obrigatorio'),
  cbo: z.string().optional(),
  descricao_cbo: z.string().optional(),
  nivel_id: z.string().optional(),
  responde_a: z.string().optional(),
  setor_id: z.string().min(1, 'Setor obrigatorio'),
})

const nivelSchema = z.object({
  numero: z.string().min(1, 'Numero obrigatorio'),
  descricao: z.string().min(1, 'Descricao obrigatoria'),
})

type UnidadeForm = z.infer<typeof unidadeSchema>
type SetorForm = z.infer<typeof setorSchema>
type FuncaoForm = z.infer<typeof funcaoSchema>
type NivelForm = z.infer<typeof nivelSchema>

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function calcWeeklyHours(data: {
  seg_qui_entrada?: string; seg_qui_saida?: string;
  seg_qui_almoco_inicio?: string; seg_qui_almoco_fim?: string;
  sex_entrada?: string; sex_saida?: string;
  sex_almoco_inicio?: string; sex_almoco_fim?: string;
}): number | null {
  function timeToMinutes(t?: string): number | null {
    if (!t) return null
    const parts = t.split(':')
    if (parts.length < 2) return null
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }

  const sqe = timeToMinutes(data.seg_qui_entrada)
  const sqs = timeToMinutes(data.seg_qui_saida)
  const sqai = timeToMinutes(data.seg_qui_almoco_inicio)
  const sqaf = timeToMinutes(data.seg_qui_almoco_fim)
  const sxe = timeToMinutes(data.sex_entrada)
  const sxs = timeToMinutes(data.sex_saida)
  const sxai = timeToMinutes(data.sex_almoco_inicio)
  const sxaf = timeToMinutes(data.sex_almoco_fim)

  let total = 0
  let hasAny = false

  if (sqe != null && sqs != null) {
    hasAny = true
    let daily = sqs - sqe
    if (sqai != null && sqaf != null) daily -= (sqaf - sqai)
    total += daily * 4
  }

  if (sxe != null && sxs != null) {
    hasAny = true
    let daily = sxs - sxe
    if (sxai != null && sxaf != null) daily -= (sxaf - sxai)
    total += daily
  }

  if (!hasAny) return null
  return Math.round((total / 60) * 10) / 10
}

function formatWeeklyHours(data: Record<string, unknown>): string | null {
  const hours = calcWeeklyHours({
    seg_qui_entrada: data.horario_seg_qui_entrada as string,
    seg_qui_saida: data.horario_seg_qui_saida as string,
    seg_qui_almoco_inicio: data.horario_seg_qui_almoco_inicio as string,
    seg_qui_almoco_fim: data.horario_seg_qui_almoco_fim as string,
    sex_entrada: data.horario_sex_entrada as string,
    sex_saida: data.horario_sex_saida as string,
    sex_almoco_inicio: data.horario_sex_almoco_inicio as string,
    sex_almoco_fim: data.horario_sex_almoco_fim as string,
  })
  if (hours == null) return null
  return `${hours.toString().replace('.', ',')}h Semanais`
}

type Tab = 'unidades' | 'setores' | 'funcoes'

export default function CadastrosPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6"><TableSkeleton /></div>}>
      <CadastrosPage />
    </Suspense>
  )
}

function CadastrosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') as Tab) || 'unidades'
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [unidades, setUnidades] = useState<Record<string, unknown>[]>([])
  const [setores, setSetores] = useState<Record<string, unknown>[]>([])
  const [funcoes, setFuncoes] = useState<Record<string, unknown>[]>([])
  const [niveis, setNiveis] = useState<Record<string, unknown>[]>([])

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Filter states
  const [setorFilterUnidade, setSetorFilterUnidade] = useState('')
  const [setorFilterTipo, setSetorFilterTipo] = useState('')
  const [funcaoFilterSetor, setFuncaoFilterSetor] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [uniRes, setRes, funRes, nivRes] = await Promise.all([
        supabase.from('vw_resumo_unidades').select('*').order('titulo'),
        supabase.from('vw_resumo_setores').select('*').order('titulo'),
        supabase.from('funcoes').select('*, setores(titulo), niveis(numero, descricao)').order('titulo'),
        supabase.from('niveis').select('*').order('numero'),
      ])

      // If views don't exist, fall back to base tables
      if (uniRes.error) {
        const fallback = await supabase.from('unidades').select('*').order('titulo')
        setUnidades(fallback.data || [])
      } else {
        setUnidades(uniRes.data || [])
      }

      if (setRes.error) {
        const fallback = await supabase.from('setores').select('*, unidades(titulo)').order('titulo')
        setSetores(fallback.data || [])
      } else {
        // Merge expediente data from base table into view data
        const baseSetores = await supabase.from('setores').select('id, horario_seg_qui_entrada, horario_seg_qui_saida, horario_seg_qui_almoco_inicio, horario_seg_qui_almoco_fim, horario_sex_entrada, horario_sex_saida, horario_sex_almoco_inicio, horario_sex_almoco_fim')
        if (!baseSetores.error && baseSetores.data) {
          const expedienteMap = new Map(baseSetores.data.map((s: Record<string, unknown>) => [s.id, s]))
          const merged = (setRes.data || []).map((s: Record<string, unknown>) => ({
            ...s,
            ...(expedienteMap.get(s.id as string) || {}),
          }))
          setSetores(merged)
        } else {
          setSetores(setRes.data || [])
        }
      }

      if (funRes.error) {
        const fallback = await supabase.from('funcoes').select('*, setores(titulo)').order('titulo')
        setFuncoes(fallback.data || [])
      } else {
        setFuncoes(funRes.data || [])
      }

      // Load niveis (may not exist yet)
      if (!nivRes.error) {
        setNiveis(nivRes.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredSetores = useMemo(() => {
    let result = setores
    if (setorFilterUnidade) {
      result = result.filter((s) => {
        const uid = (s.unidade_id as string) || ''
        return uid === setorFilterUnidade
      })
    }
    if (setorFilterTipo) {
      result = result.filter((s) => (s.tipo as string) === setorFilterTipo)
    }
    return result
  }, [setores, setorFilterUnidade, setorFilterTipo])

  const filteredFuncoes = useMemo(() => {
    if (!funcaoFilterSetor) return funcoes
    return funcoes.filter((f) => (f.setor_id as string) === funcaoFilterSetor)
  }, [funcoes, funcaoFilterSetor])

  function setTab(t: Tab) {
    router.push(`/cadastros?tab=${t}`)
  }

  function openNew() {
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(id: string) {
    setEditingId(id)
    setModalOpen(true)
  }

  async function handleDelete(table: string, id: string) {
    if (!confirm('Tem certeza que deseja excluir?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
    } else {
      toast.success('Registro excluido')
      loadData()
    }
  }

  return (
    <PageContainer>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'unidades' as Tab, label: 'Unidades', icon: <MapPin size={16} /> },
          { key: 'setores' as Tab, label: 'Setores', icon: <Layers size={16} /> },
          { key: 'funcoes' as Tab, label: 'Funcoes', icon: <Briefcase size={16} /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key ? 'bg-white text-cinza-preto shadow-sm' : 'text-cinza-estrutural hover:text-cinza-preto'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-cinza-preto">
            {tab === 'unidades' && 'Unidades'}
            {tab === 'setores' && 'Setores'}
            {tab === 'funcoes' && 'Funcoes'}
          </h3>
          <Button onClick={openNew} size="sm">
            <Plus size={16} />
            {tab === 'unidades' && 'Nova Unidade'}
            {tab === 'setores' && 'Novo Setor'}
            {tab === 'funcoes' && 'Nova Funcao'}
          </Button>
        </div>

        {/* Filters */}
        {tab === 'setores' && (
          <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
            <Filter size={16} className="text-cinza-estrutural" />
            <select
              value={setorFilterUnidade}
              onChange={(e) => setSetorFilterUnidade(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-cinza-preto bg-white focus:outline-none focus:ring-2 focus:ring-laranja"
            >
              <option value="">Todas as Unidades</option>
              {unidades.map((u) => (
                <option key={u.id as string} value={u.id as string}>{u.titulo as string}</option>
              ))}
            </select>
            <select
              value={setorFilterTipo}
              onChange={(e) => setSetorFilterTipo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-cinza-preto bg-white focus:outline-none focus:ring-2 focus:ring-laranja"
            >
              <option value="">Todos os Tipos</option>
              <option value="Escritorio">Escritorio</option>
              <option value="Producao">Producao</option>
            </select>
            {(setorFilterUnidade || setorFilterTipo) && (
              <button
                onClick={() => { setSetorFilterUnidade(''); setSetorFilterTipo('') }}
                className="text-xs text-cinza-estrutural hover:text-cinza-preto underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {tab === 'funcoes' && (
          <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
            <Filter size={16} className="text-cinza-estrutural" />
            <select
              value={funcaoFilterSetor}
              onChange={(e) => setFuncaoFilterSetor(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-cinza-preto bg-white focus:outline-none focus:ring-2 focus:ring-laranja"
            >
              <option value="">Todos os Setores</option>
              {setores.map((s) => (
                <option key={s.id as string} value={s.id as string}>{s.titulo as string}</option>
              ))}
            </select>
            {funcaoFilterSetor && (
              <button
                onClick={() => setFuncaoFilterSetor('')}
                className="text-xs text-cinza-estrutural hover:text-cinza-preto underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}

        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            {tab === 'unidades' && (
              <UnidadesTable data={unidades} onEdit={openEdit} onDelete={(id) => handleDelete('unidades', id)} />
            )}
            {tab === 'setores' && (
              <SetoresTable data={filteredSetores} onEdit={openEdit} onDelete={(id) => handleDelete('setores', id)} />
            )}
            {tab === 'funcoes' && (
              <FuncoesTable data={filteredFuncoes} allFuncoes={funcoes} onEdit={openEdit} onDelete={(id) => handleDelete('funcoes', id)} />
            )}
          </>
        )}
      </Card>

      {/* Modals */}
      {tab === 'unidades' && (
        <UnidadeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editingId={editingId}
          supabase={supabase}
          onSaved={() => { setModalOpen(false); loadData() }}
          unidades={unidades}
        />
      )}
      {tab === 'setores' && (
        <SetorModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editingId={editingId}
          supabase={supabase}
          onSaved={() => { setModalOpen(false); loadData() }}
          unidades={unidades}
          setores={setores}
        />
      )}
      {tab === 'funcoes' && (
        <FuncaoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editingId={editingId}
          supabase={supabase}
          onSaved={() => { setModalOpen(false); loadData() }}
          setores={setores}
          funcoes={funcoes}
          niveis={niveis}
        />
      )}
    </PageContainer>
  )
}

// === TABLE COMPONENTS ===

function UnidadesTable({ data, onEdit, onDelete }: { data: Record<string, unknown>[]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  if (data.length === 0) return <EmptyState title="Nenhuma unidade cadastrada" description="Clique em 'Nova Unidade' para criar" />
  return (
    <Table>
      <TableHeader>
        <TableHead>Titulo</TableHead>
        <TableHead>CNPJ</TableHead>
        <TableHead>Cidade/Estado</TableHead>
        <TableHead>Funcionarios</TableHead>
        <TableHead className="w-24">Acoes</TableHead>
      </TableHeader>
      <TableBody>
        {data.map((u) => (
          <TableRow key={u.id as string}>
            <TableCell className="font-medium">{u.titulo as string}</TableCell>
            <TableCell>{(u.cnpj as string) || '-'}</TableCell>
            <TableCell>{[u.cidade, u.estado].filter(Boolean).join('/') || '-'}</TableCell>
            <TableCell>{(u.total_funcionarios as number) ?? (u.num_funcionarios as number) ?? '-'}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <button onClick={() => onEdit(u.id as string)} className="p-1.5 text-azul-medio hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                <button onClick={() => onDelete(u.id as string)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SetoresTable({ data, onEdit, onDelete }: { data: Record<string, unknown>[]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  if (data.length === 0) return <EmptyState title="Nenhum setor cadastrado" description="Clique em 'Novo Setor' para criar" />
  return (
    <Table>
      <TableHeader>
        <TableHead>Titulo</TableHead>
        <TableHead>Tipo</TableHead>
        <TableHead>Unidade</TableHead>
        <TableHead>Expediente</TableHead>
        <TableHead>Funcionarios</TableHead>
        <TableHead className="w-24">Acoes</TableHead>
      </TableHeader>
      <TableBody>
        {data.map((s) => {
          const weeklyHours = formatWeeklyHours(s)
          return (
            <TableRow key={s.id as string}>
              <TableCell className="font-medium">{s.titulo as string}</TableCell>
              <TableCell>
                {s.tipo ? (
                  <Badge variant={(s.tipo as string) === 'Producao' ? 'warning' : 'info'}>
                    {s.tipo as string}
                  </Badge>
                ) : '-'}
              </TableCell>
              <TableCell>{(s.unidade_titulo as string) || ((s.unidades as Record<string, string>)?.titulo) || '-'}</TableCell>
              <TableCell>
                {weeklyHours ? (
                  <span className="flex items-center gap-1 text-sm text-cinza-preto">
                    <Clock size={14} className="text-laranja" />
                    {weeklyHours}
                  </span>
                ) : (
                  <span className="text-cinza-estrutural text-sm">-</span>
                )}
              </TableCell>
              <TableCell>{(s.total_funcionarios as number) ?? (s.num_funcionarios as number) ?? '-'}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(s.id as string)} className="p-1.5 text-azul-medio hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                  <button onClick={() => onDelete(s.id as string)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function FuncoesTable({ data, allFuncoes, onEdit, onDelete }: { data: Record<string, unknown>[]; allFuncoes: Record<string, unknown>[]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  if (data.length === 0) return <EmptyState title="Nenhuma funcao cadastrada" description="Clique em 'Nova Funcao' para criar" />

  function getNivelDisplay(f: Record<string, unknown>) {
    const nivel = f.niveis as Record<string, unknown> | null
    if (nivel && nivel.numero != null) return `${nivel.numero} - ${nivel.descricao || ''}`
    return '-'
  }

  function getRespondeA(f: Record<string, unknown>) {
    if (!f.responde_a) return '-'
    const parent = allFuncoes.find((fn) => fn.id === f.responde_a)
    return (parent?.titulo as string) || '-'
  }

  return (
    <Table>
      <TableHeader>
        <TableHead>Titulo</TableHead>
        <TableHead>CBO</TableHead>
        <TableHead>Descricao CBO</TableHead>
        <TableHead>Nivel</TableHead>
        <TableHead>Responde a</TableHead>
        <TableHead>Setor</TableHead>
        <TableHead className="w-24">Acoes</TableHead>
      </TableHeader>
      <TableBody>
        {data.map((f) => (
          <TableRow key={f.id as string}>
            <TableCell className="font-medium">{f.titulo as string}</TableCell>
            <TableCell>{(f.cbo as string) || '-'}</TableCell>
            <TableCell>{(f.descricao_cbo as string) || '-'}</TableCell>
            <TableCell>{getNivelDisplay(f)}</TableCell>
            <TableCell>{getRespondeA(f)}</TableCell>
            <TableCell>{(f.setor_titulo as string) || ((f.setores as Record<string, string>)?.titulo) || '-'}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <button onClick={() => onEdit(f.id as string)} className="p-1.5 text-azul-medio hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                <button onClick={() => onDelete(f.id as string)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// === MODAL COMPONENTS ===

function UnidadeModal({
  open, onClose, editingId, supabase, onSaved, unidades,
}: {
  open: boolean; onClose: () => void; editingId: string | null
  supabase: ReturnType<typeof createClient>; onSaved: () => void
  unidades: Record<string, unknown>[]
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UnidadeForm>({
    resolver: zodResolver(unidadeSchema),
  })

  useEffect(() => {
    if (open) {
      if (editingId) {
        // Fetch full record from unidades table (view may not have all fields)
        supabase.from('unidades').select('*').eq('id', editingId).single().then(({ data }) => {
          if (data) {
            reset({
              titulo: (data.titulo as string) || '',
              cnpj: (data.cnpj as string) || '',
              endereco: (data.endereco as string) || '',
              cidade: (data.cidade as string) || '',
              estado: (data.estado as string) || '',
              cep: (data.cep as string) || '',
              telefone: (data.telefone as string) || '',
            })
          }
        })
      } else {
        reset({ titulo: '', cnpj: '', endereco: '', cidade: '', estado: '', cep: '', telefone: '' })
      }
    }
  }, [open, editingId, supabase, reset])

  async function onSubmit(data: UnidadeForm) {
    const payload = {
      titulo: data.titulo,
      cnpj: data.cnpj || null,
      endereco: data.endereco || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      cep: data.cep || null,
      telefone: data.telefone || null,
    }
    if (editingId) {
      const { error } = await supabase.from('unidades').update(payload).eq('id', editingId)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Unidade atualizada')
    } else {
      const { error } = await supabase.from('unidades').insert(payload)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Unidade criada')
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingId ? 'Editar Unidade' : 'Nova Unidade'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Titulo *" {...register('titulo')} error={errors.titulo?.message} />
        <Input label="CNPJ" {...register('cnpj')} />
        <Input label="Endereco" {...register('endereco')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Cidade" {...register('cidade')} />
          <Select
            label="Estado"
            {...register('estado')}
            options={UFS.map((uf) => ({ value: uf, label: uf }))}
            placeholder="Selecione"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="CEP" {...register('cep')} placeholder="00000-000" />
          <Input
            label="Telefone"
            value={watch('telefone') || ''}
            onChange={(e) => setValue('telefone', formatPhone(e.target.value))}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function SetorModal({
  open, onClose, editingId, supabase, onSaved, unidades, setores,
}: {
  open: boolean; onClose: () => void; editingId: string | null
  supabase: ReturnType<typeof createClient>; onSaved: () => void
  unidades: Record<string, unknown>[]; setores: Record<string, unknown>[]
}) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<SetorForm>({
    resolver: zodResolver(setorSchema),
  })

  const watchedFields = watch()
  const weeklyHours = calcWeeklyHours({
    seg_qui_entrada: watchedFields.horario_seg_qui_entrada,
    seg_qui_saida: watchedFields.horario_seg_qui_saida,
    seg_qui_almoco_inicio: watchedFields.horario_seg_qui_almoco_inicio,
    seg_qui_almoco_fim: watchedFields.horario_seg_qui_almoco_fim,
    sex_entrada: watchedFields.horario_sex_entrada,
    sex_saida: watchedFields.horario_sex_saida,
    sex_almoco_inicio: watchedFields.horario_sex_almoco_inicio,
    sex_almoco_fim: watchedFields.horario_sex_almoco_fim,
  })

  useEffect(() => {
    if (open) {
      if (editingId) {
        supabase.from('setores').select('*').eq('id', editingId).single().then(({ data }) => {
          if (data) {
            reset({
              titulo: (data.titulo as string) || '',
              tipo: (data.tipo as string) || '',
              unidade_id: (data.unidade_id as string) || '',
              horario_seg_qui_entrada: (data.horario_seg_qui_entrada as string) || '',
              horario_seg_qui_almoco_inicio: (data.horario_seg_qui_almoco_inicio as string) || '',
              horario_seg_qui_almoco_fim: (data.horario_seg_qui_almoco_fim as string) || '',
              horario_seg_qui_saida: (data.horario_seg_qui_saida as string) || '',
              horario_sex_entrada: (data.horario_sex_entrada as string) || '',
              horario_sex_almoco_inicio: (data.horario_sex_almoco_inicio as string) || '',
              horario_sex_almoco_fim: (data.horario_sex_almoco_fim as string) || '',
              horario_sex_saida: (data.horario_sex_saida as string) || '',
            })
          }
        })
      } else {
        reset({
          titulo: '', tipo: '', unidade_id: '',
          horario_seg_qui_entrada: '', horario_seg_qui_almoco_inicio: '',
          horario_seg_qui_almoco_fim: '', horario_seg_qui_saida: '',
          horario_sex_entrada: '', horario_sex_almoco_inicio: '',
          horario_sex_almoco_fim: '', horario_sex_saida: '',
        })
      }
    }
  }, [open, editingId, supabase, reset])

  async function onSubmit(data: SetorForm) {
    const payload: Record<string, unknown> = {
      titulo: data.titulo,
      unidade_id: data.unidade_id || null,
      horario_seg_qui_entrada: data.horario_seg_qui_entrada || null,
      horario_seg_qui_almoco_inicio: data.horario_seg_qui_almoco_inicio || null,
      horario_seg_qui_almoco_fim: data.horario_seg_qui_almoco_fim || null,
      horario_seg_qui_saida: data.horario_seg_qui_saida || null,
      horario_sex_entrada: data.horario_sex_entrada || null,
      horario_sex_almoco_inicio: data.horario_sex_almoco_inicio || null,
      horario_sex_almoco_fim: data.horario_sex_almoco_fim || null,
      horario_sex_saida: data.horario_sex_saida || null,
    }
    if (data.tipo && data.tipo.trim() !== '') {
      payload.tipo = data.tipo
    } else {
      payload.tipo = null
    }

    if (editingId) {
      const { error } = await supabase.from('setores').update(payload).eq('id', editingId)
      if (error) {
        // If horario columns don't exist yet, try without them
        if (error.message.includes('horario_')) {
          const fallbackPayload: Record<string, unknown> = {
            titulo: data.titulo,
            unidade_id: data.unidade_id || null,
            tipo: payload.tipo,
          }
          const { error: retryError } = await supabase.from('setores').update(fallbackPayload).eq('id', editingId)
          if (retryError) { toast.error('Erro: ' + retryError.message); return }
          toast.success('Setor atualizado (execute o SQL para habilitar expediente)')
        } else {
          toast.error('Erro: ' + error.message); return
        }
      } else {
        toast.success('Setor atualizado')
      }
    } else {
      const { error } = await supabase.from('setores').insert(payload)
      if (error) {
        if (error.message.includes('setores_tipo_check') || error.message.includes('horario_')) {
          const fallbackPayload: Record<string, unknown> = {
            titulo: data.titulo,
            unidade_id: data.unidade_id || null,
          }
          if (!error.message.includes('setores_tipo_check') && payload.tipo) {
            fallbackPayload.tipo = payload.tipo
          }
          const { error: retryError } = await supabase.from('setores').insert(fallbackPayload)
          if (retryError) { toast.error('Erro: ' + retryError.message); return }
          toast.success('Setor criado')
        } else {
          toast.error('Erro: ' + error.message)
          return
        }
      } else {
        toast.success('Setor criado')
      }
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingId ? 'Editar Setor' : 'Novo Setor'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Titulo *" {...register('titulo')} error={errors.titulo?.message} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tipo"
            {...register('tipo')}
            options={[
              { value: 'Escritorio', label: 'Escritorio' },
              { value: 'Producao', label: 'Producao' },
            ]}
            placeholder="Selecione"
          />
          <Select
            label="Unidade"
            {...register('unidade_id')}
            options={unidades.map((u) => ({ value: u.id as string, label: u.titulo as string }))}
            placeholder="Selecione"
          />
        </div>

        {/* Expediente */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-cinza-preto flex items-center gap-2">
              <Clock size={16} className="text-laranja" />
              Expediente
            </h4>
            {weeklyHours != null && (
              <Badge variant="info">{weeklyHours.toString().replace('.', ',')}h Semanais</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-cinza-estrutural mb-2">Segunda a Quinta</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Entrada" type="time" {...register('horario_seg_qui_entrada')} />
                <Input label="Inicio Almoco" type="time" {...register('horario_seg_qui_almoco_inicio')} />
                <Input label="Fim Almoco" type="time" {...register('horario_seg_qui_almoco_fim')} />
                <Input label="Saida" type="time" {...register('horario_seg_qui_saida')} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-cinza-estrutural mb-2">Sexta-feira</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Entrada" type="time" {...register('horario_sex_entrada')} />
                <Input label="Inicio Almoco" type="time" {...register('horario_sex_almoco_inicio')} />
                <Input label="Fim Almoco" type="time" {...register('horario_sex_almoco_fim')} />
                <Input label="Saida" type="time" {...register('horario_sex_saida')} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function FuncaoModal({
  open, onClose, editingId, supabase, onSaved, setores, funcoes, niveis,
}: {
  open: boolean; onClose: () => void; editingId: string | null
  supabase: ReturnType<typeof createClient>; onSaved: () => void
  setores: Record<string, unknown>[]; funcoes: Record<string, unknown>[]
  niveis: Record<string, unknown>[]
}) {
  const [showNivelForm, setShowNivelForm] = useState(false)
  const [localNiveis, setLocalNiveis] = useState(niveis)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FuncaoForm>({
    resolver: zodResolver(funcaoSchema),
  })

  const nivelForm = useForm<NivelForm>({
    resolver: zodResolver(nivelSchema),
  })

  useEffect(() => {
    setLocalNiveis(niveis)
  }, [niveis])

  useEffect(() => {
    if (open) {
      setShowNivelForm(false)
      if (editingId) {
        // Fetch full record from funcoes table
        supabase.from('funcoes').select('*').eq('id', editingId).single().then(({ data }) => {
          if (data) {
            reset({
              titulo: (data.titulo as string) || '',
              cbo: (data.cbo as string) || '',
              descricao_cbo: (data.descricao_cbo as string) || '',
              nivel_id: (data.nivel_id as string) || '',
              responde_a: (data.responde_a as string) || '',
              setor_id: (data.setor_id as string) || '',
            })
          }
        })
      } else {
        reset({ titulo: '', cbo: '', descricao_cbo: '', nivel_id: '', responde_a: '', setor_id: '' })
      }
    }
  }, [open, editingId, supabase, reset])

  async function onSubmit(data: FuncaoForm) {
    const payload: Record<string, unknown> = {
      titulo: data.titulo,
      cbo: data.cbo || null,
      descricao_cbo: data.descricao_cbo || null,
      nivel_id: data.nivel_id || null,
      responde_a: data.responde_a || null,
      setor_id: data.setor_id,
    }

    if (editingId) {
      const { error } = await supabase.from('funcoes').update(payload).eq('id', editingId)
      if (error) {
        // If new columns don't exist yet, try without them
        if (error.message.includes('descricao_cbo') || error.message.includes('nivel_id') || error.message.includes('responde_a')) {
          const fallbackPayload: Record<string, unknown> = { titulo: data.titulo, cbo: data.cbo || null, setor_id: data.setor_id }
          if (!error.message.includes('descricao_cbo')) fallbackPayload.descricao_cbo = data.descricao_cbo || null
          if (!error.message.includes('nivel_id')) fallbackPayload.nivel_id = data.nivel_id || null
          if (!error.message.includes('responde_a')) fallbackPayload.responde_a = data.responde_a || null
          const { error: retryError } = await supabase.from('funcoes').update(fallbackPayload).eq('id', editingId)
          if (retryError) { toast.error('Erro: ' + retryError.message); return }
        } else {
          toast.error('Erro: ' + error.message); return
        }
      }
      toast.success('Funcao atualizada')
    } else {
      const { error } = await supabase.from('funcoes').insert(payload)
      if (error) {
        if (error.message.includes('descricao_cbo') || error.message.includes('nivel_id') || error.message.includes('responde_a')) {
          const fallbackPayload: Record<string, unknown> = { titulo: data.titulo, cbo: data.cbo || null, setor_id: data.setor_id }
          const { error: retryError } = await supabase.from('funcoes').insert(fallbackPayload)
          if (retryError) { toast.error('Erro: ' + retryError.message); return }
        } else {
          toast.error('Erro: ' + error.message); return
        }
      }
      toast.success('Funcao criada')
    }
    onSaved()
  }

  async function handleCreateNivel(data: NivelForm) {
    const { data: result, error } = await supabase.from('niveis').insert({ numero: parseInt(data.numero, 10), descricao: data.descricao }).select().single()
    if (error) {
      toast.error('Erro ao criar nivel: ' + error.message)
      return
    }
    toast.success('Nivel criado')
    setLocalNiveis([...localNiveis, result])
    setShowNivelForm(false)
    nivelForm.reset()
  }

  async function handleDeleteNivel(id: string) {
    if (!confirm('Tem certeza que deseja excluir este nivel?')) return
    const { error } = await supabase.from('niveis').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao excluir nivel: ' + error.message)
      return
    }
    setLocalNiveis(localNiveis.filter((n) => n.id !== id))
    toast.success('Nivel excluido')
  }

  // Other funcoes (excluding current) for "Responde a" dropdown
  const otherFuncoes = funcoes.filter((f) => f.id !== editingId)

  return (
    <Modal open={open} onClose={onClose} title={editingId ? 'Editar Funcao' : 'Nova Funcao'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Titulo *" {...register('titulo')} error={errors.titulo?.message} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="CBO" {...register('cbo')} />
          <Input label="Descricao CBO" {...register('descricao_cbo')} />
        </div>
        <Select
          label="Setor *"
          {...register('setor_id')}
          error={errors.setor_id?.message}
          options={setores.map((s) => ({ value: s.id as string, label: s.titulo as string }))}
          placeholder="Selecione"
        />

        {/* Nivel */}
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label="Nivel"
                {...register('nivel_id')}
                options={localNiveis.map((n) => ({
                  value: n.id as string,
                  label: `${n.numero} - ${n.descricao || ''}`,
                }))}
                placeholder="Selecione"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowNivelForm(!showNivelForm)}
              className="mb-0.5"
            >
              <Plus size={14} /> {showNivelForm ? 'Fechar' : 'Novo Nivel'}
            </Button>
          </div>
          {showNivelForm && (
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <h4 className="text-sm font-semibold text-cinza-preto">Novo Nivel</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Numero *"
                  type="number"
                  {...nivelForm.register('numero')}
                  error={nivelForm.formState.errors.numero?.message}
                />
                <Input
                  label="Descricao *"
                  {...nivelForm.register('descricao')}
                  error={nivelForm.formState.errors.descricao?.message}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNivelForm(false); nivelForm.reset() }}>Cancelar</Button>
                <Button type="button" size="sm" onClick={nivelForm.handleSubmit(handleCreateNivel)}>Criar Nivel</Button>
              </div>
              {localNiveis.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <p className="text-xs font-semibold text-cinza-estrutural mb-1">Niveis cadastrados:</p>
                  <div className="space-y-1">
                    {localNiveis.map((n) => (
                      <div key={n.id as string} className="flex items-center justify-between text-sm">
                        <span>{n.numero as number} - {n.descricao as string}</span>
                        <button type="button" onClick={() => handleDeleteNivel(n.id as string)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Responde a (hierarquia) */}
        <Select
          label="Responde a"
          {...register('responde_a')}
          options={otherFuncoes.map((f) => ({ value: f.id as string, label: f.titulo as string }))}
          placeholder="Nenhum (opcional)"
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
