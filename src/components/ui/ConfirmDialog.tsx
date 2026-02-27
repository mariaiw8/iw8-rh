'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmLabel?: string
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar Exclusao',
  message,
  confirmLabel = 'Excluir',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center py-2">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <p className="text-sm text-cinza-estrutural mb-6">{message}</p>
        <div className="flex gap-3 w-full">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading} className="flex-1">
            {loading ? 'Excluindo...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
