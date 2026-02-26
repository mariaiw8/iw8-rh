'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface SalarioFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: SalarioFormData) => Promise<void>
  initial?: {
    id?: string
    salario_bruto?: number
    salario_liquido?: number | null
    custo_funcionario?: number | null
    data_vigencia?: string
    observacao?: string | null
  }
}

export interface SalarioFormData {
  salario_bruto: number
  salario_liquido: number | null
  custo_funcionario: number | null
  data_vigencia: string
  observacao: string
}

function formatCurrencyInput(value: string): string {
  return value.replace(/[^\d.,]/g, '')
}

function parseCurrency(value: string): number {
  if (!value) return 0
  // Handle both , and . as decimal separator
  const cleaned = value.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

export function SalarioForm({ open, onClose, onSubmit, initial }: SalarioFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [bruto, setBruto] = useState('')
  const [liquido, setLiquido] = useState('')
  const [custo, setCusto] = useState('')
  const [dataVigencia, setDataVigencia] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    if (open) {
      if (initial) {
        setBruto(initial.salario_bruto?.toString() || '')
        setLiquido(initial.salario_liquido?.toString() || '')
        setCusto(initial.custo_funcionario?.toString() || '')
        setDataVigencia(initial.data_vigencia || '')
        setObservacao(initial.observacao || '')
      } else {
        setBruto('')
        setLiquido('')
        setCusto('')
        setDataVigencia('')
        setObservacao('')
      }
    }
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const brutoVal = parseCurrency(bruto)
    if (!brutoVal || !dataVigencia) return

    setSubmitting(true)
    try {
      await onSubmit({
        salario_bruto: brutoVal,
        salario_liquido: liquido ? parseCurrency(liquido) : null,
        custo_funcionario: custo ? parseCurrency(custo) : null,
        data_vigencia: dataVigencia,
        observacao,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Salario' : 'Registrar Novo Salario'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Salario Bruto * (R$)"
            value={bruto}
            onChange={(e) => setBruto(formatCurrencyInput(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
          />
          <Input
            label="Salario Liquido (R$)"
            value={liquido}
            onChange={(e) => setLiquido(formatCurrencyInput(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Custo Funcionario (R$)"
            value={custo}
            onChange={(e) => setCusto(formatCurrencyInput(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
          />
          <Input
            label="Data Vigencia *"
            type="date"
            value={dataVigencia}
            onChange={(e) => setDataVigencia(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !bruto || !dataVigencia}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
