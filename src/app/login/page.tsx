'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-azul-noturno flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-20 w-20 mb-4 bg-azul-noturno rounded-xl flex items-center justify-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-white tracking-tight">IW</span>
              <span className="text-2xl font-bold text-laranja tracking-tight">8</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-cinza-preto">Sistema de RH</h1>
          <p className="text-cinza-estrutural text-sm mt-1">Faça login para acessar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-cinza-preto mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-cinza-preto mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-cinza-preto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-laranja hover:bg-laranja-escuro text-white font-semibold py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
