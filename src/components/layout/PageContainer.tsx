import { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`p-6 max-w-7xl mx-auto ${className}`}>
      {children}
    </div>
  )
}
