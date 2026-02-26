-- Adiciona campos de expediente (horário de trabalho) na tabela setores
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_seg_qui_entrada time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_seg_qui_saida time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_seg_qui_almoco_inicio time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_seg_qui_almoco_fim time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_sex_entrada time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_sex_saida time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_sex_almoco_inicio time;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS horario_sex_almoco_fim time;
