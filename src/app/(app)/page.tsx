'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { Users, Palmtree, AlertTriangle, CalendarClock, Cake, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import { SetoreChart, AdmissoesChart, OcorrenciasChart } from '@/components/dashboard/Charts'

const DashboardCalendar = dynamic(
  () => import('@/components/dashboard/Calendar').then(mod => ({ default: mod.DashboardCalendar })),
  { ssr: false, loading: () => <div className="h-96 bg-gray-100 rounded-xl animate-pulse" /> }
)

interface DashboardData {
  totalAtivos: number
  emFerias: number
  ocorrenciasMes: number
  feriasVencer: number
  proximasFerias: Array<{ id: string; nome: string; inicio: string; fim: string }>
  aniversariantes: Array<{ id: string; nome: string; data_nascimento: string; foto_url?: string }>
  admissoesRecentes: Array<{ id: string; nome: string; data_admissao: string; funcao?: string; foto_url?: string }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const now = new Date()
      const mesAtual = now.getMonth() + 1
      const anoAtual = now.getFullYear()
      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`
      const fimMes = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0]

      const [
        ativosRes,
        feriasRes,
        ocorrenciasRes,
        feriasVencerRes,
        proximasFeriasRes,
        aniversariantesRes,
        admissoesRes,
      ] = await Promise.all([
        supabase.from('funcionarios').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
        supabase.from('ferias').select('id', { count: 'exact', head: true }).eq('status', 'Em Andamento'),
        supabase.from('ocorrencias').select('id', { count: 'exact', head: true }).gte('data_inicio', inicioMes).lte('data_inicio', fimMes),
        supabase.from('vw_ferias_a_vencer').select('id', { count: 'exact', head: true }).in('situacao', ['ALERTA', 'VENCIDA']),
        supabase.from('vw_proximas_ferias').select('*').limit(5),
        supabase.from('funcionarios').select('id, nome, data_nascimento, foto_url').eq('status', 'Ativo'),
        supabase.from('funcionarios').select('id, nome, data_admissao, foto_url').eq('status', 'Ativo').gte('data_admissao', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).order('data_admissao', { ascending: false }).limit(5),
      ])

      // Filter aniversariantes by current month
      const aniversariantes = (aniversariantesRes.data || [])
        .filter((f) => {
          if (!f.data_nascimento) return false
          const mes = parseInt(f.data_nascimento.split('-')[1], 10)
          return mes === mesAtual
        })
        .slice(0, 5)

      setData({
        totalAtivos: ativosRes.count || 0,
        emFerias: feriasRes.count || 0,
        ocorrenciasMes: ocorrenciasRes.count || 0,
        feriasVencer: feriasVencerRes.count || 0,
        proximasFerias: (proximasFeriasRes.data || []).map((f: Record<string, string>) => ({
          id: f.ferias_id || f.id || f.funcionario_id,
          nome: f.nome_completo || f.nome || f.funcionario_nome,
          inicio: f.data_inicio || f.inicio,
          fim: f.data_fim || f.fim,
        })),
        aniversariantes,
        admissoesRecentes: (admissoesRes.data || []).map((f: Record<string, string>) => ({
          id: f.id,
          nome: f.nome,
          data_admissao: f.data_admissao,
          foto_url: f.foto_url,
        })),
      })
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-cinza-preto">Bem-vindo ao IW8 RH</h2>
        <p className="text-cinza-estrutural capitalize">{hoje}</p>
      </div>

      {/* Indicadores */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Funcionarios Ativos"
            value={data?.totalAtivos || 0}
            icon={<Users size={24} />}
            color="text-azul-medio"
          />
          <StatCard
            title="Em Ferias"
            value={data?.emFerias || 0}
            icon={<Palmtree size={24} />}
            color="text-green-500"
          />
          <StatCard
            title="Ocorrencias no Mes"
            value={data?.ocorrenciasMes || 0}
            icon={<AlertTriangle size={24} />}
            color="text-amarelo"
          />
          <StatCard
            title="Ferias a Vencer"
            value={data?.feriasVencer || 0}
            icon={<CalendarClock size={24} />}
            color="text-red-500"
          />
        </div>
      )}

      {/* Cards adicionais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Proximas Ferias */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Palmtree size={18} className="text-azul-medio" />
                Proximas Ferias
              </div>
            </CardTitle>
          </CardHeader>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.proximasFerias && data.proximasFerias.length > 0 ? (
            <div className="space-y-3">
              {data.proximasFerias.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-cinza-preto">{f.nome}</span>
                  <span className="text-xs text-cinza-estrutural">
                    {f.inicio && format(new Date(f.inicio + 'T00:00:00'), 'dd/MM')} - {f.fim && format(new Date(f.fim + 'T00:00:00'), 'dd/MM')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-cinza-estrutural">Nenhuma ferias programada</p>
          )}
        </Card>

        {/* Aniversariantes */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Cake size={18} className="text-laranja" />
                Aniversariantes do Mes
              </div>
            </CardTitle>
          </CardHeader>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.aniversariantes && data.aniversariantes.length > 0 ? (
            <div className="space-y-3">
              {data.aniversariantes.map((f) => (
                <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <Avatar src={f.foto_url} name={f.nome} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-cinza-preto">{f.nome}</p>
                    <p className="text-xs text-cinza-estrutural">
                      {f.data_nascimento && format(new Date(f.data_nascimento + 'T00:00:00'), 'dd/MM')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-cinza-estrutural">Nenhum aniversariante este mes</p>
          )}
        </Card>

        {/* Admissoes Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-green-500" />
                Admissoes Recentes
              </div>
            </CardTitle>
          </CardHeader>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.admissoesRecentes && data.admissoesRecentes.length > 0 ? (
            <div className="space-y-3">
              {data.admissoesRecentes.map((f) => (
                <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <Avatar src={f.foto_url} name={f.nome} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-cinza-preto">{f.nome}</p>
                    <p className="text-xs text-cinza-estrutural">
                      {f.data_admissao && format(new Date(f.data_admissao + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-cinza-estrutural">Nenhuma admissao nos ultimos 30 dias</p>
          )}
        </Card>
      </div>

      {/* Calendario */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-azul-medio" />
                Calendario
              </div>
            </CardTitle>
          </CardHeader>
          <DashboardCalendar />
        </Card>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <SetoreChart />
        <OcorrenciasChart />
      </div>
      <div className="mt-6">
        <AdmissoesChart />
      </div>
    </PageContainer>
  )
}
