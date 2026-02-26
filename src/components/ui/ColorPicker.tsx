'use client'

import { useState, useRef, useEffect } from 'react'

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  '#78716C', '#6B7280', '#475569',
]

interface ColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  error?: string
}

export function ColorPicker({ label, value, onChange, error }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm font-medium text-cinza-preto mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto hover:border-gray-300 transition-colors"
      >
        <div
          className="w-6 h-6 rounded-md border border-gray-200"
          style={{ backgroundColor: value }}
        />
        <span>{value}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-md border-2 transition-all ${
                  value === color ? 'border-cinza-preto scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color)
                  setOpen(false)
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
              placeholder="#000000"
            />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
