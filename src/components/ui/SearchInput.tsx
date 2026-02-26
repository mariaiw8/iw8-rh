'use client'

import { Search } from 'lucide-react'
import { InputHTMLAttributes } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearch?: (value: string) => void
}

export function SearchInput({ onSearch, className = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all"
        onChange={(e) => onSearch?.(e.target.value)}
        {...props}
      />
    </div>
  )
}
