'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
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
import { Plus, Pencil, Trash2, MapPin, Layers, Briefcase } from 'lucide-react'
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
})

const funcaoSchema = z.object({
  titulo: z.string().min(1, 'Titulo obrigatorio'),
  cbo: z.string().optional(),
  setor_id: z.string().min(1, 'Setor obrigatorio'),
})

type UnidadeForm = z.infer<typeof unidadeSchema>
type SetorForm = z.infer<typeof setorSchema>
type FuncaoForm = z.infer<typeof funcaoSchema>

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
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

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [uniRes, setRes, funRes] = await Promise.all([
        supabase.from('vw_resumo_unidades').select('*').order('titulo'),
        supabase.from('vw_resumo_setores').select('*').order('titulo'),
        supabase.from('funcoes').select('*, setores(titulo)').order('titulo'),
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
        setSetores(setRes.data || [])
      }

      if (funRes.error) {
        const fallback = await supabase.from('funcoes').select('*, setores(titulo)').order('titulo')
        setFuncoes(fallback.data || [])
      } else {
        setFuncoes(funRes.data || [])
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

        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            {tab === 'unidades' && (
              <UnidadesTable data={unidades} onEdit={openEdit} onDelete={(id) => handleDelete('unidades', id)} />
            )}
            {tab === 'setores' && (
              <SetoresTable data={setores} onEdit={openEdit} onDelete={(id) => handleDelete('setores', id)} />
            )}
            {tab === 'funcoes' && (
              <FuncoesTable data={funcoes} onEdit={openEdit} onDelete={(id) => handleDelete('funcoes', id)} />
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
        <TableHead>Funcionarios</TableHead>
        <TableHead className="w-24">Acoes</TableHead>
      </TableHeader>
      <TableBody>
        {data.map((s) => (
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
            <TableCell>{(s.total_funcionarios as number) ?? (s.num_funcionarios as number) ?? '-'}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <button onClick={() => onEdit(s.id as string)} className="p-1.5 text-azul-medio hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                <button onClick={() => onDelete(s.id as string)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FuncoesTable({ data, onEdit, onDelete }: { data: Record<string, unknown>[]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  if (data.length === 0) return <EmptyState title="Nenhuma funcao cadastrada" description="Clique em 'Nova Funcao' para criar" />
  return (
    <Table>
      <TableHeader>
        <TableHead>Titulo</TableHead>
        <TableHead>CBO</TableHead>
        <TableHead>Setor</TableHead>
        <TableHead className="w-24">Acoes</TableHead>
      </TableHeader>
      <TableBody>
        {data.map((f) => (
          <TableRow key={f.id as string}>
            <TableCell className="font-medium">{f.titulo as string}</TableCell>
            <TableCell>{(f.cbo as string) || '-'}</TableCell>
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
  const editing = editingId ? unidades.find((u) => u.id === editingId) : null
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UnidadeForm>({
    resolver: zodResolver(unidadeSchema),
    defaultValues: editing ? {
      titulo: editing.titulo as string,
      cnpj: (editing.cnpj as string) || '',
      endereco: (editing.endereco as string) || '',
      cidade: (editing.cidade as string) || '',
      estado: (editing.estado as string) || '',
      cep: (editing.cep as string) || '',
      telefone: (editing.telefone as string) || '',
    } : {},
  })

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          titulo: editing.titulo as string,
          cnpj: (editing.cnpj as string) || '',
          endereco: (editing.endereco as string) || '',
          cidade: (editing.cidade as string) || '',
          estado: (editing.estado as string) || '',
          cep: (editing.cep as string) || '',
          telefone: (editing.telefone as string) || '',
        })
      } else {
        reset({ titulo: '', cnpj: '', endereco: '', cidade: '', estado: '', cep: '', telefone: '' })
      }
    }
  }, [open, editing, reset])

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
  const editing = editingId ? setores.find((s) => s.id === editingId) : null
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SetorForm>({
    resolver: zodResolver(setorSchema),
    defaultValues: editing ? {
      titulo: editing.titulo as string,
      tipo: (editing.tipo as string) || '',
      unidade_id: (editing.unidade_id as string) || '',
    } : {},
  })

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          titulo: editing.titulo as string,
          tipo: (editing.tipo as string) || '',
          unidade_id: (editing.unidade_id as string) || '',
        })
      } else {
        reset({ titulo: '', tipo: '', unidade_id: '' })
      }
    }
  }, [open, editing, reset])

  async function onSubmit(data: SetorForm) {
    const payload = { ...data, unidade_id: data.unidade_id || null, tipo: data.tipo || null }
    if (editingId) {
      const { error } = await supabase.from('setores').update(payload).eq('id', editingId)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Setor atualizado')
    } else {
      const { error } = await supabase.from('setores').insert(payload)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Setor criado')
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingId ? 'Editar Setor' : 'Novo Setor'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Titulo *" {...register('titulo')} error={errors.titulo?.message} />
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
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function FuncaoModal({
  open, onClose, editingId, supabase, onSaved, setores, funcoes,
}: {
  open: boolean; onClose: () => void; editingId: string | null
  supabase: ReturnType<typeof createClient>; onSaved: () => void
  setores: Record<string, unknown>[]; funcoes: Record<string, unknown>[]
}) {
  const editing = editingId ? funcoes.find((f) => f.id === editingId) : null
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FuncaoForm>({
    resolver: zodResolver(funcaoSchema),
    defaultValues: editing ? {
      titulo: editing.titulo as string,
      cbo: (editing.cbo as string) || '',
      setor_id: (editing.setor_id as string) || '',
    } : {},
  })

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          titulo: editing.titulo as string,
          cbo: (editing.cbo as string) || '',
          setor_id: (editing.setor_id as string) || '',
        })
      } else {
        reset({ titulo: '', cbo: '', setor_id: '' })
      }
    }
  }, [open, editing, reset])

  async function onSubmit(data: FuncaoForm) {
    if (editingId) {
      const { error } = await supabase.from('funcoes').update(data).eq('id', editingId)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Funcao atualizada')
    } else {
      const { error } = await supabase.from('funcoes').insert(data)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Funcao criada')
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editingId ? 'Editar Funcao' : 'Nova Funcao'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Titulo *" {...register('titulo')} error={errors.titulo?.message} />
        <Input label="CBO" {...register('cbo')} />
        <Select
          label="Setor *"
          {...register('setor_id')}
          error={errors.setor_id?.message}
          options={setores.map((s) => ({ value: s.id as string, label: s.titulo as string }))}
          placeholder="Selecione"
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
