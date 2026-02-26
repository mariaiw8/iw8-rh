'use client'

import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useCalendario, type CalendarioEvento } from '@/hooks/useCalendario'
import { format } from 'date-fns'
import { X } from 'lucide-react'

interface EventPopup {
  evento: CalendarioEvento
  x: number
  y: number
}

export function DashboardCalendar() {
  const { loadEventos } = useCalendario()
  const [eventos, setEventos] = useState<CalendarioEvento[]>([])
  const [popup, setPopup] = useState<EventPopup | null>(null)
  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    loadInitial()
  }, [])

  async function loadInitial() {
    const now = new Date()
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const data = await loadEventos(inicio, fim)
    setEventos(data)
  }

  async function handleDatesSet(arg: { start: Date; end: Date }) {
    const inicio = arg.start.toISOString().split('T')[0]
    const fim = arg.end.toISOString().split('T')[0]
    const data = await loadEventos(inicio, fim)
    setEventos(data)
  }

  function handleEventClick(info: { event: { id: string; extendedProps: Record<string, unknown> }; jsEvent: MouseEvent }) {
    info.jsEvent.preventDefault()
    const evento = eventos.find((e) => e.id === info.event.id)
    if (evento) {
      setPopup({
        evento,
        x: info.jsEvent.clientX,
        y: info.jsEvent.clientY,
      })
    }
  }

  const calendarEvents = eventos.map((e) => ({
    id: e.id,
    title: e.titulo,
    start: e.data_inicio,
    end: e.data_fim ? (() => {
      const d = new Date(e.data_fim + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    })() : undefined,
    backgroundColor: e.cor,
    borderColor: e.cor,
    extendedProps: { evento: e },
  }))

  return (
    <div className="relative">
      <style>{`
        .fc { font-family: inherit; font-size: 0.8rem; }
        .fc .fc-toolbar-title { font-size: 1.1rem; font-weight: 700; color: #292929; }
        .fc .fc-button { background: #154766; border-color: #154766; font-size: 0.8rem; padding: 4px 10px; }
        .fc .fc-button:hover { background: #0C2C4A; }
        .fc .fc-button-primary:not(:disabled).fc-button-active { background: #E57B25; border-color: #E57B25; }
        .fc .fc-daygrid-day-number { color: #292929; font-size: 0.8rem; padding: 4px 8px; }
        .fc .fc-col-header-cell-cushion { color: #434545; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
        .fc .fc-event { cursor: pointer; font-size: 0.7rem; padding: 1px 4px; border-radius: 4px; }
        .fc .fc-daygrid-day.fc-day-today { background: #FFF8E7; }
        .fc th { border-color: #e5e7eb; }
        .fc td { border-color: #f3f4f6; }
      `}</style>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="pt-br"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        buttonText={{ today: 'Hoje' }}
        events={calendarEvents}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        height="auto"
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} mais`}
      />

      {/* Event Popup */}
      {popup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopup(null)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72"
            style={{
              left: Math.min(popup.x, window.innerWidth - 300),
              top: Math.min(popup.y + 10, window.innerHeight - 200),
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: popup.evento.cor }} />
                <span className="text-xs font-medium text-cinza-estrutural uppercase">
                  {popup.evento.tipo === 'ferias' ? 'Ferias' : popup.evento.tipo === 'ferias_coletivas' ? 'Ferias Coletivas' : 'Ocorrencia'}
                </span>
              </div>
              <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-cinza-preto">
                <X size={14} />
              </button>
            </div>
            {popup.evento.funcionario_nome && (
              <p className="text-sm font-bold text-cinza-preto mb-1">{popup.evento.funcionario_nome}</p>
            )}
            <p className="text-sm text-cinza-preto mb-2">{popup.evento.titulo}</p>
            <div className="text-xs text-cinza-estrutural space-y-1">
              <p>
                {format(new Date(popup.evento.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')}
                {popup.evento.data_fim && popup.evento.data_fim !== popup.evento.data_inicio && (
                  <> ate {format(new Date(popup.evento.data_fim + 'T00:00:00'), 'dd/MM/yyyy')}</>
                )}
              </p>
              {popup.evento.dias && <p>{popup.evento.dias} dia{popup.evento.dias > 1 ? 's' : ''}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
