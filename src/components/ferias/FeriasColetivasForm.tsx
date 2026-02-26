'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase'
import { differenceInCalendarDays } from 'date-fns'

interface FeriasColetivasFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FeriasColetivasFormData) => Promise<void>
}

export interface FeriasColetivasFormData {
  titulo: string
  data_inicio: string
  data_fim: string
  dias: number
  unidade_id: string | null
  setor_id: string | null
  observacao: string
}

export function FeriasColetivasForm({ open, onClose, onSubmit }: FeriasColetivasFormProps) {
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [unidades, setUnidades] = useState<{ id: string; titulo: string }[]>([])
  const [setores, setSetores] = useState<{ id: string; titulo: string; unidade_id?: string }[]>([])

  const [form, setForm] = useState<FeriasColetivasFormData>({
    titulo: '',
    data_inicio: '',
    data_fim: '',
    dias: 0,
    unidade_id: null,
    setor_id: null,
    observacao: '',
  })

  useEffect(() => {
    if (open) {
      loadLookups()
    }
  }, [open])

  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const dias = differenceInCalendarDays(
        new Date(form.data_fim + 'T00:00:00'),
        new Date(form.data_inicio + 'T00:00:00')
      ) + 1
      setForm((prev) => ({ ...prev, dias: dias > 0 ? dias : 0 }))
    }
  }, [form.data_inicio, form.data_fim])

  async function loadLookups() {
    const [uniRes, setRes] = await Promise.all([
      supabase.from('unidades').select('id, titulo').order('titulo'),
      supabase.from('setores').select('id, titulo, unidade_id').order('titulo'),
    ])
    setUnidades(uniRes.data || [])
    setSetores(setRes.data || [])
  }

  const filteredSetores = form.unidade_id
    ? setores.filter((s) => s.unidade_id === form.unidade_id)
    : setores

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo || !form.data_inicio || !form.data_fim) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      setForm({ titulo: '', data_inicio: '', data_fim: '', dias: 0, unidade_id: null, setor_id: null, observacao: '' })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar Ferias Coletivas" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Titulo *"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          placeholder="Ex: Ferias coletivas fim de ano"
        />

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

        <Input
          label="Dias"
          type="number"
          value={form.dias.toString()}
          disabled
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Unidade"
            value={form.unidade_id || ''}
            onChange={(e) => setForm({ ...form, unidade_id: e.target.value || null, setor_id: null })}
            options={unidades.map((u) => ({ value: u.id, label: u.titulo }))}
            placeholder="Todas"
          />
          <Select
            label="Setor"
            value={form.setor_id || ''}
            onChange={(e) => setForm({ ...form, setor_id: e.target.value || null })}
            options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))}
            placeholder="Todos"
          />
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
          <Button type="submit" disabled={submitting || !form.titulo || !form.data_inicio || !form.data_fim}>
            {submitting ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
