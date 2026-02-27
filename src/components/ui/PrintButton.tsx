'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PrintButtonProps {
  className?: string
}

export function PrintButton({ className = '' }: PrintButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => window.print()}
      className={className}
    >
      <Printer size={16} /> Imprimir
    </Button>
  )
}
