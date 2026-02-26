import { ReactNode } from 'react'

interface TableProps {
  children: ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="bg-azul text-white">
        {children}
      </tr>
    </thead>
  )
}

export function TableHead({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>
}

export function TableRow({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={`even:bg-gray-50 hover:bg-blue-50/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-cinza-preto ${className}`}>
      {children}
    </td>
  )
}
