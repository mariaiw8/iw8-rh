'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/funcionarios': 'Funcionarios',
  '/cadastros': 'Cadastros',
  '/ferias': 'Ferias',
  '/ocorrencias': 'Ocorrencias',
}

export function Header() {
  const pathname = usePathname()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || '')
    })
  }, [supabase.auth])

  function getTitle() {
    if (pathname.startsWith('/funcionarios/')) return 'Ficha do Funcionario'
    return pageTitles[pathname] || 'IW8 RH'
  }

  function getBreadcrumbs() {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return null
    return parts.map((part) => {
      const labels: Record<string, string> = {
        funcionarios: 'Funcionarios',
        cadastros: 'Cadastros',
        ferias: 'Ferias',
        ocorrencias: 'Ocorrencias',
      }
      return labels[part] || part
    })
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-cinza-preto">{getTitle()}</h1>
          {breadcrumbs && breadcrumbs.length > 1 && (
            <p className="text-sm text-cinza-estrutural mt-0.5">
              {breadcrumbs.join(' > ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-cinza-estrutural hidden sm:block">{userEmail}</span>
        </div>
      </div>
    </header>
  )
}
