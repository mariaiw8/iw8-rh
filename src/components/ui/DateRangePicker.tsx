'use client'

interface DateRangePickerProps {
  label?: string
  startDate: string
  endDate: string
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
}

export function DateRangePicker({ label, startDate, endDate, onStartChange, onEndChange }: DateRangePickerProps) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-cinza-preto mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all"
        />
        <span className="text-cinza-estrutural text-sm">ate</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all"
        />
      </div>
    </div>
  )
}
