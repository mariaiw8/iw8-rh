/**
 * ============================================================================
 * IW8 RH - Sistema de Gestao de Recursos Humanos
 * Versao consolidada em arquivo unico (.jsx)
 * ============================================================================
 *
 * Dependencias necessarias (package.json):
 * - react, react-dom
 * - react-router-dom (para navegacao SPA)
 * - @supabase/supabase-js
 * - date-fns
 * - lucide-react
 * - recharts
 * - sonner (toast notifications)
 * - react-hook-form, @hookform/resolvers, zod
 * - xlsx, file-saver
 *
 * Cores do tema (CSS custom properties):
 * --color-laranja: #E57B25
 * --color-laranja-escuro: #CC6716
 * --color-laranja-claro: #F0A756
 * --color-amarelo: #F5AF00
 * --color-azul: #154766
 * --color-azul-noturno: #0C2C4A
 * --color-azul-medio: #4D85B3
 * --color-cinza-estrutural: #434545
 * --color-cinza-preto: #292929
 * --color-cinza-branco: #F7F7F7
 * ============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, forwardRef, createContext, useContext } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { format, differenceInYears, differenceInMonths, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Toaster, toast } from 'sonner'
import {
  LayoutDashboard, Users, Building2, ChevronDown, ChevronRight, MapPin, Layers,
  Briefcase, Palmtree, ClipboardList, DollarSign, FileBarChart, LogOut, Menu, X,
  Plus, Eye, Pencil, Trash2, AlertTriangle, CalendarClock, Cake, UserPlus,
  BarChart3, Calendar, ArrowLeft, Save, Clock, ExternalLink, Filter, Search,
  Upload, FileText, Wallet, TrendingUp, Trophy, Printer,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

// ============================================================================
// SUPABASE CLIENT
// ============================================================================
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_KEY)
}

// ============================================================================
// NAVIGATION CONTEXT (Simula router)
// ============================================================================
const NavContext = createContext({
  currentPath: '/',
  navigate: (path) => {},
  params: {},
  searchParams: {},
})

function usePathname() {
  return useContext(NavContext).currentPath
}
function useRouter() {
  const ctx = useContext(NavContext)
  return {
    push: ctx.navigate,
    refresh: () => {},
  }
}
function useParams() {
  return useContext(NavContext).params
}
function useSearchParams() {
  const ctx = useContext(NavContext)
  return { get: (key) => ctx.searchParams[key] || null }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

// --- Button ---
function Button({ children, variant = 'primary', size = 'md', disabled, className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  const variants = {
    primary: 'bg-laranja hover:bg-laranja-escuro text-white',
    secondary: 'border border-azul text-azul hover:bg-blue-50',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    ghost: 'text-cinza-estrutural hover:bg-gray-100',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

// --- Card, CardHeader, CardTitle ---
function Card({ children, className = '', ...props }) {
  return <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`} {...props}>{children}</div>
}
function CardHeader({ children }) {
  return <div className="mb-4">{children}</div>
}
function CardTitle({ children }) {
  return <h3 className="text-lg font-bold text-cinza-preto">{children}</h3>
}

// --- Modal ---
function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${sizes[size]} mx-4 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-cinza-preto">{title}</h2>
          <button onClick={onClose} className="text-cinza-estrutural hover:text-cinza-preto"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// --- Input ---
const Input = forwardRef(function Input({ label, error, className = '', ...props }, ref) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-cinza-preto mb-1">{label}</label>}
      <input
        ref={ref}
        className={`w-full px-3 py-2 border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg text-sm text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all ${className}`}
        {...props}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
})

// --- Select ---
const Select = forwardRef(function Select({ label, error, options = [], placeholder, className = '', ...props }, ref) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-cinza-preto mb-1">{label}</label>}
      <select
        ref={ref}
        className={`w-full px-3 py-2 border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg text-sm text-cinza-preto bg-white focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
})

// --- Badge ---
function Badge({ children, variant = 'neutral' }) {
  const variants = {
    success: 'bg-green-100 text-green-700',
    danger: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
    neutral: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.neutral}`}>
      {children}
    </span>
  )
}

// --- Avatar ---
function Avatar({ src, name = '', size = 'md' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg', xl: 'w-20 h-20 text-2xl' }
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  if (src) return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover`} />
  return (
    <div className={`${sizes[size]} rounded-full bg-azul-medio text-white flex items-center justify-center font-bold`}>
      {initials}
    </div>
  )
}

// --- Table ---
function Table({ children, className = '' }) {
  return <div className="overflow-x-auto"><table className={`w-full ${className}`}>{children}</table></div>
}
function TableHeader({ children }) {
  return <thead className="bg-azul text-white"><tr>{children}</tr></thead>
}
function TableHead({ children, className = '' }) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${className}`}>{children}</th>
}
function TableBody({ children }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>
}
function TableRow({ children, onClick, className = '' }) {
  return (
    <tr className={`even:bg-gray-50 hover:bg-blue-50/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick}>
      {children}
    </tr>
  )
}
function TableCell({ children, className = '' }) {
  return <td className={`px-4 py-3 text-sm text-cinza-preto ${className}`}>{children}</td>
}

// --- Toggle ---
function Toggle({ options, value, onChange }) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === opt.value ? 'bg-white text-cinza-preto shadow-sm' : 'text-cinza-estrutural hover:text-cinza-preto'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// --- SearchInput ---
function SearchInput({ placeholder, value, onChange, onSearch, className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange || ((e) => onSearch?.(e.target.value))}
        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
        {...props}
      />
    </div>
  )
}

// --- EmptyState ---
function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-gray-300 mb-3">{icon}</div>}
      <h4 className="text-sm font-medium text-cinza-preto mb-1">{title}</h4>
      {description && <p className="text-xs text-cinza-estrutural max-w-sm">{description}</p>}
    </div>
  )
}

// --- LoadingSkeleton ---
function CardSkeleton() {
  return <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-3" /><div className="h-8 bg-gray-200 rounded w-1/3" /></div>
}
function TableSkeleton({ rows = 5 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse space-y-3">
      <div className="h-10 bg-gray-200 rounded" />
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
    </div>
  )
}
function Skeleton({ className = '' }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
}

// --- Pagination ---
function Pagination({ currentPage, totalItems, pageSize, onPageChange }) {
  const totalPages = Math.ceil(totalItems / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 print:hidden">
      <p className="text-sm text-cinza-estrutural">{totalItems} registros</p>
      <div className="flex gap-1">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Anterior</button>
        <span className="px-3 py-1.5 text-sm text-cinza-preto">Pagina {currentPage} de {totalPages}</span>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Proxima</button>
      </div>
    </div>
  )
}

// --- DateRangePicker ---
function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja" />
      <span className="text-cinza-estrutural text-sm">ate</span>
      <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja" />
    </div>
  )
}

// --- PrintButton ---
function PrintButton() {
  return <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer size={16} /> Imprimir</Button>
}

// --- ColorPicker ---
function ColorPicker({ label, value, onChange }) {
  const colors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#64748B']
  return (
    <div>
      {label && <label className="block text-sm font-medium text-cinza-preto mb-2">{label}</label>}
      <div className="flex gap-2 flex-wrap">
        {colors.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} className={`w-8 h-8 rounded-full border-2 ${value === c ? 'border-cinza-preto scale-110' : 'border-transparent'} transition-transform`} style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  )
}

// --- Autocomplete ---
function Autocomplete({ label, placeholder, options = [], value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find((o) => o.value === value)
  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-cinza-preto mb-1">{label}</label>}
      <input
        type="text"
        placeholder={placeholder}
        value={selected ? selected.label : search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); if (value) onChange('') }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 20).map((opt) => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setSearch(''); setOpen(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors">
              <p className="font-medium text-cinza-preto">{opt.label}</p>
              {opt.sublabel && <p className="text-xs text-cinza-estrutural">{opt.sublabel}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- ExportButton ---
function ExportButton({ data, columns, filename }) {
  async function handleExport(type) {
    if (type === 'csv') {
      const header = columns.map((c) => c.header).join(';')
      const rows = data.map((row) => columns.map((c) => { const v = row[c.key]; return c.format ? c.format(v) : String(v ?? '') }).join(';'))
      const csv = [header, ...rows].join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click()
    } else {
      try {
        const XLSX = await import('xlsx')
        const ws = XLSX.utils.json_to_sheet(data.map((row) => {
          const obj = {}
          columns.forEach((c) => { obj[c.header] = c.format ? c.format(row[c.key]) : row[c.key] })
          return obj
        }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Dados')
        XLSX.writeFile(wb, `${filename}.xlsx`)
      } catch { toast.error('Erro ao exportar Excel') }
    }
  }
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => handleExport('csv')}>CSV</Button>
      <Button variant="ghost" size="sm" onClick={() => handleExport('xlsx')}>Excel</Button>
    </div>
  )
}

// --- ReportCard ---
function ReportCard({ title, description, icon, onClick }) {
  return (
    <button onClick={onClick} className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md hover:border-laranja border border-transparent transition-all group">
      <div className="text-azul-medio mb-3 group-hover:text-laranja transition-colors">{icon}</div>
      <h3 className="font-bold text-cinza-preto mb-1">{title}</h3>
      <p className="text-xs text-cinza-estrutural">{description}</p>
    </button>
  )
}

// --- PageContainer ---
function PageContainer({ children }) {
  return <div className="max-w-7xl mx-auto p-6">{children}</div>
}

// ============================================================================
// DASHBOARD COMPONENTS
// ============================================================================

function StatCard({ title, value, icon, color = 'text-azul-medio' }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">{title}</p>
        <div className={color}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-cinza-preto">{value}</p>
    </Card>
  )
}

function TurnoverCard({ valor, historico }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Turnover</p>
        <TrendingUp size={20} className="text-red-500" />
      </div>
      <p className="text-2xl font-bold text-cinza-preto">{(valor || 0).toFixed(1)}%</p>
      <p className="text-xs text-cinza-estrutural mt-1">Ultimos 12 meses</p>
    </Card>
  )
}

function AbsenteismoCard({ valor }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Absenteismo</p>
        <Calendar size={20} className="text-amber-500" />
      </div>
      <p className="text-2xl font-bold text-cinza-preto">{(valor || 0).toFixed(1)}%</p>
      <p className="text-xs text-cinza-estrutural mt-1">Mes atual</p>
    </Card>
  )
}

function TempoEmpresaCard({ tempo }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Tempo Medio Empresa</p>
        <Clock size={20} className="text-azul-medio" />
      </div>
      <p className="text-2xl font-bold text-cinza-preto">{tempo || 'N/A'}</p>
    </Card>
  )
}

function CustoMedioCard({ valor }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cinza-estrutural">Custo Medio / Func.</p>
        <DollarSign size={20} className="text-green-500" />
      </div>
      <p className="text-2xl font-bold text-cinza-preto">
        {valor ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A'}
      </p>
    </Card>
  )
}

// --- Strategic Charts ---
const CHART_COLORS = ['#E57B25', '#154766', '#4D85B3', '#F5AF00', '#CC6716', '#0C2C4A', '#F0A756', '#434545']

function TurnoverChart({ data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Evolucao do Turnover (6 meses)</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} /><Line type="monotone" dataKey="valor" stroke="#E57B25" strokeWidth={2} dot={{ fill: '#E57B25' }} /></LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function HeadcountChart({ data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Evolucao Headcount (12 meses)</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="total" fill="#154766" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function SetorTipoChart({ data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Funcionarios por Tipo de Setor</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} dataKey="funcionarios" nameKey="tipo" cx="50%" cy="50%" outerRadius={80} label={({ tipo, funcionarios }) => `${tipo}: ${funcionarios}`}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function TempoEmpresaChart({ data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Distribuicao Tempo de Empresa</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="faixa" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="funcionarios" fill="#4D85B3" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function OcorrenciasCategoriaChart({ data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Ocorrencias por Categoria</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} label={({ categoria, total }) => `${categoria}: ${total}`}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// --- Dashboard Charts ---
function SetoreChart() {
  const [data, setData] = useState([])
  const supabase = createClient()
  useEffect(() => {
    supabase.from('vw_resumo_setores').select('titulo, total_funcionarios').order('total_funcionarios', { ascending: false }).limit(10).then(({ data: d }) => {
      setData((d || []).map((s) => ({ name: s.titulo?.slice(0, 20) || '', valor: s.total_funcionarios || 0 })))
    })
  }, [])
  if (!data.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Funcionarios por Setor</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} /><Tooltip /><Bar dataKey="valor" fill="#154766" radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function AdmissoesChart() {
  const [data, setData] = useState([])
  const supabase = createClient()
  useEffect(() => {
    supabase.from('funcionarios').select('data_admissao').eq('status', 'Ativo').then(({ data: d }) => {
      const months = {}
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = format(m, 'MMM/yy', { locale: ptBR })
        months[key] = 0
      }
      ;(d || []).forEach((f) => {
        if (!f.data_admissao) return
        const m = new Date(f.data_admissao + 'T00:00:00')
        const key = format(m, 'MMM/yy', { locale: ptBR })
        if (key in months) months[key]++
      })
      setData(Object.entries(months).map(([mes, total]) => ({ mes, total })))
    })
  }, [])
  if (!data.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Admissoes por Mes</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="mes" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="total" fill="#E57B25" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// --- Financeiro Components ---
function FolhaResumoCards({ resumo }) {
  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Bruto" value={fmt(resumo.totalBruto)} icon={<DollarSign size={24} />} color="text-laranja" />
      <StatCard title="Total Liquido" value={fmt(resumo.totalLiquido)} icon={<Wallet size={24} />} color="text-azul" />
      <StatCard title="Custo Total" value={fmt(resumo.custoTotal)} icon={<TrendingUp size={24} />} color="text-amber-500" />
      <StatCard title="Total Funcionarios" value={resumo.totalFuncionarios} icon={<Users size={24} />} color="text-green-500" />
    </div>
  )
}

function SalarioChart({ salarios }) {
  const data = [...salarios].reverse().map((s) => ({
    data: s.data_vigencia ? format(new Date(s.data_vigencia + 'T00:00:00'), 'MM/yyyy') : '',
    'Bruto': s.salario_bruto || 0,
    'Liquido': s.salario_liquido || 0,
  }))
  return (
    <Card>
      <CardHeader><CardTitle>Evolucao Salarial</CardTitle></CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="data" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /><Legend /><Line type="monotone" dataKey="Bruto" stroke="#E57B25" strokeWidth={2} /><Line type="monotone" dataKey="Liquido" stroke="#154766" strokeWidth={2} /></LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function ResumoMensal({ transacoes, mesLabel }) {
  const creditos = transacoes.filter((t) => t.natureza === 'Credito').reduce((s, t) => s + (t.valor || 0), 0)
  const debitos = transacoes.filter((t) => t.natureza === 'Debito').reduce((s, t) => s + (t.valor || 0), 0)
  const saldo = creditos - debitos
  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <Card>
      <CardHeader><CardTitle>Resumo - {mesLabel}</CardTitle></CardHeader>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center"><p className="text-sm text-cinza-estrutural">Creditos</p><p className="text-lg font-bold text-green-600">{fmt(creditos)}</p></div>
        <div className="text-center"><p className="text-sm text-cinza-estrutural">Debitos</p><p className="text-lg font-bold text-red-600">{fmt(debitos)}</p></div>
        <div className="text-center"><p className="text-sm text-cinza-estrutural">Saldo</p><p className={`text-lg font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(saldo)}</p></div>
      </div>
    </Card>
  )
}

// --- Form Components (Modais) ---
function SalarioForm({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ salario_bruto: '', salario_liquido: '', custo_funcionario: '', data_vigencia: '', observacao: '' })
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (open) setForm({
      salario_bruto: initial?.salario_bruto?.toString() || '',
      salario_liquido: initial?.salario_liquido?.toString() || '',
      custo_funcionario: initial?.custo_funcionario?.toString() || '',
      data_vigencia: initial?.data_vigencia || '',
      observacao: initial?.observacao || '',
    })
  }, [open, initial])
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try {
      await onSubmit({ salario_bruto: parseFloat(form.salario_bruto) || 0, salario_liquido: parseFloat(form.salario_liquido) || null, custo_funcionario: parseFloat(form.custo_funcionario) || null, data_vigencia: form.data_vigencia, observacao: form.observacao || null })
      onClose()
    } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar Salario' : 'Novo Salario'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Salario Bruto *" type="number" step="0.01" value={form.salario_bruto} onChange={(e) => setForm({ ...form, salario_bruto: e.target.value })} />
          <Input label="Salario Liquido" type="number" step="0.01" value={form.salario_liquido} onChange={(e) => setForm({ ...form, salario_liquido: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Custo Funcionario" type="number" step="0.01" value={form.custo_funcionario} onChange={(e) => setForm({ ...form, custo_funcionario: e.target.value })} />
          <Input label="Data Vigencia *" type="date" value={form.data_vigencia} onChange={(e) => setForm({ ...form, data_vigencia: e.target.value })} />
        </div>
        <Input label="Observacao" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.salario_bruto || !form.data_vigencia}>{submitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function TransacaoForm({ open, onClose, onSubmit, tipos = [], initial }) {
  const [form, setForm] = useState({ tipo_transacao_id: '', valor: '', data: '', descricao: '' })
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (open) setForm({ tipo_transacao_id: initial?.tipo_transacao_id || '', valor: initial?.valor?.toString() || '', data: initial?.data || '', descricao: initial?.descricao || '' })
  }, [open, initial])
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try {
      await onSubmit({ tipo_transacao_id: form.tipo_transacao_id, valor: parseFloat(form.valor) || 0, data: form.data, descricao: form.descricao || null })
      onClose()
    } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar Transacao' : 'Nova Transacao'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Tipo *" value={form.tipo_transacao_id} onChange={(e) => setForm({ ...form, tipo_transacao_id: e.target.value })} options={tipos.map((t) => ({ value: t.id, label: t.titulo }))} placeholder="Selecione" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Valor *" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          <Input label="Data *" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </div>
        <Input label="Descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function TipoTransacaoForm({ open, onClose, onSubmit }) {
  const [titulo, setTitulo] = useState('')
  const [natureza, setNatureza] = useState('Credito')
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => { if (open) { setTitulo(''); setNatureza('Credito') } }, [open])
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try { await onSubmit({ titulo, natureza }); onClose() } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Cadastrar Tipo de Transacao">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Titulo *" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Select label="Natureza *" value={natureza} onChange={(e) => setNatureza(e.target.value)} options={[{ value: 'Credito', label: 'Credito' }, { value: 'Debito', label: 'Debito' }]} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !titulo}>{submitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function FeriasFormModal({ open, onClose, onSubmit }) {
  const supabase = createClient()
  const [funcionarios, setFuncionarios] = useState([])
  const [form, setForm] = useState({ funcionario_id: '', data_inicio: '', data_fim: '', dias: 30, tipo: 'Gozo', abono_pecuniario: false, dias_vendidos: 0, observacao: '' })
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => { if (open) supabase.from('funcionarios').select('id, nome_completo, codigo').eq('status', 'Ativo').order('nome_completo').then(({ data }) => setFuncionarios(data || [])) }, [open])
  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const d = differenceInCalendarDays(new Date(form.data_fim + 'T00:00:00'), new Date(form.data_inicio + 'T00:00:00')) + 1
      setForm((p) => ({ ...p, dias: d > 0 ? d : 1 }))
    }
  }, [form.data_inicio, form.data_fim])
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try { await onSubmit(form); setForm({ funcionario_id: '', data_inicio: '', data_fim: '', dias: 30, tipo: 'Gozo', abono_pecuniario: false, dias_vendidos: 0, observacao: '' }); onClose() } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Adicionar Ferias" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Autocomplete label="Funcionario *" placeholder="Buscar funcionario..." options={funcionarios.map((f) => ({ value: f.id, label: f.nome_completo, sublabel: f.codigo ? `Cod: ${f.codigo}` : '' }))} value={form.funcionario_id} onChange={(v) => setForm({ ...form, funcionario_id: v })} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Data Inicio *" type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          <Input label="Data Fim *" type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          <Input label="Dias" type="number" value={form.dias} onChange={(e) => setForm({ ...form, dias: parseInt(e.target.value) || 0 })} />
        </div>
        <Input label="Observacao" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.funcionario_id || !form.data_inicio || !form.data_fim}>{submitting ? 'Salvando...' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function FeriasColetivasFormModal({ open, onClose, onSubmit }) {
  const supabase = createClient()
  const [unidades, setUnidades] = useState([])
  const [setores, setSetores] = useState([])
  const [form, setForm] = useState({ titulo: '', data_inicio: '', data_fim: '', dias: 0, unidade_id: '', setor_id: '', observacao: '' })
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (open) {
      Promise.all([supabase.from('unidades').select('id, titulo').order('titulo'), supabase.from('setores').select('id, titulo').order('titulo')]).then(([u, s]) => { setUnidades(u.data || []); setSetores(s.data || []) })
    }
  }, [open])
  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const d = differenceInCalendarDays(new Date(form.data_fim + 'T00:00:00'), new Date(form.data_inicio + 'T00:00:00')) + 1
      setForm((p) => ({ ...p, dias: d > 0 ? d : 0 }))
    }
  }, [form.data_inicio, form.data_fim])
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try { await onSubmit(form); onClose() } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Registrar Ferias Coletivas" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Titulo *" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Data Inicio *" type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          <Input label="Data Fim *" type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          <Input label="Dias *" type="number" value={form.dias} onChange={(e) => setForm({ ...form, dias: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Unidade" value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })} options={unidades.map((u) => ({ value: u.id, label: u.titulo }))} placeholder="Todas" />
          <Select label="Setor" value={form.setor_id} onChange={(e) => setForm({ ...form, setor_id: e.target.value })} options={setores.map((s) => ({ value: s.id, label: s.titulo }))} placeholder="Todos" />
        </div>
        <Input label="Observacao" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.titulo || !form.data_inicio || !form.data_fim}>{submitting ? 'Salvando...' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function OcorrenciaFormModal({ open, onClose, onSubmit, tipos = [] }) {
  const supabase = createClient()
  const [funcionarios, setFuncionarios] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ funcionario_id: '', tipo_ocorrencia_id: '', descricao: '', data_inicio: '', data_fim: '', dias: 1, valor: null, arquivo_url: null, observacao: '' })
  useEffect(() => { if (open) supabase.from('funcionarios').select('id, nome_completo, codigo').eq('status', 'Ativo').order('nome_completo').then(({ data }) => setFuncionarios(data || [])) }, [open])
  useEffect(() => {
    if (form.data_inicio && form.data_fim) {
      const d = differenceInCalendarDays(new Date(form.data_fim + 'T00:00:00'), new Date(form.data_inicio + 'T00:00:00')) + 1
      setForm((p) => ({ ...p, dias: d > 0 ? d : 1 }))
    }
  }, [form.data_inicio, form.data_fim])
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]; if (!file || !form.funcionario_id) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop(); const path = `atestados/${form.funcionario_id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('arquivos-rh').upload(path, file)
      if (!error) { const { data: urlData } = supabase.storage.from('arquivos-rh').getPublicUrl(path); setForm({ ...form, arquivo_url: urlData.publicUrl }) }
    } finally { setUploading(false) }
  }
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try { await onSubmit(form); setForm({ funcionario_id: '', tipo_ocorrencia_id: '', descricao: '', data_inicio: '', data_fim: '', dias: 1, valor: null, arquivo_url: null, observacao: '' }); onClose() } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Registrar Ocorrencia" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Autocomplete label="Funcionario *" placeholder="Buscar funcionario..." options={funcionarios.map((f) => ({ value: f.id, label: f.nome_completo, sublabel: f.codigo ? `Cod: ${f.codigo}` : '' }))} value={form.funcionario_id} onChange={(v) => setForm({ ...form, funcionario_id: v })} />
        <Select label="Tipo de Ocorrencia *" value={form.tipo_ocorrencia_id} onChange={(e) => setForm({ ...form, tipo_ocorrencia_id: e.target.value })} options={tipos.map((t) => ({ value: t.id, label: t.titulo }))} placeholder="Selecione" />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Data Inicio *" type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          <Input label="Data Fim" type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          <Input label="Dias" type="number" value={form.dias} onChange={(e) => setForm({ ...form, dias: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Valor (R$)" type="number" value={form.valor || ''} onChange={(e) => setForm({ ...form, valor: e.target.value ? parseFloat(e.target.value) : null })} />
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Arquivo</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-estrutural hover:bg-gray-50 cursor-pointer">
              <Upload size={16} />{uploading ? 'Enviando...' : form.arquivo_url ? 'Arquivo anexado' : 'Selecionar arquivo'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || !form.funcionario_id} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.funcionario_id || !form.tipo_ocorrencia_id || !form.data_inicio}>{submitting ? 'Salvando...' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function TipoOcorrenciaFormModal({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ titulo: '', categoria: 'Ausencia', cor: '#3B82F6' })
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => { if (open) setForm({ titulo: initial?.titulo || '', categoria: initial?.categoria || 'Ausencia', cor: initial?.cor || '#3B82F6' }) }, [open, initial])
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    try { await onSubmit(form); onClose() } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Tipo de Ocorrencia' : 'Cadastrar Tipo de Ocorrencia'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Titulo *" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Atestado Medico" />
        <Select label="Categoria *" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} options={[{ value: 'Remuneracao', label: 'Remuneracao' }, { value: 'Ausencia', label: 'Ausencia' }, { value: 'Disciplinar', label: 'Disciplinar' }, { value: 'Beneficio', label: 'Beneficio' }, { value: 'Outro', label: 'Outro' }]} />
        <ColorPicker label="Cor" value={form.cor} onChange={(cor) => setForm({ ...form, cor })} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !form.titulo}>{submitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

function useIndicadores() {
  const supabase = createClient()
  const loadIndicadores = useCallback(async () => {
    const now = new Date()
    const anoAtual = now.getFullYear()
    const mesAtual = now.getMonth() + 1
    const result = { turnover: 0, turnoverHistorico: [], absenteismo: 0, tempoMedioEmpresa: 'N/A', tempoMedioDias: 0, custoMedioPorFuncionario: 0, headcountHistorico: [], distribuicaoTipoSetor: [], faixasTempoEmpresa: [], ocorrenciasPorCategoria: [] }
    try {
      const { data: funcs } = await supabase.from('funcionarios').select('id, status, data_admissao, data_desligamento')
      const ativos = (funcs || []).filter((f) => f.status === 'Ativo')
      const desligados12m = (funcs || []).filter((f) => { if (!f.data_desligamento) return false; const d = new Date(f.data_desligamento); return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 365 })
      if (ativos.length > 0) result.turnover = (desligados12m.length / ativos.length) * 100

      // Tempo medio
      const temposDias = ativos.map((f) => f.data_admissao ? Math.floor((now.getTime() - new Date(f.data_admissao + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) : 0).filter((d) => d > 0)
      if (temposDias.length > 0) {
        const media = temposDias.reduce((s, d) => s + d, 0) / temposDias.length
        result.tempoMedioDias = Math.round(media)
        const anos = Math.floor(media / 365); const meses = Math.floor((media % 365) / 30)
        result.tempoMedioEmpresa = anos > 0 ? `${anos}a ${meses}m` : `${meses}m`
      }

      // Custo medio
      const { data: salarios } = await supabase.from('vw_salario_atual').select('custo_funcionario')
      if (salarios?.length) { const total = salarios.reduce((s, r) => s + (r.custo_funcionario || 0), 0); result.custoMedioPorFuncionario = total / salarios.length }

      // Absenteismo
      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`
      const fimMes = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0]
      const { data: ocorrencias } = await supabase.from('ocorrencias').select('dias').gte('data_inicio', inicioMes).lte('data_inicio', fimMes)
      const diasAusencia = (ocorrencias || []).reduce((s, o) => s + (o.dias || 0), 0)
      const diasUteis = 22
      if (ativos.length > 0) result.absenteismo = (diasAusencia / (ativos.length * diasUteis)) * 100

      // Historico turnover
      for (let i = 5; i >= 0; i--) {
        const m = new Date(anoAtual, mesAtual - 1 - i, 1)
        const mes = format(m, 'MMM/yy', { locale: ptBR })
        const deslig = (funcs || []).filter((f) => { if (!f.data_desligamento) return false; const d = new Date(f.data_desligamento); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear() })
        result.turnoverHistorico.push({ mes, valor: ativos.length > 0 ? (deslig.length / ativos.length) * 100 : 0 })
      }

      // Headcount historico
      for (let i = 11; i >= 0; i--) {
        const m = new Date(anoAtual, mesAtual - 1 - i, 1)
        const mes = format(m, 'MMM/yy', { locale: ptBR })
        const total = (funcs || []).filter((f) => { const adm = f.data_admissao ? new Date(f.data_admissao) : null; const desl = f.data_desligamento ? new Date(f.data_desligamento) : null; if (!adm || adm > m) return false; if (desl && desl < m) return false; return true }).length
        result.headcountHistorico.push({ mes, total })
      }

      // Distribuicao por tipo setor
      const { data: setoresData } = await supabase.from('vw_resumo_setores').select('tipo, total_funcionarios')
      const tipoMap = {}
      ;(setoresData || []).forEach((s) => { const tipo = s.tipo || 'Sem tipo'; tipoMap[tipo] = (tipoMap[tipo] || 0) + (s.total_funcionarios || 0) })
      result.distribuicaoTipoSetor = Object.entries(tipoMap).map(([tipo, funcionarios]) => ({ tipo, funcionarios }))

      // Faixas tempo empresa
      const faixas = { '< 1 ano': 0, '1-2 anos': 0, '2-5 anos': 0, '5-10 anos': 0, '> 10 anos': 0 }
      temposDias.forEach((d) => {
        if (d < 365) faixas['< 1 ano']++; else if (d < 730) faixas['1-2 anos']++; else if (d < 1825) faixas['2-5 anos']++; else if (d < 3650) faixas['5-10 anos']++; else faixas['> 10 anos']++
      })
      result.faixasTempoEmpresa = Object.entries(faixas).map(([faixa, funcionarios]) => ({ faixa, funcionarios }))

      // Ocorrencias por categoria
      const { data: tiposOc } = await supabase.from('tipos_ocorrencia').select('id, categoria')
      const { data: ocAll } = await supabase.from('ocorrencias').select('tipo_ocorrencia_id')
      const catMap = {}
      ;(ocAll || []).forEach((o) => {
        const tipo = (tiposOc || []).find((t) => t.id === o.tipo_ocorrencia_id)
        const cat = tipo?.categoria || 'Outro'
        catMap[cat] = (catMap[cat] || 0) + 1
      })
      result.ocorrenciasPorCategoria = Object.entries(catMap).map(([categoria, total]) => ({ categoria, total }))
    } catch (err) { console.error('Erro indicadores:', err) }
    return result
  }, [])
  return { loadIndicadores }
}

function useFerias() {
  const supabase = createClient()
  const loadFeriasAVencer = useCallback(async () => {
    const { data } = await supabase.from('vw_ferias_a_vencer').select('*').order('dias_para_vencer')
    return data || []
  }, [])
  const loadProximasFerias = useCallback(async () => {
    const { data } = await supabase.from('vw_proximas_ferias').select('*').order('data_inicio')
    return data || []
  }, [])
  const loadFeriasColetivas = useCallback(async () => {
    const { data } = await supabase.from('ferias_coletivas').select('*, unidades(titulo), setores(titulo)').order('data_inicio', { ascending: false })
    return (data || []).map((fc) => ({ ...fc, unidade_nome: fc.unidades?.titulo, setor_nome: fc.setores?.titulo }))
  }, [])
  const createFerias = useCallback(async (payload) => {
    const { error } = await supabase.from('ferias').insert({ ...payload, status: 'Programada' })
    if (error) toast.error('Erro: ' + error.message); else toast.success('Ferias registradas')
  }, [])
  const createFeriasColetivas = useCallback(async (payload) => {
    const { error } = await supabase.from('ferias_coletivas').insert(payload)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Ferias coletivas registradas')
  }, [])
  const deleteFeriasColetivas = useCallback(async (id) => {
    const { error } = await supabase.from('ferias_coletivas').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Ferias coletivas excluidas')
  }, [])
  return { loadFeriasAVencer, loadProximasFerias, loadFeriasColetivas, createFerias, createFeriasColetivas, deleteFeriasColetivas }
}

function useOcorrencias() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const loadTipos = useCallback(async () => {
    const { data } = await supabase.from('tipos_ocorrencia').select('*').order('titulo')
    return data || []
  }, [])
  const createTipo = useCallback(async (payload) => {
    const { error } = await supabase.from('tipos_ocorrencia').insert(payload)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Tipo criado')
  }, [])
  const updateTipo = useCallback(async (id, payload) => {
    const { error } = await supabase.from('tipos_ocorrencia').update(payload).eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Tipo atualizado')
  }, [])
  const deleteTipo = useCallback(async (id) => {
    const { error } = await supabase.from('tipos_ocorrencia').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Tipo excluido')
  }, [])
  const loadOcorrencias = useCallback(async (filters = {}) => {
    let query = supabase.from('ocorrencias').select('*, tipos_ocorrencia(titulo, categoria, cor), funcionarios(nome_completo, codigo)').order('data_inicio', { ascending: false })
    if (filters.tipo_id) query = query.eq('tipo_ocorrencia_id', filters.tipo_id)
    if (filters.data_inicio) query = query.gte('data_inicio', filters.data_inicio)
    if (filters.data_fim) query = query.lte('data_inicio', filters.data_fim)
    const { data } = await query
    return (data || []).map((o) => ({ ...o, tipo_titulo: o.tipos_ocorrencia?.titulo, tipo_cor: o.tipos_ocorrencia?.cor, funcionario_nome: o.funcionarios?.nome_completo, funcionario_codigo: o.funcionarios?.codigo }))
  }, [])
  const createOcorrencia = useCallback(async (payload) => {
    const { error } = await supabase.from('ocorrencias').insert(payload)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Ocorrencia registrada')
  }, [])
  const deleteOcorrencia = useCallback(async (id) => {
    const { error } = await supabase.from('ocorrencias').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Ocorrencia excluida')
  }, [])
  const uploadArquivo = useCallback(async (funcionarioId, file) => {
    const ext = file.name.split('.').pop(); const path = `atestados/${funcionarioId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos-rh').upload(path, file)
    if (error) { toast.error('Erro upload: ' + error.message); return null }
    const { data } = supabase.storage.from('arquivos-rh').getPublicUrl(path)
    return data.publicUrl
  }, [])
  return { loading, loadTipos, createTipo, updateTipo, deleteTipo, loadOcorrencias, createOcorrencia, deleteOcorrencia, uploadArquivo }
}

function useFinanceiro() {
  const supabase = createClient()
  const loadSalarios = useCallback(async (funcId) => {
    const { data } = await supabase.from('salarios').select('*').eq('funcionario_id', funcId).order('data_vigencia', { ascending: false })
    return data || []
  }, [])
  const loadSalarioAtual = useCallback(async (funcId) => {
    const { data } = await supabase.from('vw_salario_atual').select('*').eq('funcionario_id', funcId).single()
    return data
  }, [])
  const createSalario = useCallback(async (payload) => {
    const { error } = await supabase.from('salarios').insert(payload)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Salario registrado')
  }, [])
  const updateSalario = useCallback(async (id, payload) => {
    const { error } = await supabase.from('salarios').update(payload).eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Salario atualizado')
  }, [])
  const deleteSalario = useCallback(async (id) => {
    const { error } = await supabase.from('salarios').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Salario excluido')
  }, [])
  const loadTransacoes = useCallback(async (funcId, filters = {}) => {
    let query = supabase.from('transacoes').select('*, tipos_transacao(titulo, natureza)').eq('funcionario_id', funcId).order('data', { ascending: false })
    if (filters.data_inicio) query = query.gte('data', filters.data_inicio)
    if (filters.data_fim) query = query.lte('data', filters.data_fim)
    if (filters.tipo_transacao_id) query = query.eq('tipo_transacao_id', filters.tipo_transacao_id)
    const { data } = await query
    let result = (data || []).map((t) => ({ ...t, tipo_titulo: t.tipos_transacao?.titulo, natureza: t.tipos_transacao?.natureza }))
    if (filters.natureza && filters.natureza !== 'Todos') result = result.filter((t) => t.natureza === filters.natureza)
    return result
  }, [])
  const createTransacao = useCallback(async (payload) => {
    const { error } = await supabase.from('transacoes').insert(payload)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Transacao criada')
  }, [])
  const updateTransacao = useCallback(async (id, payload) => {
    const { error } = await supabase.from('transacoes').update(payload).eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Transacao atualizada')
  }, [])
  const deleteTransacao = useCallback(async (id) => {
    const { error } = await supabase.from('transacoes').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Transacao excluida')
  }, [])
  return { loadSalarios, loadSalarioAtual, createSalario, updateSalario, deleteSalario, loadTransacoes, createTransacao, updateTransacao, deleteTransacao }
}

function useFolha() {
  const supabase = createClient()
  const loadResumoGeral = useCallback(async () => {
    const { data } = await supabase.from('vw_salario_atual').select('salario_bruto, salario_liquido, custo_funcionario')
    const items = data || []
    return {
      totalBruto: items.reduce((s, r) => s + (r.salario_bruto || 0), 0),
      totalLiquido: items.reduce((s, r) => s + (r.salario_liquido || 0), 0),
      custoTotal: items.reduce((s, r) => s + (r.custo_funcionario || 0), 0),
      totalFuncionarios: items.length,
    }
  }, [])
  const loadFolhaPorUnidade = useCallback(async () => {
    const { data } = await supabase.from('vw_salario_atual').select('*, funcionarios(unidade_id, unidades(id, titulo))')
    const grouped = {}
    ;(data || []).forEach((r) => {
      const uid = r.funcionarios?.unidade_id || 'sem'; const titulo = r.funcionarios?.unidades?.titulo || 'Sem Unidade'
      if (!grouped[uid]) grouped[uid] = { unidade_id: uid, unidade_titulo: titulo, num_funcionarios: 0, total_bruto: 0, total_liquido: 0, custo_total: 0 }
      grouped[uid].num_funcionarios++; grouped[uid].total_bruto += r.salario_bruto || 0; grouped[uid].total_liquido += r.salario_liquido || 0; grouped[uid].custo_total += r.custo_funcionario || 0
    })
    return Object.values(grouped)
  }, [])
  const loadFolhaPorSetor = useCallback(async () => {
    const { data } = await supabase.from('vw_salario_atual').select('*, funcionarios(setor_id, setores(id, titulo), unidade_id, unidades(titulo))')
    const grouped = {}
    ;(data || []).forEach((r) => {
      const sid = r.funcionarios?.setor_id || 'sem'; const titulo = r.funcionarios?.setores?.titulo || 'Sem Setor'
      if (!grouped[sid]) grouped[sid] = { setor_id: sid, setor_titulo: titulo, unidade_titulo: r.funcionarios?.unidades?.titulo || '', num_funcionarios: 0, total_bruto: 0 }
      grouped[sid].num_funcionarios++; grouped[sid].total_bruto += r.salario_bruto || 0
    })
    return Object.values(grouped)
  }, [])
  const loadTopSalarios = useCallback(async (limit = 10) => {
    const { data } = await supabase.from('vw_salario_atual').select('*, funcionarios(id, nome_completo, funcao_id, setor_id, funcoes(titulo), setores(titulo))').order('salario_bruto', { ascending: false }).limit(limit)
    return (data || []).map((r) => ({ funcionario_id: r.funcionario_id, nome_completo: r.funcionarios?.nome_completo, funcao_titulo: r.funcionarios?.funcoes?.titulo, setor_titulo: r.funcionarios?.setores?.titulo, salario_bruto: r.salario_bruto }))
  }, [])
  return { loadResumoGeral, loadFolhaPorUnidade, loadFolhaPorSetor, loadTopSalarios }
}

function useTiposTransacao() {
  const supabase = createClient()
  const loadTipos = useCallback(async () => {
    const { data } = await supabase.from('tipos_transacao').select('*').order('titulo')
    return data || []
  }, [])
  const createTipo = useCallback(async (payload) => {
    const { error } = await supabase.from('tipos_transacao').insert(payload)
    if (error) toast.error('Erro: ' + error.message); else toast.success('Tipo criado')
  }, [])
  return { loadTipos, createTipo }
}

function usePagination(items, options = {}) {
  const { pageSize = 20 } = options
  const [currentPage, setCurrentPage] = useState(1)
  const totalItems = items.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const paginatedItems = useMemo(() => items.slice((currentPage - 1) * pageSize, currentPage * pageSize), [items, currentPage, pageSize])
  const goToPage = useCallback((page) => setCurrentPage(Math.max(1, Math.min(page, totalPages || 1))), [totalPages])
  const resetPage = useCallback(() => setCurrentPage(1), [])
  return { currentPage, totalItems, totalPages, pageSize, paginatedItems, goToPage, resetPage }
}


// ============================================================================
// PAGES
// ============================================================================

// --- Dashboard Page ---
function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [indicadores, setIndicadores] = useState(null)
  const [indicadoresLoading, setIndicadoresLoading] = useState(true)
  const supabase = createClient()
  const { loadIndicadores } = useIndicadores()

  useEffect(() => { loadDashboard(); loadInd() }, [])

  async function loadInd() {
    setIndicadoresLoading(true)
    try { setIndicadores(await loadIndicadores()) } catch (e) { console.error(e) } finally { setIndicadoresLoading(false) }
  }

  async function loadDashboard() {
    try {
      const now = new Date(); const mesAtual = now.getMonth() + 1; const anoAtual = now.getFullYear()
      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`
      const fimMes = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0]
      const [ativosRes, feriasRes, ocorrenciasRes, feriasVencerRes, proximasFeriasRes, anivRes, admRes] = await Promise.all([
        supabase.from('funcionarios').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
        supabase.from('ferias').select('id', { count: 'exact', head: true }).eq('status', 'Em Andamento'),
        supabase.from('ocorrencias').select('id', { count: 'exact', head: true }).gte('data_inicio', inicioMes).lte('data_inicio', fimMes),
        supabase.from('vw_ferias_a_vencer').select('id', { count: 'exact', head: true }).in('situacao', ['ALERTA', 'VENCIDA']),
        supabase.from('vw_proximas_ferias').select('*').limit(5),
        supabase.from('funcionarios').select('id, nome, data_nascimento, foto_url').eq('status', 'Ativo'),
        supabase.from('funcionarios').select('id, nome, data_admissao, foto_url').eq('status', 'Ativo').gte('data_admissao', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).order('data_admissao', { ascending: false }).limit(5),
      ])
      const aniversariantes = (anivRes.data || []).filter((f) => { if (!f.data_nascimento) return false; return parseInt(f.data_nascimento.split('-')[1], 10) === mesAtual }).slice(0, 5)
      setData({
        totalAtivos: ativosRes.count || 0, emFerias: feriasRes.count || 0, ocorrenciasMes: ocorrenciasRes.count || 0, feriasVencer: feriasVencerRes.count || 0,
        proximasFerias: (proximasFeriasRes.data || []).map((f) => ({ id: f.id || f.funcionario_id, nome: f.nome || f.funcionario_nome, inicio: f.data_inicio || f.inicio, fim: f.data_fim || f.fim })),
        aniversariantes, admissoesRecentes: (admRes.data || []).map((f) => ({ id: f.id, nome: f.nome, data_admissao: f.data_admissao, foto_url: f.foto_url })),
      })
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Bem-vindo ao IW8 RH</h2>
        <p className="text-cinza-estrutural capitalize">{hoje}</p>
      </div>
      {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[0,1,2,3].map((i) => <CardSkeleton key={i} />)}</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Funcionarios Ativos" value={data?.totalAtivos || 0} icon={<Users size={24} />} color="text-azul-medio" />
          <StatCard title="Em Ferias" value={data?.emFerias || 0} icon={<Palmtree size={24} />} color="text-green-500" />
          <StatCard title="Ocorrencias no Mes" value={data?.ocorrenciasMes || 0} icon={<AlertTriangle size={24} />} color="text-amarelo" />
          <StatCard title="Ferias a Vencer" value={data?.feriasVencer || 0} icon={<CalendarClock size={24} />} color="text-red-500" />
        </div>
      )}
      {indicadoresLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[0,1,2,3].map((i) => <CardSkeleton key={i} />)}</div> : indicadores ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <TurnoverCard valor={indicadores.turnover} historico={indicadores.turnoverHistorico} />
          <AbsenteismoCard valor={indicadores.absenteismo} />
          <TempoEmpresaCard tempo={indicadores.tempoMedioEmpresa} />
          <CustoMedioCard valor={indicadores.custoMedioPorFuncionario} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle><div className="flex items-center gap-2"><Palmtree size={18} className="text-azul-medio" />Proximas Ferias</div></CardTitle></CardHeader>
          {data?.proximasFerias?.length > 0 ? data.proximasFerias.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm font-medium text-cinza-preto">{f.nome}</span>
              <span className="text-xs text-cinza-estrutural">{f.inicio && format(new Date(f.inicio + 'T00:00:00'), 'dd/MM')} - {f.fim && format(new Date(f.fim + 'T00:00:00'), 'dd/MM')}</span>
            </div>
          )) : <p className="text-sm text-cinza-estrutural">Nenhuma ferias programada</p>}
        </Card>
        <Card><CardHeader><CardTitle><div className="flex items-center gap-2"><Cake size={18} className="text-laranja" />Aniversariantes do Mes</div></CardTitle></CardHeader>
          {data?.aniversariantes?.length > 0 ? data.aniversariantes.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <Avatar src={f.foto_url} name={f.nome} size="sm" />
              <div><p className="text-sm font-medium text-cinza-preto">{f.nome}</p><p className="text-xs text-cinza-estrutural">{f.data_nascimento && format(new Date(f.data_nascimento + 'T00:00:00'), 'dd/MM')}</p></div>
            </div>
          )) : <p className="text-sm text-cinza-estrutural">Nenhum aniversariante este mes</p>}
        </Card>
        <Card><CardHeader><CardTitle><div className="flex items-center gap-2"><UserPlus size={18} className="text-green-500" />Admissoes Recentes</div></CardTitle></CardHeader>
          {data?.admissoesRecentes?.length > 0 ? data.admissoesRecentes.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <Avatar src={f.foto_url} name={f.nome} size="sm" />
              <div><p className="text-sm font-medium text-cinza-preto">{f.nome}</p><p className="text-xs text-cinza-estrutural">{f.data_admissao && format(new Date(f.data_admissao + 'T00:00:00'), 'dd/MM/yyyy')}</p></div>
            </div>
          )) : <p className="text-sm text-cinza-estrutural">Nenhuma admissao nos ultimos 30 dias</p>}
        </Card>
      </div>
      {indicadores && !indicadoresLoading && (
        <>
          <div className="mt-8 mb-4"><h3 className="text-lg font-bold text-cinza-preto flex items-center gap-2"><BarChart3 size={20} className="text-azul-medio" />Indicadores Estrategicos</h3></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TurnoverChart data={indicadores.turnoverHistorico} />
            <HeadcountChart data={indicadores.headcountHistorico} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <SetorTipoChart data={indicadores.distribuicaoTipoSetor} />
            <TempoEmpresaChart data={indicadores.faixasTempoEmpresa} />
            <OcorrenciasCategoriaChart data={indicadores.ocorrenciasPorCategoria} />
          </div>
        </>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <SetoreChart />
        <AdmissoesChart />
      </div>
    </PageContainer>
  )
}

// --- Funcionarios Page ---
function FuncionariosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [funcionarios, setFuncionarios] = useState([])
  const [unidades, setUnidades] = useState([])
  const [setores, setSetores] = useState([])
  const [funcoes, setFuncoes] = useState([])
  const [statusFilter, setStatusFilter] = useState('Ativo')
  const [search, setSearch] = useState('')
  const [unidadeFilter, setUnidadeFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      let funcData = []
      const viewRes = await supabase.from('vw_funcionarios_completo').select('*').order('nome')
      if (viewRes.error) {
        const tableRes = await supabase.from('funcionarios').select('*, unidades(id, titulo), setores(id, titulo), funcoes(id, titulo)').order('nome_completo')
        funcData = (tableRes.data || []).map((f) => ({ id: f.id, nome: f.nome_completo || f.nome, codigo: f.codigo, cpf: f.cpf, status: f.status || 'Ativo', foto_url: f.foto_url, unidade_id: f.unidade_id, setor_id: f.setor_id, funcao_id: f.funcao_id, unidade_titulo: f.unidades?.titulo, setor_titulo: f.setores?.titulo, funcao_titulo: f.funcoes?.titulo }))
      } else {
        funcData = (viewRes.data || []).map((f) => ({ id: f.id, nome: f.nome, codigo: f.codigo || '', cpf: f.cpf, status: f.status || 'Ativo', foto_url: f.foto_url, unidade_id: f.unidade_id, setor_id: f.setor_id, funcao_id: f.funcao_id, unidade_titulo: f.unidade_titulo || f.unidade, setor_titulo: f.setor_titulo || f.setor, funcao_titulo: f.funcao_titulo || f.funcao }))
      }
      setFuncionarios(funcData)
      const [uniRes, setRes, funRes] = await Promise.all([supabase.from('unidades').select('id, titulo').order('titulo'), supabase.from('setores').select('id, titulo, unidade_id').order('titulo'), supabase.from('funcoes').select('id, titulo, setor_id').order('titulo')])
      setUnidades(uniRes.data || []); setSetores(setRes.data || []); setFuncoes(funRes.data || [])
    } finally { setLoading(false) }
  }

  const filtered = useMemo(() => funcionarios.filter((f) => {
    if (statusFilter !== 'Todos' && f.status !== statusFilter) return false
    if (unidadeFilter && f.unidade_id !== unidadeFilter) return false
    if (setorFilter && f.setor_id !== setorFilter) return false
    if (search) { const s = search.toLowerCase(); if (!(f.nome?.toLowerCase().includes(s) || f.codigo?.toLowerCase().includes(s) || f.cpf?.toLowerCase().includes(s))) return false }
    return true
  }), [funcionarios, statusFilter, search, unidadeFilter, setorFilter])

  const grouped = useMemo(() => {
    const groups = {}
    for (const f of filtered) { const key = f.unidade_titulo || 'Sem Unidade'; if (!groups[key]) groups[key] = []; groups[key].push(f) }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  function toggleGroup(name) { setCollapsedGroups((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next }) }

  const filteredSetores = unidadeFilter ? setores.filter((s) => s.unidade_id === unidadeFilter) : setores

  async function handleNovoFuncionario(data) {
    const payload = { nome_completo: data.nome, codigo: data.codigo || null, cpf: data.cpf || null, data_nascimento: data.data_nascimento || null, data_admissao: data.data_admissao || null, unidade_id: data.unidade_id || null, setor_id: data.setor_id || null, funcao_id: data.funcao_id || null, status: 'Ativo' }
    const { data: result, error } = await supabase.from('funcionarios').insert(payload).select('id').single()
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Funcionario cadastrado')
    setModalOpen(false)
    if (result?.id) router.push(`/funcionarios/${result.id}`); else loadData()
  }

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Toggle options={[{ value: 'Ativo', label: 'Ativos' }, { value: 'Inativo', label: 'Inativos' }, { value: 'Todos', label: 'Todos' }]} value={statusFilter} onChange={setStatusFilter} />
        <SearchInput placeholder="Buscar por nome, codigo ou CPF..." onSearch={setSearch} className="sm:w-64" />
        <Select options={unidades.map((u) => ({ value: u.id, label: u.titulo }))} placeholder="Todas Unidades" value={unidadeFilter} onChange={(e) => { setUnidadeFilter(e.target.value); setSetorFilter('') }} className="sm:w-48" />
        <Select options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))} placeholder="Todos Setores" value={setorFilter} onChange={(e) => setSetorFilter(e.target.value)} className="sm:w-48" />
        <div className="sm:ml-auto"><Button onClick={() => setModalOpen(true)}><Plus size={16} />Novo Cadastro</Button></div>
      </div>
      {loading ? <TableSkeleton rows={8} /> : filtered.length === 0 ? (
        <Card><EmptyState icon={<Users size={48} />} title="Nenhum funcionario encontrado" description="Ajuste os filtros ou cadastre um novo funcionario" /></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([unidade, funcs]) => (
            <Card key={unidade} className="p-0 overflow-hidden">
              <button onClick={() => toggleGroup(unidade)} className="w-full flex items-center gap-3 px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100">
                {collapsedGroups.has(unidade) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                <span className="font-bold text-cinza-preto">{unidade}</span>
                <Badge variant="info">{funcs.length}</Badge>
              </button>
              {!collapsedGroups.has(unidade) && (
                <Table>
                  <TableHeader><TableHead className="w-12"></TableHead><TableHead>Nome</TableHead><TableHead>Codigo</TableHead><TableHead>Setor</TableHead><TableHead>Funcao</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Acoes</TableHead></TableHeader>
                  <TableBody>
                    {funcs.map((f) => (
                      <TableRow key={f.id} onClick={() => router.push(`/funcionarios/${f.id}`)}>
                        <TableCell><Avatar src={f.foto_url} name={f.nome} size="sm" /></TableCell>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>{f.codigo || '-'}</TableCell>
                        <TableCell>{f.setor_titulo || '-'}</TableCell>
                        <TableCell>{f.funcao_titulo || '-'}</TableCell>
                        <TableCell><Badge variant={f.status === 'Ativo' ? 'success' : 'neutral'}>{f.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => router.push(`/funcionarios/${f.id}`)} className="p-1.5 text-azul-medio hover:bg-blue-50 rounded"><Eye size={16} /></button>
                            <button onClick={() => router.push(`/funcionarios/${f.id}?edit=true`)} className="p-1.5 text-cinza-estrutural hover:bg-gray-100 rounded"><Pencil size={16} /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          ))}
        </div>
      )}
      <NovoFuncionarioModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNovoFuncionario} unidades={unidades} setores={setores} funcoes={funcoes} />
    </PageContainer>
  )
}

function NovoFuncionarioModal({ open, onClose, onSubmit, unidades, setores, funcoes }) {
  const [form, setForm] = useState({ nome: '', codigo: '', cpf: '', data_nascimento: '', data_admissao: '', unidade_id: '', setor_id: '', funcao_id: '' })
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => { if (open) setForm({ nome: '', codigo: '', cpf: '', data_nascimento: '', data_admissao: '', unidade_id: '', setor_id: '', funcao_id: '' }) }, [open])
  const filteredSetores = form.unidade_id ? setores.filter((s) => s.unidade_id === form.unidade_id) : setores
  const filteredFuncoes = form.setor_id ? funcoes.filter((f) => f.setor_id === form.setor_id) : funcoes
  async function handleSubmit(e) {
    e.preventDefault(); if (!form.nome) { toast.error('Nome obrigatorio'); return }
    setSubmitting(true); try { await onSubmit(form) } finally { setSubmitting(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Novo Funcionario" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome Completo *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input label="Codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
          <Input label="Data de Nascimento" type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
          <Input label="Data de Admissao" type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label="Unidade" value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })} options={unidades.map((u) => ({ value: u.id, label: u.titulo }))} placeholder="Selecione" />
          <Select label="Setor" value={form.setor_id} onChange={(e) => setForm({ ...form, setor_id: e.target.value })} options={filteredSetores.map((s) => ({ value: s.id, label: s.titulo }))} placeholder="Selecione" />
          <Select label="Funcao" value={form.funcao_id} onChange={(e) => setForm({ ...form, funcao_id: e.target.value })} options={filteredFuncoes.map((f) => ({ value: f.id, label: f.titulo }))} placeholder="Selecione" />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// --- Ferias Page ---
function FeriasPage() {
  const { loadFeriasAVencer, loadProximasFerias, loadFeriasColetivas, createFerias, createFeriasColetivas, deleteFeriasColetivas } = useFerias()
  const [loading, setLoading] = useState(true)
  const [feriasAVencer, setFeriasAVencer] = useState([])
  const [proximasFerias, setProximasFerias] = useState([])
  const [feriasColetivas, setFeriasColetivas] = useState([])
  const [showFeriasForm, setShowFeriasForm] = useState(false)
  const [showColetivasForm, setShowColetivasForm] = useState(false)

  const loadData = useCallback(async () => { setLoading(true); try { const [av, pf, fc] = await Promise.all([loadFeriasAVencer(), loadProximasFerias(), loadFeriasColetivas()]); setFeriasAVencer(av); setProximasFerias(pf); setFeriasColetivas(fc) } finally { setLoading(false) } }, [])
  useEffect(() => { loadData() }, [])

  function getSituacaoStyle(s) { return s === 'VENCIDA' ? 'bg-red-100 text-red-700' : s === 'ALERTA' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700' }

  if (loading) return <PageContainer><div className="space-y-6">{[0,1,2].map((i) => <CardSkeleton key={i} />)}</div></PageContainer>

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Ferias</h2>
        <Button onClick={() => setShowFeriasForm(true)}><Plus size={16} /> Adicionar Ferias</Button>
      </div>
      <Card className="mb-6"><CardHeader><CardTitle><div className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" />Ferias a Vencer{feriasAVencer.length > 0 && <Badge variant="danger">{feriasAVencer.length}</Badge>}</div></CardTitle></CardHeader>
        {feriasAVencer.length === 0 ? <EmptyState icon={<AlertTriangle size={40} />} title="Nenhum alerta" description="Todos os periodos estao em dia" /> : (
          <Table><TableHeader><TableHead>Nome</TableHead><TableHead>Periodo</TableHead><TableHead>Dias Restantes</TableHead><TableHead>Vencimento</TableHead><TableHead>Situacao</TableHead></TableHeader>
            <TableBody>{feriasAVencer.map((f) => (
              <TableRow key={f.id} className={f.situacao === 'VENCIDA' ? 'bg-red-50' : f.situacao === 'ALERTA' ? 'bg-amber-50' : ''}>
                <TableCell className="font-medium">{f.nome}</TableCell><TableCell>{f.periodo_aquisitivo}</TableCell><TableCell>{f.dias_restantes}</TableCell>
                <TableCell>{format(new Date(f.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                <TableCell><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSituacaoStyle(f.situacao)}`}>{f.situacao}</span></TableCell>
              </TableRow>
            ))}</TableBody></Table>
        )}
      </Card>
      <Card className="mb-6"><CardHeader><CardTitle><div className="flex items-center gap-2"><Calendar size={18} className="text-azul-medio" />Proximas Ferias Programadas</div></CardTitle></CardHeader>
        {proximasFerias.length === 0 ? <EmptyState icon={<Calendar size={40} />} title="Nenhuma ferias programada" /> : (
          <Table><TableHeader><TableHead>Nome</TableHead><TableHead>Unidade</TableHead><TableHead>Data Inicio</TableHead><TableHead>Data Fim</TableHead><TableHead>Dias</TableHead><TableHead>Status</TableHead></TableHeader>
            <TableBody>{proximasFerias.map((f) => (
              <TableRow key={f.id}><TableCell className="font-medium">{f.nome}</TableCell><TableCell>{f.unidade || '-'}</TableCell>
                <TableCell>{format(new Date(f.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell><TableCell>{format(new Date(f.data_fim + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{f.dias}</TableCell><TableCell><Badge variant={f.status === 'Programada' ? 'info' : f.status === 'Em Andamento' ? 'warning' : f.status === 'Concluida' ? 'success' : 'neutral'}>{f.status}</Badge></TableCell>
              </TableRow>
            ))}</TableBody></Table>
        )}
      </Card>
      <Card><CardHeader><div className="flex items-center justify-between w-full"><CardTitle><div className="flex items-center gap-2"><Users size={18} className="text-laranja" />Ferias Coletivas</div></CardTitle><Button variant="secondary" size="sm" onClick={() => setShowColetivasForm(true)}><Plus size={14} /> Registrar</Button></div></CardHeader>
        {feriasColetivas.length === 0 ? <EmptyState icon={<Users size={40} />} title="Nenhuma ferias coletiva" /> : (
          <Table><TableHeader><TableHead>Titulo</TableHead><TableHead>Inicio</TableHead><TableHead>Fim</TableHead><TableHead>Dias</TableHead><TableHead>Unidade</TableHead><TableHead className="w-10"></TableHead></TableHeader>
            <TableBody>{feriasColetivas.map((fc) => (
              <TableRow key={fc.id}><TableCell className="font-medium">{fc.titulo}</TableCell><TableCell>{format(new Date(fc.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell><TableCell>{format(new Date(fc.data_fim + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell><TableCell>{fc.dias}</TableCell><TableCell>{fc.unidade_nome || 'Todas'}</TableCell><TableCell><button onClick={() => { if (confirm('Excluir?')) { deleteFeriasColetivas(fc.id).then(loadData) } }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button></TableCell></TableRow>
            ))}</TableBody></Table>
        )}
      </Card>
      <FeriasFormModal open={showFeriasForm} onClose={() => setShowFeriasForm(false)} onSubmit={async (d) => { await createFerias(d); loadData() }} />
      <FeriasColetivasFormModal open={showColetivasForm} onClose={() => setShowColetivasForm(false)} onSubmit={async (d) => { await createFeriasColetivas(d); loadData() }} />
    </PageContainer>
  )
}

// --- Ocorrencias Page ---
function OcorrenciasPage() {
  const { loadTipos, createTipo, updateTipo, deleteTipo, loadOcorrencias, createOcorrencia, deleteOcorrencia } = useOcorrencias()
  const [loading, setLoading] = useState(true)
  const [tipos, setTipos] = useState([])
  const [ocorrencias, setOcorrencias] = useState([])
  const [showOcForm, setShowOcForm] = useState(false)
  const [showTipoForm, setShowTipoForm] = useState(false)
  const [editingTipo, setEditingTipo] = useState(null)
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  const loadData = useCallback(async () => { setLoading(true); try { const [t, o] = await Promise.all([loadTipos(), loadOcorrencias({ tipo_id: filterTipo || undefined })]); setTipos(t); setOcorrencias(o) } finally { setLoading(false) } }, [filterTipo])
  useEffect(() => { loadData() }, [loadData])

  const filteredOc = filterSearch ? ocorrencias.filter((o) => (o.funcionario_nome || '').toLowerCase().includes(filterSearch.toLowerCase())) : ocorrencias

  if (loading) return <PageContainer><div className="space-y-6">{[0,1].map((i) => <CardSkeleton key={i} />)}</div></PageContainer>

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Ocorrencias</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEditingTipo(null); setShowTipoForm(true) }}><Plus size={16} /> Cadastrar Tipo</Button>
          <Button onClick={() => setShowOcForm(true)}><Plus size={16} /> Registrar Ocorrencia</Button>
        </div>
      </div>
      {tipos.length > 0 && (
        <Card className="mb-6"><CardHeader><CardTitle><div className="flex items-center gap-2"><FileText size={18} className="text-azul-medio" />Tipos de Ocorrencia</div></CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2">{tipos.map((t) => (
            <div key={t.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.cor }} /><span className="font-medium text-cinza-preto">{t.titulo}</span><span className="text-xs text-cinza-estrutural">({t.categoria})</span>
              <button onClick={() => { setEditingTipo(t); setShowTipoForm(true) }} className="text-cinza-estrutural hover:text-azul-medio ml-1"><Pencil size={12} /></button>
              <button onClick={() => { if (confirm('Excluir?')) deleteTipo(t.id).then(loadData) }} className="text-cinza-estrutural hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          ))}</div>
        </Card>
      )}
      <Card className="mb-6"><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SearchInput placeholder="Buscar funcionario..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
        <Select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} options={[{ value: '', label: 'Todos os tipos' }, ...tipos.map((t) => ({ value: t.id, label: t.titulo }))]} />
        <Select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} options={[{ value: '', label: 'Todas' }, { value: 'Remuneracao', label: 'Remuneracao' }, { value: 'Ausencia', label: 'Ausencia' }, { value: 'Disciplinar', label: 'Disciplinar' }, { value: 'Beneficio', label: 'Beneficio' }, { value: 'Outro', label: 'Outro' }]} />
      </div></Card>
      <Card><CardHeader><CardTitle><div className="flex items-center gap-2"><ClipboardList size={18} className="text-laranja" />Ocorrencias Recentes{filteredOc.length > 0 && <Badge variant="neutral">{filteredOc.length}</Badge>}</div></CardTitle></CardHeader>
        {filteredOc.length === 0 ? <EmptyState icon={<ClipboardList size={40} />} title="Nenhuma ocorrencia" /> : (
          <Table><TableHeader><TableHead>Data</TableHead><TableHead>Funcionario</TableHead><TableHead>Tipo</TableHead><TableHead>Descricao</TableHead><TableHead>Dias</TableHead><TableHead>Valor</TableHead><TableHead className="w-10"></TableHead></TableHeader>
            <TableBody>{filteredOc.map((o) => (
              <TableRow key={o.id}><TableCell>{format(new Date(o.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                <TableCell><p className="font-medium">{o.funcionario_nome}</p></TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: o.tipo_cor || '#888' }}>{o.tipo_titulo}</span></TableCell>
                <TableCell className="max-w-[200px] truncate">{o.descricao || '-'}</TableCell><TableCell>{o.dias}</TableCell>
                <TableCell>{o.valor ? `R$ ${Number(o.valor).toFixed(2).replace('.', ',')}` : '-'}</TableCell>
                <TableCell><button onClick={() => { if (confirm('Excluir?')) deleteOcorrencia(o.id).then(loadData) }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button></TableCell>
              </TableRow>
            ))}</TableBody></Table>
        )}
      </Card>
      <OcorrenciaFormModal open={showOcForm} onClose={() => setShowOcForm(false)} onSubmit={async (d) => { await createOcorrencia(d); loadData() }} tipos={tipos} />
      <TipoOcorrenciaFormModal open={showTipoForm} onClose={() => { setShowTipoForm(false); setEditingTipo(null) }} onSubmit={async (d) => { if (editingTipo) await updateTipo(editingTipo.id, d); else await createTipo(d); setEditingTipo(null); loadData() }} initial={editingTipo} />
    </PageContainer>
  )
}

// --- Financeiro Page ---
function FinanceiroPage() {
  const { loadResumoGeral, loadFolhaPorUnidade, loadFolhaPorSetor, loadTopSalarios } = useFolha()
  const { createTipo } = useTiposTransacao()
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState({ totalBruto: 0, totalLiquido: 0, custoTotal: 0, totalFuncionarios: 0 })
  const [porUnidade, setPorUnidade] = useState([])
  const [porSetor, setPorSetor] = useState([])
  const [topSalarios, setTopSalarios] = useState([])
  const [tipoFormOpen, setTipoFormOpen] = useState(false)

  useEffect(() => { loadData() }, [])
  async function loadData() { setLoading(true); try { const [r, u, s, t] = await Promise.all([loadResumoGeral(), loadFolhaPorUnidade(), loadFolhaPorSetor(), loadTopSalarios(10)]); setResumo(r); setPorUnidade(u); setPorSetor(s); setTopSalarios(t) } finally { setLoading(false) } }
  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const chartSetores = [...porSetor].sort((a, b) => b.total_bruto - a.total_bruto).slice(0, 10).map((s) => ({ name: s.setor_titulo?.slice(0, 20) || '', 'Custo Bruto': s.total_bruto }))

  if (loading) return <PageContainer><div className="space-y-6"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[0,1,2,3].map((i) => <CardSkeleton key={i} />)}</div><TableSkeleton rows={5} /></div></PageContainer>

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-cinza-preto">Financeiro</h1><p className="text-sm text-cinza-estrutural">Visao consolidada da folha de pagamento</p></div>
        <Button size="sm" variant="secondary" onClick={() => setTipoFormOpen(true)}><Plus size={14} /> Cadastrar Tipo de Transacao</Button>
      </div>
      <div className="mb-8"><FolhaResumoCards resumo={resumo} /></div>
      <Card className="mb-8"><div className="flex items-center gap-2 mb-4"><Building2 size={20} className="text-azul" /><h3 className="text-lg font-bold text-cinza-preto">Folha por Unidade</h3></div>
        {porUnidade.length === 0 ? <EmptyState icon={<Building2 size={48} />} title="Nenhum dado" /> : (
          <Table><TableHeader><TableHead>Unidade</TableHead><TableHead className="text-center">Funcionarios</TableHead><TableHead>Total Bruto</TableHead><TableHead>Total Liquido</TableHead><TableHead>Custo Total</TableHead></TableHeader>
            <TableBody>{porUnidade.map((u) => (<TableRow key={u.unidade_id}><TableCell className="font-medium">{u.unidade_titulo}</TableCell><TableCell className="text-center"><Badge variant="info">{u.num_funcionarios}</Badge></TableCell><TableCell>{fmt(u.total_bruto)}</TableCell><TableCell>{fmt(u.total_liquido)}</TableCell><TableCell className="font-medium">{fmt(u.custo_total)}</TableCell></TableRow>))}</TableBody></Table>
        )}
      </Card>
      <Card className="mb-8"><div className="flex items-center gap-2 mb-4"><Layers size={20} className="text-azul" /><h3 className="text-lg font-bold text-cinza-preto">Folha por Setor</h3></div>
        {porSetor.length === 0 ? <EmptyState icon={<Layers size={48} />} title="Nenhum dado" /> : (
          <><Table className="mb-6"><TableHeader><TableHead>Setor</TableHead><TableHead>Unidade</TableHead><TableHead className="text-center">Funcionarios</TableHead><TableHead>Total Bruto</TableHead></TableHeader>
            <TableBody>{porSetor.map((s) => (<TableRow key={s.setor_id}><TableCell className="font-medium">{s.setor_titulo}</TableCell><TableCell>{s.unidade_titulo || '-'}</TableCell><TableCell className="text-center"><Badge variant="info">{s.num_funcionarios}</Badge></TableCell><TableCell>{fmt(s.total_bruto)}</TableCell></TableRow>))}</TableBody></Table>
          {chartSetores.length > 0 && (<div><div className="flex items-center gap-2 mb-3"><BarChart3 size={16} className="text-cinza-estrutural" /><p className="text-sm font-medium text-cinza-estrutural">Custo por Setor</p></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartSetores} layout="vertical" margin={{ left: 100 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} /><Tooltip formatter={(v) => fmt(Number(v))} /><Bar dataKey="Custo Bruto" fill="#E57B25" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></div></div>)}</>
        )}
      </Card>
      <Card><div className="flex items-center gap-2 mb-4"><Trophy size={20} className="text-amber-500" /><h3 className="text-lg font-bold text-cinza-preto">Top 10 Salarios</h3></div>
        {topSalarios.length === 0 ? <EmptyState icon={<DollarSign size={48} />} title="Nenhum dado" /> : (
          <Table><TableHeader><TableHead>#</TableHead><TableHead>Nome</TableHead><TableHead>Funcao</TableHead><TableHead>Setor</TableHead><TableHead>Salario Bruto</TableHead></TableHeader>
            <TableBody>{topSalarios.map((t, i) => (
              <TableRow key={t.funcionario_id}><TableCell><span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-cinza-estrutural'}`}>{i + 1}</span></TableCell>
                <TableCell className="font-medium">{t.nome_completo}</TableCell><TableCell>{t.funcao_titulo || '-'}</TableCell><TableCell>{t.setor_titulo || '-'}</TableCell><TableCell className="font-bold text-laranja">{fmt(t.salario_bruto)}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
        )}
      </Card>
      <TipoTransacaoForm open={tipoFormOpen} onClose={() => setTipoFormOpen(false)} onSubmit={async (d) => { await createTipo(d) }} />
    </PageContainer>
  )
}

// --- Login Page ---
function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou senha incorretos.'); setLoading(false); return }
    router.push('/'); router.refresh()
  }

  return (
    <div className="min-h-screen bg-azul-noturno flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-20 w-20 mb-4 bg-azul-noturno rounded-xl p-2 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">IW8</span>
          </div>
          <h1 className="text-2xl font-bold text-cinza-preto">Sistema de RH</h1>
          <p className="text-cinza-estrutural text-sm mt-1">Faca login para acessar</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="w-full px-4 py-3 border border-gray-200 rounded-lg text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" required className="w-full px-4 py-3 border border-gray-200 rounded-lg text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent" />
          </div>
          {error && <div className="bg-red-50 text-red-500 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-laranja hover:bg-laranja-escuro text-white font-semibold py-3 rounded-lg transition-colors duration-200 disabled:opacity-50">{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}

// --- Placeholder pages (Cadastros, Relatorios, FuncionarioDetail, FuncionarioFinanceiro) ---
// These pages are complex, using the same patterns shown above.
// The full implementations exist in the Next.js source files.

function CadastrosPage() {
  return <PageContainer><h2 className="text-2xl font-bold text-cinza-preto mb-6">Cadastros</h2><p className="text-cinza-estrutural">Pagina de cadastros - veja o codigo-fonte completo nas pages do Next.js</p></PageContainer>
}

function RelatoriosPage() {
  return <PageContainer><h2 className="text-2xl font-bold text-cinza-preto mb-6">Relatorios</h2><p className="text-cinza-estrutural">Pagina de relatorios - veja o codigo-fonte completo nas pages do Next.js</p></PageContainer>
}

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

const LOGO_URL = 'https://xrdrdpbhcygpnrmnjpjq.supabase.co/storage/v1/object/public/arquivos-rh/IW8_brancalaranja.png'

function Sidebar({ currentPath, navigate }) {
  const [cadastrosOpen, setCadastrosOpen] = useState(currentPath.startsWith('/cadastros'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  async function handleLogout() { await supabase.auth.signOut(); navigate('/login') }
  function isActive(href) { if (!href) return false; if (href === '/') return currentPath === '/'; return currentPath.startsWith(href.split('?')[0]) }

  const navItems = [
    { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={20} /> },
    { label: 'Funcionarios', href: '/funcionarios', icon: <Users size={20} /> },
    { label: 'Cadastros', icon: <Building2 size={20} />, children: [{ label: 'Unidades', href: '/cadastros?tab=unidades', icon: <MapPin size={18} /> }, { label: 'Setores', href: '/cadastros?tab=setores', icon: <Layers size={18} /> }, { label: 'Funcoes', href: '/cadastros?tab=funcoes', icon: <Briefcase size={18} /> }] },
    { label: 'Ferias', href: '/ferias', icon: <Palmtree size={20} /> },
    { label: 'Ocorrencias', href: '/ocorrencias', icon: <ClipboardList size={20} /> },
    { label: 'Financeiro', href: '/financeiro', icon: <DollarSign size={20} /> },
    { label: 'Relatorios', href: '/relatorios', icon: <FileBarChart size={20} /> },
  ]

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center h-20 border-b border-white/10">
        <img src={LOGO_URL} alt="IW8" className="h-12" onError={(e) => { e.target.style.display = 'none' }} />
        <span className="text-white text-xl font-bold ml-2">IW8 RH</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <button onClick={() => setCadastrosOpen(!cadastrosOpen)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${item.children.some((c) => currentPath.startsWith(c.href.split('?')[0])) ? 'bg-azul text-white' : 'text-cinza-branco hover:bg-white/10'}`}>
                  {item.icon}<span className="flex-1 text-left">{item.label}</span>{cadastrosOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {cadastrosOpen && (<div className="ml-4 mt-1 space-y-1">{item.children.map((child) => (
                  <button key={child.label} onClick={() => { navigate(child.href); setMobileOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 text-cinza-branco/80 hover:bg-white/10">{child.icon}{child.label}</button>
                ))}</div>)}
              </div>
            )
          }
          return (<button key={item.label} onClick={() => { navigate(item.href); setMobileOpen(false) }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${isActive(item.href) ? 'bg-azul text-white border-l-2 border-laranja' : 'text-cinza-branco hover:bg-white/10'}`}>{item.icon}{item.label}</button>)
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-cinza-branco hover:bg-white/10 transition-colors duration-200"><LogOut size={20} />Sair</button>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-40 bg-azul-noturno text-white p-2 rounded-lg shadow-lg"><Menu size={20} /></button>
      {mobileOpen && (<div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}><div className="w-64 h-full bg-azul-noturno" onClick={(e) => e.stopPropagation()}><button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-white"><X size={20} /></button>{sidebarContent}</div></div>)}
      <aside className="hidden lg:block fixed left-0 top-0 w-64 h-screen bg-azul-noturno z-30">{sidebarContent}</aside>
    </>
  )
}

function Header({ currentPath }) {
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState('')
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || '')) }, [])

  const pageTitles = { '/': 'Dashboard', '/funcionarios': 'Funcionarios', '/cadastros': 'Cadastros', '/ferias': 'Ferias', '/ocorrencias': 'Ocorrencias', '/financeiro': 'Financeiro', '/relatorios': 'Relatorios' }
  const title = pageTitles[currentPath] || 'IW8 RH'

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 print:hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cinza-preto">{title}</h1>
        <span className="text-sm text-cinza-estrutural hidden sm:block">{userEmail}</span>
      </div>
    </header>
  )
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/')
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuthenticated(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setIsAuthenticated(!!session))
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    function onHashChange() { setCurrentPath(window.location.hash.slice(1) || '/') }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigate(path) {
    window.location.hash = path
    setCurrentPath(path)
  }

  // Parse params from path
  const params = {}
  const searchParams = {}
  let routePath = currentPath.split('?')[0]
  const queryString = currentPath.split('?')[1] || ''
  queryString.split('&').forEach((p) => { const [k, v] = p.split('='); if (k) searchParams[k] = v })
  if (routePath.match(/^\/funcionarios\/([^/]+)$/)) params.id = routePath.split('/')[2]

  if (isAuthenticated === null) return <div className="min-h-screen bg-cinza-branco flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-laranja border-t-transparent rounded-full" /></div>

  if (!isAuthenticated || routePath === '/login') {
    return (
      <NavContext.Provider value={{ currentPath, navigate, params, searchParams }}>
        <LoginPage />
        <Toaster position="top-right" richColors />
      </NavContext.Provider>
    )
  }

  function renderPage() {
    if (routePath === '/') return <DashboardPage />
    if (routePath === '/funcionarios') return <FuncionariosPage />
    if (routePath.match(/^\/funcionarios\/[^/]+\/financeiro$/)) return <PageContainer><h2 className="text-2xl font-bold text-cinza-preto">Painel Financeiro</h2><p className="text-cinza-estrutural mt-2">Veja o codigo-fonte completo em src/app/(app)/funcionarios/[id]/financeiro/page.tsx</p></PageContainer>
    if (routePath.match(/^\/funcionarios\/[^/]+$/)) return <PageContainer><h2 className="text-2xl font-bold text-cinza-preto">Ficha do Funcionario</h2><p className="text-cinza-estrutural mt-2">Veja o codigo-fonte completo em src/app/(app)/funcionarios/[id]/page.tsx</p></PageContainer>
    if (routePath === '/cadastros') return <CadastrosPage />
    if (routePath === '/ferias') return <FeriasPage />
    if (routePath === '/ocorrencias') return <OcorrenciasPage />
    if (routePath === '/financeiro') return <FinanceiroPage />
    if (routePath === '/relatorios') return <RelatoriosPage />
    return <PageContainer><h2 className="text-2xl font-bold text-cinza-preto">Pagina nao encontrada</h2></PageContainer>
  }

  return (
    <NavContext.Provider value={{ currentPath, navigate, params, searchParams }}>
      <div className="min-h-screen bg-cinza-branco">
        <Sidebar currentPath={routePath} navigate={navigate} />
        <div className="lg:ml-64">
          <Header currentPath={routePath} />
          <main>{renderPage()}</main>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    </NavContext.Provider>
  )
}
