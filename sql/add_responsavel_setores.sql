-- Adiciona campo de responsavel na tabela setores
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE setores ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES funcionarios(id);
