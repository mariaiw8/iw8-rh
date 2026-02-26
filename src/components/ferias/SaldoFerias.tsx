'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { Pencil, Check, X } from 'lucide-react'
import type { FeriasSaldo } from '@/hooks/useFerias'
import { format } from 'date-fns'

interface SaldoFeriasProps {
  saldos: FeriasSaldo[]
  onUpdateDireito: (saldoId: string, dias: number) => Promise<boolean>
}

function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'Disponivel': case 'Disponível': return 'success'
    case 'Parcial': return 'warning'
    case 'Gozado': return 'neutral'
    case 'Vencido': return 'danger'
    default: return 'info'
  }
}

export function SaldoFerias({ saldos, onUpdateDireito }: SaldoFeriasProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const totalRestante = saldos.reduce((sum, s) => sum + (s.dias_restantes || 0), 0)

  async function handleSaveDireito(saldoId: string) {
    const dias = parseInt(editValue)
    if (isNaN(dias) || dias < 0) return
    const ok = await onUpdateDireito(saldoId, dias)
    if (ok) setEditingId(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left"
      >
        <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-xs font-medium text-cinza-estrutural mb-1">Saldo de Ferias</p>
          <p className="text-2xl font-bold text-cinza-preto">{totalRestante} dias</p>
          <p className="text-xs text-azul-medio mt-1">Clique para ver detalhes</p>
        </div>
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setEditingId(null) }} title="Periodos Aquisitivos" size="xl">
        <Table>
          <TableHeader>
            <TableHead>Periodo</TableHead>
            <TableHead>Dias Direito</TableHead>
            <TableHead>Gozados</TableHead>
            <TableHead>Vendidos</TableHead>
            <TableHead>Restantes</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableHeader>
          <TableBody>
            {saldos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-cinza-estrutural">
                  Nenhum periodo aquisitivo encontrado
                </td>
              </tr>
            ) : (
              saldos.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {format(new Date(s.periodo_aquisitivo_inicio + 'T00:00:00'), 'dd/MM/yyyy')} - {format(new Date(s.periodo_aquisitivo_fim + 'T00:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {editingId === s.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-16"
                        />
                        <button type="button" onClick={() => handleSaveDireito(s.id)} className="text-green-600 p-1"><Check size={14} /></button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-red-500 p-1"><X size={14} /></button>
                      </div>
                    ) : (
                      s.dias_direito
                    )}
                  </TableCell>
                  <TableCell>{s.dias_gozados}</TableCell>
                  <TableCell>{s.dias_vendidos}</TableCell>
                  <TableCell className="font-medium">{s.dias_restantes}</TableCell>
                  <TableCell>{format(new Date(s.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(s.status)}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {editingId !== s.id && (
                      <button
                        type="button"
                        onClick={() => { setEditingId(s.id); setEditValue(s.dias_direito.toString()) }}
                        className="text-cinza-estrutural hover:text-azul-medio p-1"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Modal>
    </>
  )
}
