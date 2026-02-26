'use client'

interface ToggleOption {
  value: string
  label: string
}

interface ToggleProps {
  options: ToggleOption[]
  value: string
  onChange: (value: string) => void
}

export function Toggle({ options, value, onChange }: ToggleProps) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
            value === opt.value
              ? 'bg-white text-cinza-preto shadow-sm'
              : 'text-cinza-estrutural hover:text-cinza-preto'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
