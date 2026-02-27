-- Cria a tabela "familia" para armazenar familiares dos funcionários
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS familia (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  parentesco text NOT NULL,
  data_nascimento date,
  created_at timestamptz DEFAULT now()
);

-- Índice para busca por funcionário
CREATE INDEX IF NOT EXISTS idx_familia_funcionario_id ON familia(funcionario_id);

-- RLS (Row Level Security)
ALTER TABLE familia ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso autenticado
CREATE POLICY "Acesso autenticado familia" ON familia
  FOR ALL
  USING (true)
  WITH CHECK (true);
