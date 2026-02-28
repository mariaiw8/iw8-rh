'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ChevronRight } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/funcionarios': 'Funcionarios',
  '/cadastros': 'Cadastros',
  '/ferias': 'Ferias',
  '/ocorrencias': 'Ocorrencias',
  '/financeiro': 'Financeiro',
  '/relatorios': 'Relatorios',
}

const breadcrumbLabels: Record<string, string> = {
  funcionarios: 'Funcionarios',
  cadastros: 'Cadastros',
  ferias: 'Ferias',
  ocorrencias: 'Ocorrencias',
  financeiro: 'Financeiro',
  relatorios: 'Relatorios',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function Header() {
  const pathname = usePathname()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string>('')
  const [dynamicLabels, setDynamicLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || '')
    })
  }, [supabase.auth])

  // Resolve employee names for UUID breadcrumb segments
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean)
    parts.forEach((part, idx) => {
      if (!UUID_REGEX.test(part)) return
      if (dynamicLabels[part]) return
      if (idx > 0 && parts[idx - 1] === 'funcionarios') {
        supabase
          .from('funcionarios')
          .select('nome_completo, nome')
          .eq('id', part)
          .single()
          .then(({ data }) => {
            if (data) {
              const nome = (data.nome_completo || data.nome || '').toString()
              if (nome) {
                setDynamicLabels((prev) => ({ ...prev, [part]: nome }))
              }
            }
          })
      }
    })
  }, [pathname, supabase])

  function getTitle() {
    if (pathname.startsWith('/funcionarios/') && pathname.includes('/financeiro')) return 'Painel Financeiro'
    if (pathname.startsWith('/funcionarios/')) return 'Ficha do Funcionario'
    return pageTitles[pathname] || 'IW8 RH'
  }

  function getBreadcrumbs(): { label: string; href: string }[] {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return []

    const crumbs: { label: string; href: string }[] = [
      { label: 'Dashboard', href: '/' },
    ]

    let currentPath = ''
    for (const part of parts) {
      currentPath += `/${part}`
      const label = dynamicLabels[part] || breadcrumbLabels[part] || (UUID_REGEX.test(part) ? '...' : part)
      crumbs.push({ label, href: currentPath })
    }

    return crumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-cinza-preto">{getTitle()}</h1>
          {breadcrumbs.length > 1 && (
            <nav className="flex items-center gap-1 mt-0.5">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
                  {i < breadcrumbs.length - 1 ? (
                    <Link
                      href={crumb.href}
                      className="text-sm text-cinza-estrutural hover:text-laranja transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-sm text-cinza-preto font-medium">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-cinza-estrutural hidden sm:block">{userEmail}</span>
        </div>
      </div>
    </header>
  )
}
