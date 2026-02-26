import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: number | string
  icon: ReactNode
  description?: string
  color?: string
}

export function StatCard({ title, value, icon, description, color = 'text-laranja' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">{title}</p>
        <div className={`${color}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-cinza-preto">{value}</p>
      {description && (
        <p className="text-xs text-cinza-estrutural mt-1">{description}</p>
      )}
    </div>
  )
}
