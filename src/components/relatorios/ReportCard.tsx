'use client'

import { ReactNode } from 'react'

interface ReportCardProps {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
}

export function ReportCard({ title, description, icon, onClick }: ReportCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md hover:border-laranja border border-transparent transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-azul/10 flex items-center justify-center text-azul-medio group-hover:bg-laranja/10 group-hover:text-laranja transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-cinza-preto mb-1">{title}</h3>
          <p className="text-xs text-cinza-estrutural">{description}</p>
        </div>
      </div>
    </button>
  )
}
