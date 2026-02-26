'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'

interface Option {
  value: string
  label: string
  sublabel?: string
}

interface AutocompleteProps {
  label?: string
  placeholder?: string
  options: Option[]
  value?: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export function Autocomplete({ label, placeholder = 'Buscar...', options, value, onChange, error, disabled }: AutocompleteProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm font-medium text-cinza-preto mb-1">{label}</label>}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
          placeholder={selectedOption ? selectedOption.label : placeholder}
          value={open ? search : (selectedOption?.label || '')}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setSearch('')
          }}
          disabled={disabled}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                option.value === value ? 'bg-blue-50 text-azul-medio font-medium' : 'text-cinza-preto'
              }`}
              onClick={() => {
                onChange(option.value)
                setSearch('')
                setOpen(false)
              }}
            >
              <div>{option.label}</div>
              {option.sublabel && (
                <div className="text-xs text-cinza-estrutural">{option.sublabel}</div>
              )}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-cinza-estrutural">
          Nenhum resultado encontrado
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
