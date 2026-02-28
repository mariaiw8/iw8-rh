'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Autocomplete } from '@/components/ui/Autocomplete'
import { createClient } from '@/lib/supabase'
import { type FeriasSaldo } from '@/hooks/useFerias'
import { differenceInCalendarDays, format } from 'date-fns'

interface FeriasFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FeriasFormData) => Promise<void>
  funcionarioId?: string
  funcionarioNome?: string
}

export interface FeriasFormData {
  funcionario_id: string
  data_inicio: string
  data_fim: string
  dias: number
  tipo: string
  periodo_aquisitivo_id?: string
  ferias_saldo_id?: string
  abono_pecuniario: boolean
  dias_vendidos: number
  observacao: string
}

export function FeriasForm({ open, onClose, onSubmit, funcionarioId, funcionarioNome }: FeriasFormProps) {
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [funcionarios, setFuncionarios] = useState<{ value: string; label: string; sublabel: string }[]>([])
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<FeriasSaldo[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const [form, setForm] = useState<FeriasFormData>({
    funcionario_id: funcionarioId || '',
    data_inicio: '',
    data_fim: '',
    dias: 0,
    tipo: 'Individual',
    periodo_aquisitivo_id: '',
    ferias_saldo_id: '',
    abono_pecuniario: false,
    dias_vendidos: 0,
    observacao: '',
  })

  useEffect(() => {
    if (open && !funcionarioId) {
      loadFuncionarios()
    }
  }, [open, funcionarioId])

  useEffect(() => {
    if (form.funcionario_id) {
      loadPeriodosDisponiveis(form.funcionario_id)
    } else {
      setPeriodosDisponiveis([])
    }
  }, [form.funcionario_id])

  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const dias = differenceInCalendarDays(
        new Date(form.data_fim + 'T00:00:00'),
        new Date(form.data_inicio + 'T00:00:00')
      ) + 1
      setForm((prev) => ({ ...prev, dias: dias > 0 ? dias : 0 }))
    }
  }, [form.data_inicio, form.data_fim])

  // Validate dias against selected periodo
  useEffect(() => {
    if (form.ferias_saldo_id && form.dias > 0) {
      const periodo = periodosDisponiveis.find((p) => p.id === form.ferias_saldo_id)
      if (periodo && form.dias > periodo.dias_restantes) {
        setValidationError(`Dias solicitados (${form.dias}) excedem os dias disponiveis (${periodo.dias_restantes}) do periodo selecionado`)
      } else {
        setValidationError(null)
      }
    } else {
      setValidationError(null)
    }
  }, [form.ferias_saldo_id, form.dias, periodosDisponiveis])

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

  async function loadPeriodosDisponiveis(funcId: string) {
    const { data } = await supabase
      .from('ferias_saldo')
      .select('*')
      .eq('funcionario_id', funcId)
      .in('status', ['Disponível', 'Parcial'])
      .order('periodo_aquisitivo_inicio')

    setPeriodosDisponiveis((data || []) as FeriasSaldo[])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.funcionario_id || !form.data_inicio || !form.data_fim || !form.ferias_saldo_id) return
    if (validationError) return
    setSubmitting(true)
    try {
      await onSubmit({
        ...form,
        periodo_aquisitivo_id: form.ferias_saldo_id,
      })
      setForm({
        funcionario_id: funcionarioId || '',
        data_inicio: '',
        data_fim: '',
        dias: 0,
        tipo: 'Individual',
        periodo_aquisitivo_id: '',
        ferias_saldo_id: '',
        abono_pecuniario: false,
        dias_vendidos: 0,
        observacao: '',
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Ferias" size="lg">
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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data Inicio *"
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
          <Input
            label="Data Fim *"
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dias"
            type="number"
            value={form.dias.toString()}
            onChange={(e) => setForm({ ...form, dias: parseInt(e.target.value) || 0 })}
            disabled
          />
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            options={[
              { value: 'Individual', label: 'Individual' },
              { value: 'Coletiva', label: 'Coletiva' },
            ]}
          />
        </div>

        <Select
          label="Periodo Aquisitivo *"
          value={form.ferias_saldo_id || ''}
          onChange={(e) => setForm({ ...form, ferias_saldo_id: e.target.value })}
          options={periodosDisponiveis.map((p) => ({
            value: p.id,
            label: `${format(new Date(p.periodo_aquisitivo_inicio + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(p.periodo_aquisitivo_fim + 'T00:00:00'), 'dd/MM/yyyy')} — ${p.dias_restantes} dias disponiveis`,
          }))}
          placeholder={periodosDisponiveis.length === 0 ? 'Nenhum periodo disponivel' : 'Selecione o periodo'}
          error={validationError || undefined}
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-cinza-preto">
            <input
              type="checkbox"
              checked={form.abono_pecuniario}
              onChange={(e) => setForm({ ...form, abono_pecuniario: e.target.checked, dias_vendidos: e.target.checked ? form.dias_vendidos : 0 })}
              className="rounded border-gray-300 text-laranja focus:ring-laranja"
            />
            Abono Pecuniario
          </label>
          {form.abono_pecuniario && (
            <Input
              label="Dias Vendidos (max 10)"
              type="number"
              value={form.dias_vendidos.toString()}
              onChange={(e) => {
                const val = Math.min(10, parseInt(e.target.value) || 0)
                setForm({ ...form, dias_vendidos: val })
              }}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.funcionario_id || !form.data_inicio || !form.data_fim || !form.ferias_saldo_id || !!validationError}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
