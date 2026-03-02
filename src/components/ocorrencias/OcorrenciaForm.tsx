'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Autocomplete } from '@/components/ui/Autocomplete'
import { createClient } from '@/lib/supabase'
import { type TipoOcorrencia } from '@/hooks/useOcorrencias'
import { formatDateSafe, safeDifferenceInDays } from '@/lib/dateUtils'
import { Upload, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface OcorrenciaFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: OcorrenciaFormData) => Promise<void>
  funcionarioId?: string
  funcionarioNome?: string
  tipos: TipoOcorrencia[]
}

export interface OcorrenciaFormData {
  funcionario_id: string
  tipo_ocorrencia_id: string
  descricao: string
  data_inicio: string
  data_fim: string
  dias: number
  horas: number | null
  valor: number | null
  arquivo_url: string | null
  observacao: string
  absenteismo: boolean
}

export function OcorrenciaForm({ open, onClose, onSubmit, funcionarioId, funcionarioNome, tipos }: OcorrenciaFormProps) {
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [funcionarios, setFuncionarios] = useState<{ value: string; label: string; sublabel: string }[]>([])
  const [valoresFuncionario, setValoresFuncionario] = useState<{
    valor_dia?: number; valor_hora?: number; valor_hora_extra?: number; salario_bruto?: number
  } | null>(null)
  const [valorCalculado, setValorCalculado] = useState<number | null>(null)

  const [form, setForm] = useState({
    funcionario_id: funcionarioId || '',
    tipo_ocorrencia_id: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    dias: 1,
    horas: 0,
    valor: 0,
    arquivo_url: '',
    observacao: '',
  })

  const tipoSelecionado = tipos.find((t) => t.id === form.tipo_ocorrencia_id) || null

  useEffect(() => {
    if (open && !funcionarioId) {
      loadFuncionarios()
    }
  }, [open, funcionarioId])

  // Load valores do funcionario when selected
  useEffect(() => {
    if (form.funcionario_id && tipoSelecionado?.base_calculo && tipoSelecionado.base_calculo !== 'manual') {
      loadValoresFuncionario(form.funcionario_id)
    }
  }, [form.funcionario_id, tipoSelecionado?.base_calculo])

  // Auto-calculate data_fim when dias change and unidade_entrada is 'dias'
  useEffect(() => {
    if (tipoSelecionado?.unidade_entrada === 'dias' && form.data_inicio && form.dias > 0) {
      const startDate = new Date(form.data_inicio + 'T00:00:00')
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + form.dias - 1)
        const fimStr = endDate.toISOString().split('T')[0]
        setForm((prev) => ({ ...prev, data_fim: fimStr }))
      }
    }
  }, [form.data_inicio, form.dias, tipoSelecionado?.unidade_entrada])

  // Auto-calculate value based on base_calculo
  useEffect(() => {
    if (!tipoSelecionado || !valoresFuncionario) {
      setValorCalculado(null)
      return
    }

    let calc: number | null = null
    if (tipoSelecionado.base_calculo === 'dia_trabalho' && valoresFuncionario.valor_dia) {
      calc = form.dias * valoresFuncionario.valor_dia
    } else if (tipoSelecionado.base_calculo === 'hora_trabalho' && valoresFuncionario.valor_hora) {
      calc = (form.horas || 0) * valoresFuncionario.valor_hora
    } else if (tipoSelecionado.base_calculo === 'hora_extra' && valoresFuncionario.valor_hora_extra) {
      calc = (form.horas || 0) * valoresFuncionario.valor_hora_extra
    }

    setValorCalculado(calc)
  }, [form.dias, form.horas, tipoSelecionado, valoresFuncionario])

  async function loadFuncionarios() {
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome_completo, codigo')
      .eq('status', 'Ativo')
      .order('nome_completo')

    setFuncionarios(
      (data || []).map((f: Record<string, string>) => ({
        value: f.id,
        label: f.nome_completo,
        sublabel: f.codigo ? `Cod: ${f.codigo}` : '',
      }))
    )
  }

  async function loadValoresFuncionario(funcId: string) {
    const { data, error } = await supabase.rpc('fn_valores_funcionario', { p_funcionario_id: funcId })
    if (!error && data && data.length > 0) {
      setValoresFuncionario(data[0])
    }
  }

  async function handleRepeatLast() {
    if (!form.funcionario_id || !form.tipo_ocorrencia_id) return

    const { data: ultimo, error } = await supabase
      .from('ocorrencias')
      .select('*')
      .eq('funcionario_id', form.funcionario_id)
      .eq('tipo_ocorrencia_id', form.tipo_ocorrencia_id)
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single()

    if (error || !ultimo) {
      toast.error('Nenhuma ocorrencia anterior encontrada para este tipo')
      return
    }

    setForm((prev) => ({
      ...prev,
      descricao: ultimo.descricao || '',
      dias: ultimo.dias || 1,
      horas: ultimo.horas || 0,
      valor: ultimo.valor || 0,
      observacao: ultimo.observacao || '',
      // Keep current date
    }))
    toast.success('Dados do ultimo registro carregados')
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.funcionario_id) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `ocorrencias/${form.funcionario_id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('arquivos-rh')
        .upload(path, file, { cacheControl: '3600' })
      if (uploadError) {
        toast.error('Erro no upload: ' + uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage.from('arquivos-rh').getPublicUrl(path)
      setForm({ ...form, arquivo_url: urlData.publicUrl })
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.funcionario_id || !form.tipo_ocorrencia_id || !form.data_inicio) return
    setSubmitting(true)

    const valorFinal = valorCalculado ?? (form.valor || null)

    try {
      await onSubmit({
        funcionario_id: form.funcionario_id,
        tipo_ocorrencia_id: form.tipo_ocorrencia_id,
        descricao: form.descricao,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || '',
        dias: form.dias,
        horas: form.horas || null,
        valor: valorFinal,
        arquivo_url: form.arquivo_url || null,
        observacao: form.observacao,
        absenteismo: tipoSelecionado?.afeta_assiduidade || false,
      })

      // If gera_financeiro, create transacao
      if (tipoSelecionado?.gera_financeiro && valorFinal && valorFinal > 0) {
        await createFinancialTransaction(valorFinal)
      }

      resetForm()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function createFinancialTransaction(valorFinal: number) {
    if (!tipoSelecionado) return

    // Find or create tipo_transacao
    const { data: tipoTransacao } = await supabase
      .from('tipos_transacao')
      .select('id')
      .eq('titulo', tipoSelecionado.titulo)
      .single()

    let tipoTransacaoId = tipoTransacao?.id
    if (!tipoTransacaoId) {
      const { data: novo, error } = await supabase
        .from('tipos_transacao')
        .insert({
          titulo: tipoSelecionado.titulo,
          natureza: tipoSelecionado.natureza_financeira,
        })
        .select()
        .single()
      if (error) {
        console.error('Erro ao criar tipo transacao:', error)
        return
      }
      tipoTransacaoId = novo.id
    }

    const { error } = await supabase.from('transacoes').insert({
      funcionario_id: form.funcionario_id,
      tipo_transacao_id: tipoTransacaoId,
      valor: valorFinal,
      data: form.data_inicio,
      descricao: `${tipoSelecionado.titulo} - ${form.descricao || ''}`,
    }).select()

    if (error) {
      console.error('Erro ao criar transacao financeira:', error)
    }
  }

  function resetForm() {
    setForm({
      funcionario_id: funcionarioId || '',
      tipo_ocorrencia_id: '',
      descricao: '',
      data_inicio: '',
      data_fim: '',
      dias: 1,
      horas: 0,
      valor: 0,
      arquivo_url: '',
      observacao: '',
    })
    setValorCalculado(null)
    setValoresFuncionario(null)
  }

  const showDiasField = !tipoSelecionado || tipoSelecionado.unidade_entrada === 'dias'
  const showHorasField = tipoSelecionado?.unidade_entrada === 'horas'
  const showValorField = tipoSelecionado?.unidade_entrada === 'valor' || tipoSelecionado?.base_calculo === 'salario_bruto'
  const showDataFim = !tipoSelecionado || tipoSelecionado.unidade_entrada === 'dias'

  return (
    <Modal open={open} onClose={onClose} title="Registrar Ocorrencia" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!funcionarioId ? (
          <Autocomplete
            label="Funcionario *"
            placeholder="Buscar funcionario..."
            options={funcionarios}
            value={form.funcionario_id}
            onChange={(val) => setForm({ ...form, funcionario_id: val })}
          />
        ) : (
          <div>
            <label className="block text-sm font-medium text-cinza-preto mb-1">Funcionario</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{funcionarioNome}</div>
          </div>
        )}

        <Select
          label="Tipo de Ocorrencia *"
          value={form.tipo_ocorrencia_id}
          onChange={(e) => {
            setForm({ ...form, tipo_ocorrencia_id: e.target.value, dias: 1, horas: 0, valor: 0 })
            setValorCalculado(null)
          }}
          options={tipos.map((t) => ({ value: t.id, label: t.titulo }))}
          placeholder="Selecione"
        />

        {/* Dynamic badges */}
        {tipoSelecionado && (
          <div className="flex flex-wrap gap-2">
            {tipoSelecionado.afeta_assiduidade && (
              <Badge variant="warning">Afeta Assiduidade</Badge>
            )}
            {tipoSelecionado.gera_financeiro && (
              <Badge variant="info">Gera Registro Financeiro</Badge>
            )}
            {tipoSelecionado.natureza_financeira && (
              <Badge variant={tipoSelecionado.natureza_financeira === 'Crédito' ? 'success' : 'danger'}>
                {tipoSelecionado.natureza_financeira}
              </Badge>
            )}
            {tipoSelecionado.tipo_falta && (
              <Badge variant={tipoSelecionado.tipo_falta === 'Justificada' ? 'info' : 'danger'}>
                Falta {tipoSelecionado.tipo_falta}
              </Badge>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Descricao</label>
          <textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        {/* Dynamic fields based on unidade_entrada */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Input
            label="Data Inicio *"
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
          {showDataFim && (
            <Input
              label="Data Fim"
              type="date"
              value={form.data_fim}
              onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
            />
          )}
          {showDiasField && (
            <Input
              label="Dias"
              type="number"
              value={form.dias.toString()}
              onChange={(e) => setForm({ ...form, dias: parseInt(e.target.value) || 1 })}
            />
          )}
          {showHorasField && (
            <Input
              label="Horas"
              type="number"
              value={form.horas.toString()}
              onChange={(e) => setForm({ ...form, horas: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          )}
          {showValorField && (
            <Input
              label="Valor (R$)"
              type="number"
              value={form.valor?.toString() || ''}
              onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          )}
        </div>

        {/* Show calculated value */}
        {valorCalculado != null && valorCalculado > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-azul">
              Valor calculado: R$ {valorCalculado.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-xs text-cinza-estrutural mt-1">
              {tipoSelecionado?.base_calculo === 'dia_trabalho' && `${form.dias} dia(s) x R$ ${valoresFuncionario?.valor_dia?.toFixed(2) || '0'}/dia`}
              {tipoSelecionado?.base_calculo === 'hora_trabalho' && `${form.horas}h x R$ ${valoresFuncionario?.valor_hora?.toFixed(2) || '0'}/hora`}
              {tipoSelecionado?.base_calculo === 'hora_extra' && `${form.horas}h x R$ ${valoresFuncionario?.valor_hora_extra?.toFixed(2) || '0'}/hora extra`}
            </p>
          </div>
        )}

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Arquivo</label>
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-estrutural hover:bg-gray-50 cursor-pointer transition-colors">
            <Upload size={16} />
            {uploading ? 'Enviando...' : form.arquivo_url ? 'Arquivo anexado' : 'Selecionar arquivo'}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || !form.funcionario_id} />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {tipoSelecionado?.permite_repetir && form.funcionario_id && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRepeatLast}>
                <RotateCcw size={14} /> Repetir Ultimo Registro
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !form.funcionario_id || !form.tipo_ocorrencia_id || !form.data_inicio}>
              {submitting ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
