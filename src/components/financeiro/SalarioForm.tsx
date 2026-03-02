'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase'

interface SalarioFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: SalarioFormData) => Promise<void>
  initial?: {
    id?: string
    salario_bruto?: number
    adicional_insalubridade?: number | null
    percentual_insalubridade?: number | null
    adicional_pagamento?: number | null
    vale_alimentacao?: number | null
    desconto_sindicato?: number | null
    salario_liquido?: number | null
    custo_funcionario?: number | null
    data_vigencia?: string
    observacao?: string | null
  }
}

export interface SalarioFormData {
  salario_bruto: number
  adicional_insalubridade: number | null
  percentual_insalubridade: number | null
  adicional_pagamento: number | null
  vale_alimentacao: number | null
  desconto_sindicato: number | null
  salario_liquido: number | null
  custo_funcionario: number | null
  data_vigencia: string
  observacao: string
}

function formatCurrencyInput(value: string): string {
  return value.replace(/[^\d.,]/g, '')
}

function parseCurrency(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

export function SalarioForm({ open, onClose, onSubmit, initial }: SalarioFormProps) {
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [bruto, setBruto] = useState('')
  const [adicionalInsalubridade, setAdicionalInsalubridade] = useState('')
  const [percentualInsalubridade, setPercentualInsalubridade] = useState('')
  const [adicionalPagamento, setAdicionalPagamento] = useState('')
  const [valeAlimentacao, setValeAlimentacao] = useState('')
  const [descontoSindicato, setDescontoSindicato] = useState('')
  const [liquido, setLiquido] = useState('')
  const [custo, setCusto] = useState('')
  const [dataVigencia, setDataVigencia] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salarioMinimo, setSalarioMinimo] = useState<number>(0)

  // Load salario_minimo from valores_base
  useEffect(() => {
    if (open) {
      supabase
        .from('valores_base')
        .select('valor')
        .eq('chave', 'salario_minimo')
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setSalarioMinimo(Number(data.valor) || 0)
          }
        })
    }
  }, [open])

  useEffect(() => {
    if (open) {
      if (initial) {
        setBruto(initial.salario_bruto?.toString() || '')
        setAdicionalInsalubridade(initial.adicional_insalubridade?.toString() || '')
        setPercentualInsalubridade(initial.percentual_insalubridade?.toString() || '')
        setAdicionalPagamento(initial.adicional_pagamento?.toString() || '')
        setValeAlimentacao(initial.vale_alimentacao?.toString() || '')
        setDescontoSindicato(initial.desconto_sindicato?.toString() || '')
        setLiquido(initial.salario_liquido?.toString() || '')
        setCusto(initial.custo_funcionario?.toString() || '')
        setDataVigencia(initial.data_vigencia || '')
        setObservacao(initial.observacao || '')
      } else {
        setBruto('')
        setAdicionalInsalubridade('')
        setPercentualInsalubridade('')
        setAdicionalPagamento('')
        setValeAlimentacao('')
        setDescontoSindicato('')
        setLiquido('')
        setCusto('')
        setDataVigencia('')
        setObservacao('')
      }
    }
  }, [open, initial])

  // Auto-calculate adicional_insalubridade when percentual changes
  function handlePercentualChange(value: string) {
    setPercentualInsalubridade(value)
    const pct = parseFloat(value) || 0
    if (pct > 0 && salarioMinimo > 0) {
      const calc = (pct * salarioMinimo / 100).toFixed(2)
      setAdicionalInsalubridade(calc)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const brutoVal = parseCurrency(bruto)
    if (!brutoVal || !dataVigencia) return

    setSubmitting(true)
    try {
      await onSubmit({
        salario_bruto: brutoVal,
        adicional_insalubridade: adicionalInsalubridade ? parseCurrency(adicionalInsalubridade) : null,
        percentual_insalubridade: percentualInsalubridade ? parseFloat(percentualInsalubridade) : null,
        adicional_pagamento: adicionalPagamento ? parseCurrency(adicionalPagamento) : null,
        vale_alimentacao: valeAlimentacao ? parseCurrency(valeAlimentacao) : null,
        desconto_sindicato: descontoSindicato ? parseCurrency(descontoSindicato) : null,
        salario_liquido: liquido ? parseCurrency(liquido) : null,
        custo_funcionario: custo ? parseCurrency(custo) : null,
        data_vigencia: dataVigencia,
        observacao,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Salario' : 'Registrar Novo Salario'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Salario Bruto * (R$)"
            value={bruto}
            onChange={(e) => setBruto(formatCurrencyInput(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
          />
          <Input
            label="Data Vigencia *"
            type="date"
            value={dataVigencia}
            onChange={(e) => setDataVigencia(e.target.value)}
          />
        </div>

        {/* Adicionais */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-bold text-cinza-preto mb-3">Adicionais e Descontos</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Percentual Insalubridade (%)"
                value={percentualInsalubridade}
                onChange={(e) => handlePercentualChange(e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
              <p className="text-xs text-cinza-estrutural mt-1">
                {salarioMinimo > 0 ? `Salario minimo: R$ ${salarioMinimo.toFixed(2).replace('.', ',')}` : 'Carregando salario minimo...'}
              </p>
            </div>
            <div>
              <Input
                label="Adicional Insalubridade (R$)"
                value={adicionalInsalubridade}
                onChange={(e) => setAdicionalInsalubridade(formatCurrencyInput(e.target.value))}
                placeholder="0.00"
                inputMode="decimal"
              />
              <p className="text-xs text-cinza-estrutural mt-1">% do salario minimo</p>
            </div>
            <Input
              label="Adicional de Pagamento (R$)"
              value={adicionalPagamento}
              onChange={(e) => setAdicionalPagamento(formatCurrencyInput(e.target.value))}
              placeholder="0.00"
              inputMode="decimal"
            />
            <Input
              label="Vale Alimentacao (R$)"
              value={valeAlimentacao}
              onChange={(e) => setValeAlimentacao(formatCurrencyInput(e.target.value))}
              placeholder="0.00"
              inputMode="decimal"
            />
            <Input
              label="Desconto Sindicato (R$)"
              value={descontoSindicato}
              onChange={(e) => setDescontoSindicato(formatCurrencyInput(e.target.value))}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
        </div>

        {/* Calculados */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-bold text-cinza-preto mb-3">Valores Calculados</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Salario Liquido (R$)"
              value={liquido}
              onChange={(e) => setLiquido(formatCurrencyInput(e.target.value))}
              placeholder="0.00"
              inputMode="decimal"
            />
            <Input
              label="Custo Funcionario (R$)"
              value={custo}
              onChange={(e) => setCusto(formatCurrencyInput(e.target.value))}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-cinza-preto mb-1">Observacao</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-cinza-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting || !bruto || !dataVigencia}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
