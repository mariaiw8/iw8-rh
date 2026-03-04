'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Autocomplete } from '@/components/ui/Autocomplete'
import { createClient } from '@/lib/supabase'
import type { FeriasPeriodoSaldo } from '@/types/ferias'
import { formatDateSafe, safeDifferenceInDays } from '@/lib/dateUtils'

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
  abono_pecuniario: boolean
  dias_vendidos: number
  observacao: string
}

export function FeriasForm({ open, onClose, onSubmit, funcionarioId, funcionarioNome }: FeriasFormProps) {
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [funcionarios, setFuncionarios] = useState<{ value: string; label: string; sublabel: string }[]>([])
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<FeriasPeriodoSaldo[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const [form, setForm] = useState<FeriasFormData>({
    funcionario_id: funcionarioId || '',
    data_inicio: '',
    data_fim: '',
    dias: 0,
    tipo: 'Individual',
    periodo_aquisitivo_id: '',
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
      const dias = safeDifferenceInDays(form.data_fim, form.data_inicio) + 1
      setForm((prev) => ({ ...prev, dias: dias > 0 ? dias : 0 }))
    }
  }, [form.data_inicio, form.data_fim])

  // Validate dias against selected periodo
  useEffect(() => {
    if (form.periodo_aquisitivo_id && form.dias > 0) {
      const periodo = periodosDisponiveis.find((p) => p.id === form.periodo_aquisitivo_id)
      if (periodo && form.dias > periodo.dias_restantes) {
        setValidationError(`Dias solicitados (${form.dias}) excedem os dias disponiveis (${periodo.dias_restantes}) do periodo selecionado`)
      } else {
        setValidationError(null)
      }
    } else {
      setValidationError(null)
    }
  }, [form.periodo_aquisitivo_id, form.dias, periodosDisponiveis])

  async function loadFuncionarios() {
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome_completo, codigo')
      .eq('status', 'Ativo')
      .order('nome_completo')

    setFuncionarios(
      (data || []).map((f: Record<string, string>) => ({
        value: f.id,
        label: f.nome_completo,
        sublabel: f.codigo ? `Cod: ${f.codigo}` : '',
      }))
    )
  }

  async function loadPeriodosDisponiveis(funcId: string) {
    const { data, error } = await supabase
      .rpc('fn_resumo_periodos_ferias', { p_funcionario_id: funcId })

    if (error) {
      // Fallback to view query
      const { data: fallbackData } = await supabase
        .from('v_ferias_periodos_saldo')
        .select('*')
        .eq('funcionario_id', funcId)
        .in('status_calculado', ['Disponível', 'Parcial'])
        .order('aquisitivo_inicio')
      setPeriodosDisponiveis(((fallbackData || []) as FeriasPeriodoSaldo[]).filter(p => (p.dias_restantes ?? 0) > 0))
      return
    }

    const periodos = ((data || []) as FeriasPeriodoSaldo[]).filter(p => (p.dias_restantes ?? 0) > 0)
    setPeriodosDisponiveis(periodos)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.funcionario_id || !form.data_inicio || !form.data_fim || !form.periodo_aquisitivo_id) return
    if (validationError) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      setForm({
        funcionario_id: funcionarioId || '',
        data_inicio: '',
        data_fim: '',
        dias: 0,
        tipo: 'Individual',
        periodo_aquisitivo_id: '',
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
          value={form.periodo_aquisitivo_id || ''}
          onChange={(e) => setForm({ ...form, periodo_aquisitivo_id: e.target.value })}
          options={periodosDisponiveis.map((p) => ({
            value: p.id,
            label: `${formatDateSafe(p.aquisitivo_inicio)} a ${formatDateSafe(p.aquisitivo_fim)} — ${p.dias_restantes ?? 0} dias disponiveis`,
          }))}
          placeholder={periodosDisponiveis.length === 0 ? 'Nenhum periodo disponivel' : 'Selecione o periodo'}
          error={validationError || undefined}
        />

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
          <Button type="submit" disabled={submitting || !form.funcionario_id || !form.data_inicio || !form.data_fim || !form.periodo_aquisitivo_id || !!validationError}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
