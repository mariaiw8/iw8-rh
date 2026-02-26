'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { FeriasSaldo } from '@/hooks/useFerias'

interface VenderFeriasFormProps {
  open: boolean
  onClose: () => void
  saldos: FeriasSaldo[]
  onSubmit: (periodoId: string, dias: number) => Promise<boolean>
}

export function VenderFeriasForm({ open, onClose, saldos, onSubmit }: VenderFeriasFormProps) {
  const [periodoId, setPeriodoId] = useState('')
  const [dias, setDias] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const saldosDisponiveis = saldos.filter((s) => s.dias_restantes > 0 && (s.dias_vendidos || 0) < 10)

  const selectedSaldo = saldos.find((s) => s.id === periodoId)
  const maxDias = selectedSaldo ? Math.min(10 - (selectedSaldo.dias_vendidos || 0), selectedSaldo.dias_restantes) : 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!periodoId || dias < 1) return
    setSubmitting(true)
    try {
      const ok = await onSubmit(periodoId, dias)
      if (ok) {
        setPeriodoId('')
        setDias(1)
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vender Ferias (Abono Pecuniario)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Maximo de 10 dias vendidos por periodo aquisitivo (Art. 143, CLT).
        </div>

        <Select
          label="Periodo Aquisitivo *"
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          options={saldosDisponiveis.map((s) => ({
            value: s.id,
            label: `${s.periodo_inicio.slice(0, 10)} a ${s.periodo_fim.slice(0, 10)} — ${s.dias_restantes} dias restantes (${s.dias_vendidos || 0} ja vendidos)`,
          }))}
          placeholder="Selecione o periodo"
        />

        <Input
          label={`Dias a Vender * (max ${maxDias})`}
          type="number"
          value={dias.toString()}
          onChange={(e) => setDias(Math.min(maxDias, Math.max(1, parseInt(e.target.value) || 1)))}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !periodoId || dias < 1}>
            {submitting ? 'Processando...' : 'Confirmar Venda'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
