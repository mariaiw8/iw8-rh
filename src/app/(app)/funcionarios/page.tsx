'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Toggle } from '@/components/ui/Toggle'
import { Select } from '@/components/ui/Select'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase'
import { Plus, Eye, Pencil, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface Funcionario {
  id: string
  nome: string
  codigo?: string
  cpf?: string
  status: string
  foto_url?: string
  unidade_titulo?: string
  unidade_id?: string
  setor_titulo?: string
  setor_id?: string
  funcao_titulo?: string
  funcao_id?: string
  data_admissao?: string
  // From view
  unidade?: string
  setor?: string
  funcao?: string
}

const novoFuncionarioSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatorio'),
  codigo: z.string().optional(),
  cpf: z.string().optional(),
  data_nascimento: z.string().optional(),
  data_admissao: z.string().optional(),
  unidade_id: z.string().optional(),
  setor_id: z.string().optional(),
  funcao_id: z.string().optional(),
})

type NovoFuncionarioForm = z.infer<typeof novoFuncionarioSchema>

export default function FuncionariosPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])
  const [funcoes, setFuncoes] = useState<{ id: string; titulo: string; setor_id?: string }[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState('Ativo')
  const [search, setSearch] = useState('')
  const [unidadeFilter, setUnidadeFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')

  // Collapsible groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Modal
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Try view first, fallback to table with joins
      let funcData: Funcionario[] = []
      const viewRes = await supabase.from('vw_funcionarios_completo').select('*').order('nome')
      if (viewRes.error) {
        const tableRes = await supabase
          .from('funcionarios')
          .select('*, unidades(id, titulo), setores(id, titulo), funcoes(id, titulo)')
          .order('nome')
        funcData = (tableRes.data || []).map((f: Record<string, unknown>) => ({
          id: f.id as string,
          nome: f.nome as string,
          codigo: f.codigo as string,
          cpf: f.cpf as string,
          status: (f.status as string) || 'Ativo',
          foto_url: f.foto_url as string,
          unidade_id: f.unidade_id as string,
          setor_id: f.setor_id as string,
          funcao_id: f.funcao_id as string,
          unidade_titulo: (f.unidades as Record<string, string>)?.titulo,
          setor_titulo: (f.setores as Record<string, string>)?.titulo,
          funcao_titulo: (f.funcoes as Record<string, string>)?.titulo,
        }))
      } else {
        funcData = (viewRes.data || []).map((f: Record<string, unknown>) => ({
          id: f.id as string,
          nome: f.nome as string,
          codigo: (f.codigo as string) || '',
          cpf: f.cpf as string,
          status: (f.status as string) || 'Ativo',
          foto_url: f.foto_url as string,
          unidade_id: f.unidade_id as string,
          setor_id: f.setor_id as string,
          funcao_id: f.funcao_id as string,
          unidade_titulo: (f.unidade_titulo || f.unidade) as string,
          setor_titulo: (f.setor_titulo || f.setor) as string,
          funcao_titulo: (f.funcao_titulo || f.funcao) as string,
        }))
      }
      setFuncionarios(funcData)

      const [uniRes, setRes, funRes] = await Promise.all([
        supabase.from('unidades').select('id, titulo').order('titulo'),
        supabase.from('setores').select('id, titulo, unidade_id').order('titulo'),
        supabase.from('funcoes').select('id, titulo, setor_id').order('titulo'),
      ])
      setUnidades(uniRes.data || [])
      setSetores(setRes.data || [])
      setFuncoes(funRes.data || [])
    } catch (err) {
      console.error('Erro ao carregar funcionarios:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return funcionarios.filter((f) => {
      if (statusFilter !== 'Todos' && f.status !== statusFilter) return false
      if (unidadeFilter && f.unidade_id !== unidadeFilter) return false
      if (setorFilter && f.setor_id !== setorFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const match = f.nome?.toLowerCase().includes(s) ||
          f.codigo?.toLowerCase().includes(s) ||
          f.cpf?.toLowerCase().includes(s)
        if (!match) return false
      }
      return true
    })
  }, [funcionarios, statusFilter, search, unidadeFilter, setorFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, Funcionario[]> = {}
    for (const f of filtered) {
      const key = f.unidade_titulo || 'Sem Unidade'
      if (!groups[key]) groups[key] = []
      groups[key].push(f)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const filteredSetores = unidadeFilter
    ? setores.filter((s) => s.unidade_id === unidadeFilter)
    : setores

  return (
    <PageContainer>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Toggle
          options={[
            { value: 'Ativo', label: 'Ativos' },
            { value: 'Inativo', label: 'Inativos' },
            { value: 'Todos', label: 'Todos' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <SearchInput
          placeholder="Buscar por nome, codigo ou CPF..."
          onSearch={setSearch}
          className="sm:w-64"
        />
        <Select
          options={unidades.map((u) => ({ value: u.id, label: u.titulo }))}
          placeholder="Todas Unidades"
          value={unidadeFilter}
          onChange={(e) => { setUnidadeFilter(e.target.value); setSetorFilter('') }}
          className="sm:w-48"
        />
        <Select
          options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))}
          placeholder="Todos Setores"
          value={setorFilter}
          onChange={(e) => setSetorFilter(e.target.value)}
          className="sm:w-48"
        />
        <div className="sm:ml-auto">
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Novo Cadastro
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={48} />}
            title="Nenhum funcionario encontrado"
            description="Ajuste os filtros ou cadastre um novo funcionario"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([unidade, funcs]) => (
            <Card key={unidade} className="p-0 overflow-hidden">
              <button
                onClick={() => toggleGroup(unidade)}
                className="w-full flex items-center gap-3 px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
              >
                {collapsedGroups.has(unidade) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                <span className="font-bold text-cinza-preto">{unidade}</span>
                <Badge variant="info">{funcs.length}</Badge>
              </button>
              {!collapsedGroups.has(unidade) && (
                <Table>
                  <TableHeader>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Funcao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Acoes</TableHead>
                  </TableHeader>
                  <TableBody>
                    {funcs.map((f) => (
                      <TableRow key={f.id} onClick={() => router.push(`/funcionarios/${f.id}`)}>
                        <TableCell>
                          <Avatar src={f.foto_url} name={f.nome} size="sm" />
                        </TableCell>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>{f.codigo || '-'}</TableCell>
                        <TableCell>{f.setor_titulo || '-'}</TableCell>
                        <TableCell>{f.funcao_titulo || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={f.status === 'Ativo' ? 'success' : 'neutral'}>
                            {f.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/funcionarios/${f.id}`)}
                              className="p-1.5 text-azul-medio hover:bg-blue-50 rounded"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => router.push(`/funcionarios/${f.id}?edit=true`)}
                              className="p-1.5 text-cinza-estrutural hover:bg-gray-100 rounded"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New Employee Modal */}
      <NovoFuncionarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        supabase={supabase}
        unidades={unidades}
        setores={setores}
        funcoes={funcoes}
        onSaved={(id) => {
          setModalOpen(false)
          if (id) router.push(`/funcionarios/${id}`)
          else loadData()
        }}
      />
    </PageContainer>
  )
}

function NovoFuncionarioModal({
  open, onClose, supabase, unidades, setores, funcoes, onSaved,
}: {
  open: boolean; onClose: () => void
  supabase: ReturnType<typeof createClient>
  unidades: { id: string; titulo: string }[]
  setores: { id: string; titulo: string; unidade_id?: string }[]
  funcoes: { id: string; titulo: string; setor_id?: string }[]
  onSaved: (id?: string) => void
}) {
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<NovoFuncionarioForm>({
    resolver: zodResolver(novoFuncionarioSchema),
  })

  const unidadeId = watch('unidade_id')
  const setorId = watch('setor_id')
  const filteredSetores = unidadeId ? setores.filter((s) => s.unidade_id === unidadeId) : setores
  const filteredFuncoes = setorId ? funcoes.filter((f) => f.setor_id === setorId) : funcoes

  useEffect(() => {
    if (open) reset({ nome: '', codigo: '', cpf: '', data_nascimento: '', data_admissao: '', unidade_id: '', setor_id: '', funcao_id: '' })
  }, [open, reset])

  async function onSubmit(data: NovoFuncionarioForm) {
    const payload = {
      nome: data.nome,
      codigo: data.codigo || null,
      cpf: data.cpf || null,
      data_nascimento: data.data_nascimento || null,
      data_admissao: data.data_admissao || null,
      unidade_id: data.unidade_id || null,
      setor_id: data.setor_id || null,
      funcao_id: data.funcao_id || null,
      status: 'Ativo',
    }
    const { data: result, error } = await supabase.from('funcionarios').insert(payload).select('id').single()
    if (error) {
      toast.error('Erro: ' + error.message)
      return
    }
    toast.success('Funcionario cadastrado')
    onSaved(result?.id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Funcionario" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome Completo *" {...register('nome')} error={errors.nome?.message} />
          <Input label="Codigo" {...register('codigo')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="CPF" {...register('cpf')} placeholder="000.000.000-00" />
          <Input label="Data de Nascimento" type="date" {...register('data_nascimento')} />
          <Input label="Data de Admissao" type="date" {...register('data_admissao')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Unidade"
            {...register('unidade_id')}
            options={unidades.map((u) => ({ value: u.id, label: u.titulo }))}
            placeholder="Selecione"
          />
          <Select
            label="Setor"
            {...register('setor_id')}
            options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))}
            placeholder="Selecione"
          />
          <Select
            label="Funcao"
            {...register('funcao_id')}
            options={filteredFuncoes.map((f) => ({ value: f.id, label: f.titulo }))}
            placeholder="Selecione"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
