'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { type TipoTransacao } from '@/hooks/useTiposTransacao'

interface TransacaoFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TransacaoFormData) => Promise<void>
  tipos: TipoTransacao[]
  initial?: {
    id?: string
    tipo_transacao_id?: string
    valor?: number
    data?: string
    descricao?: string | null
  }
}

export interface TransacaoFormData {
  tipo_transacao_id: string
  valor: number
  data: string
  descricao: string
}

export function TransacaoForm({ open, onClose, onSubmit, tipos, initial }: TransacaoFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    tipo_transacao_id: '',
    valor: '',
    data: '',
    descricao: '',
  })

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          tipo_transacao_id: initial.tipo_transacao_id || '',
          valor: initial.valor?.toString() || '',
          data: initial.data || '',
          descricao: initial.descricao || '',
        })
      } else {
        setForm({
          tipo_transacao_id: '',
          valor: '',
          data: '',
          descricao: '',
        })
      }
    }
  }, [open, initial])

  const selectedTipo = tipos.find((t) => t.id === form.tipo_transacao_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_transacao_id || !form.valor || !form.data) return

    setSubmitting(true)
    try {
      await onSubmit({
        tipo_transacao_id: form.tipo_transacao_id,
        valor: parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || 0,
        data: form.data,
        descricao: form.descricao,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Transacao' : 'Adicionar Transacao'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Tipo de Transacao *"
          value={form.tipo_transacao_id}
          onChange={(e) => setForm({ ...form, tipo_transacao_id: e.target.value })}
          options={tipos.map((t) => ({
            value: t.id,
            label: `${t.titulo} (${t.natureza})`,
          }))}
          placeholder="Selecione"
        />

        {selectedTipo && (
          <div className="text-xs">
            Natureza: <span className={`font-medium ${selectedTipo.natureza === 'Credito' ? 'text-green-600' : 'text-red-600'}`}>
              {selectedTipo.natureza}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Valor * (R$)"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value.replace(/[^\d.,]/g, '') })}
            placeholder="0.00"
            inputMode="decimal"
          />
          <Input
            label="Data *"
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Descricao</label>
          <textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.tipo_transacao_id || !form.valor || !form.data}>
            {submitting ? 'Salvando...' : initial ? 'Salvar' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
