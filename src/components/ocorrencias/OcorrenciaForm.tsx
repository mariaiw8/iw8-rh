'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Autocomplete } from '@/components/ui/Autocomplete'
import { createClient } from '@/lib/supabase'
import { useOcorrencias, type TipoOcorrencia } from '@/hooks/useOcorrencias'
import { type FeriasSaldo } from '@/hooks/useFerias'
import { Upload } from 'lucide-react'
import { differenceInCalendarDays, format } from 'date-fns'

interface OcorrenciaFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: OcorrenciaFormData) => Promise<void>
  funcionarioId?: string
  funcionarioNome?: string
  tipos: TipoOcorrencia[]
}

export interface OcorrenciaFormData {
  funcionario_id: string
  tipo_ocorrencia_id: string
  descricao: string
  data_inicio: string
  data_fim: string
  dias: number
  valor: number | null
  arquivo_url: string | null
  observacao: string
  descontar_ferias: boolean
  ferias_saldo_id: string | null
}

export function OcorrenciaForm({ open, onClose, onSubmit, funcionarioId, funcionarioNome, tipos }: OcorrenciaFormProps) {
  const supabase = createClient()
  const { uploadArquivo } = useOcorrencias()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [funcionarios, setFuncionarios] = useState<{ value: string; label: string; sublabel: string }[]>([])
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<FeriasSaldo[]>([])

  const [form, setForm] = useState<OcorrenciaFormData>({
    funcionario_id: funcionarioId || '',
    tipo_ocorrencia_id: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    dias: 1,
    valor: null,
    arquivo_url: null,
    observacao: '',
    descontar_ferias: false,
    ferias_saldo_id: null,
  })

  useEffect(() => {
    if (open && !funcionarioId) {
      loadFuncionarios()
    }
  }, [open, funcionarioId])

  useEffect(() => {
    if (form.funcionario_id && form.descontar_ferias) {
      loadPeriodosDisponiveis(form.funcionario_id)
    } else {
      setPeriodosDisponiveis([])
    }
  }, [form.funcionario_id, form.descontar_ferias])

  async function loadPeriodosDisponiveis(funcId: string) {
    const { data } = await supabase
      .from('ferias_saldo')
      .select('*')
      .eq('funcionario_id', funcId)
      .in('status', ['Disponível', 'Parcial'])
      .order('periodo_aquisitivo_inicio')

    setPeriodosDisponiveis((data || []) as FeriasSaldo[])
  }

  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const dias = differenceInCalendarDays(
        new Date(form.data_fim + 'T00:00:00'),
        new Date(form.data_inicio + 'T00:00:00')
      ) + 1
      setForm((prev) => ({ ...prev, dias: dias > 0 ? dias : 1 }))
    }
  }, [form.data_inicio, form.data_fim])

  async function loadFuncionarios() {
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome_completo, codigo')
      .eq('status', 'Ativo')
      .order('nome_completo')

    setFuncionarios(
      (data || []).map((f: Record<string, string>) => ({
        value: f.id,
        label: f.nome_completo || f.nome,
        sublabel: f.codigo ? `Cod: ${f.codigo}` : '',
      }))
    )
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.funcionario_id) return
    setUploading(true)
    try {
      const url = await uploadArquivo(form.funcionario_id, file)
      if (url) {
        setForm({ ...form, arquivo_url: url })
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.funcionario_id || !form.tipo_ocorrencia_id || !form.data_inicio) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      setForm({
        funcionario_id: funcionarioId || '',
        tipo_ocorrencia_id: '',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        dias: 1,
        valor: null,
        arquivo_url: null,
        observacao: '',
        descontar_ferias: false,
        ferias_saldo_id: null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar Ocorrencia" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!funcionarioId ? (
          <Autocomplete
            label="Funcionario *"
            placeholder="Buscar funcionario..."
            options={funcionarios}
            value={form.funcionario_id}
            onChange={(val) => setForm({ ...form, funcionario_id: val })}
          />
        ) : (
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Funcionario</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{funcionarioNome}</div>
          </div>
        )}

        <Select
          label="Tipo de Ocorrencia *"
          value={form.tipo_ocorrencia_id}
          onChange={(e) => setForm({ ...form, tipo_ocorrencia_id: e.target.value })}
          options={tipos.map((t) => ({ value: t.id, label: t.titulo }))}
          placeholder="Selecione"
        />

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Descricao</label>
          <textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Data Inicio *"
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
          <Input
            label="Data Fim"
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
          />
          <Input
            label="Dias"
            type="number"
            value={form.dias.toString()}
            onChange={(e) => setForm({ ...form, dias: parseInt(e.target.value) || 1 })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Valor (R$)"
            type="number"
            value={form.valor?.toString() || ''}
            onChange={(e) => setForm({ ...form, valor: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="0,00"
          />
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Arquivo</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-estrutural hover:bg-gray-50 cursor-pointer transition-colors">
              <Upload size={16} />
              {uploading ? 'Enviando...' : form.arquivo_url ? 'Arquivo anexado' : 'Selecionar arquivo'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || !form.funcionario_id} />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-cinza-preto">
            <input
              type="checkbox"
              checked={form.descontar_ferias}
              onChange={(e) => setForm({
                ...form,
                descontar_ferias: e.target.checked,
                ferias_saldo_id: e.target.checked ? form.ferias_saldo_id : null,
              })}
              className="rounded border-gray-300 text-laranja focus:ring-laranja"
              disabled={!form.funcionario_id}
            />
            Descontar dias das ferias
          </label>

          {form.descontar_ferias && (
            <Select
              label="Periodo Aquisitivo *"
              value={form.ferias_saldo_id || ''}
              onChange={(e) => setForm({ ...form, ferias_saldo_id: e.target.value || null })}
              options={periodosDisponiveis.map((p) => ({
                value: p.id,
                label: `${format(new Date(p.periodo_aquisitivo_inicio + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(p.periodo_aquisitivo_fim + 'T00:00:00'), 'dd/MM/yyyy')} (${p.dias_restantes} dias restantes)`,
              }))}
              placeholder="Selecione o periodo"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.funcionario_id || !form.tipo_ocorrencia_id || !form.data_inicio}>
            {submitting ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
