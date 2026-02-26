'use client'

import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Toaster } from 'sonner'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cinza-branco">
      <Sidebar />
      <div className="lg:ml-64">
        <Header />
        <main>{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  )
}
