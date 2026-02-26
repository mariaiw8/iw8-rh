'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface TipoTransacaoFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TipoTransacaoFormData) => Promise<void>
  initial?: { id?: string; titulo?: string; natureza?: string }
}

export interface TipoTransacaoFormData {
  titulo: string
  natureza: 'Credito' | 'Debito'
}

const NATUREZAS = [
  { value: 'Credito', label: 'Credito' },
  { value: 'Debito', label: 'Debito' },
]

export function TipoTransacaoForm({ open, onClose, onSubmit, initial }: TipoTransacaoFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<TipoTransacaoFormData>({
    titulo: initial?.titulo || '',
    natureza: (initial?.natureza as 'Credito' | 'Debito') || 'Credito',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      if (!initial) {
        setForm({ titulo: '', natureza: 'Credito' })
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Tipo de Transacao' : 'Cadastrar Tipo de Transacao'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Titulo *"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          placeholder="Ex: Gratificacao, Desconto Farmacia"
        />

        <Select
          label="Natureza *"
          value={form.natureza}
          onChange={(e) => setForm({ ...form, natureza: e.target.value as 'Credito' | 'Debito' })}
          options={NATUREZAS}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.titulo}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
