'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ColorPicker } from '@/components/ui/ColorPicker'

interface TipoOcorrenciaFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TipoFormData) => Promise<void>
  initial?: { id?: string; titulo?: string; categoria?: string; cor?: string }
}

export interface TipoFormData {
  titulo: string
  categoria: string
  cor: string
}

const CATEGORIAS = [
  { value: 'Remuneracao', label: 'Remuneracao' },
  { value: 'Ausencia', label: 'Ausencia' },
  { value: 'Disciplinar', label: 'Disciplinar' },
  { value: 'Beneficio', label: 'Beneficio' },
  { value: 'Outro', label: 'Outro' },
]

export function TipoOcorrenciaForm({ open, onClose, onSubmit, initial }: TipoOcorrenciaFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<TipoFormData>({
    titulo: initial?.titulo || '',
    categoria: initial?.categoria || 'Ausencia',
    cor: initial?.cor || '#3B82F6',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo || !form.categoria) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      if (!initial) {
        setForm({ titulo: '', categoria: 'Ausencia', cor: '#3B82F6' })
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Tipo de Ocorrencia' : 'Cadastrar Tipo de Ocorrencia'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Titulo *"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          placeholder="Ex: Atestado Medico"
        />

        <Select
          label="Categoria *"
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          options={CATEGORIAS}
        />

        <ColorPicker
          label="Cor"
          value={form.cor}
          onChange={(cor) => setForm({ ...form, cor })}
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
