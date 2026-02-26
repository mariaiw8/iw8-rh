'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Layers,
  Briefcase,
  Palmtree,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  disabled?: boolean
  children?: { label: string; href: string; icon: React.ReactNode }[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard size={20} />,
  },
  {
    label: 'Funcionarios',
    href: '/funcionarios',
    icon: <Users size={20} />,
  },
  {
    label: 'Cadastros',
    icon: <Building2 size={20} />,
    children: [
      { label: 'Unidades', href: '/cadastros?tab=unidades', icon: <MapPin size={18} /> },
      { label: 'Setores', href: '/cadastros?tab=setores', icon: <Layers size={18} /> },
      { label: 'Funcoes', href: '/cadastros?tab=funcoes', icon: <Briefcase size={18} /> },
    ],
  },
  {
    label: 'Ferias',
    href: '/ferias',
    icon: <Palmtree size={20} />,
    disabled: true,
  },
  {
    label: 'Ocorrencias',
    href: '/ocorrencias',
    icon: <ClipboardList size={20} />,
    disabled: true,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [cadastrosOpen, setCadastrosOpen] = useState(pathname.startsWith('/cadastros'))
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href?: string) {
    if (!href) return false
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href.split('?')[0])
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-center h-20 border-b border-white/10">
        <img src="https://xrdrdpbhcygpnrmnjpjq.supabase.co/storage/v1/object/public/arquivos-rh/Logo%20IW8%20Sem%20Fundo%20PNG.png" alt="IW8" className="h-12" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some((child) =>
              pathname.startsWith(child.href.split('?')[0])
            )
            return (
              <div key={item.label}>
                <button
                  onClick={() => setCadastrosOpen(!cadastrosOpen)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isChildActive
                      ? 'bg-azul text-white'
                      : 'text-cinza-branco hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {cadastrosOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {cadastrosOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                          pathname + (typeof window !== 'undefined' ? window.location.search : '') === child.href
                            ? 'bg-azul text-white border-l-2 border-laranja'
                            : 'text-cinza-branco/80 hover:bg-white/10'
                        }`}
                      >
                        {child.icon}
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/30 cursor-not-allowed"
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Em breve</span>
              </div>
            )
          }

          return (
            <Link
              key={item.label}
              href={item.href!}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive(item.href)
                  ? 'bg-azul text-white border-l-2 border-laranja'
                  : 'text-cinza-branco hover:bg-white/10'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-cinza-branco hover:bg-white/10 transition-colors duration-200"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 bg-azul-noturno text-white p-2 rounded-lg shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div
            className="w-64 h-full bg-azul-noturno"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 w-64 h-screen bg-azul-noturno z-30">
        {sidebarContent}
      </aside>
    </>
  )
}
