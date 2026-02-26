-- =====================================================
-- IW8 RH - ETAPA 2: SQL para Ferias, Ocorrencias e Calendario
-- Execute no Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABELA: tipos_ocorrencia
-- =====================================================
CREATE TABLE IF NOT EXISTS tipos_ocorrencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('Remuneracao', 'Ausencia', 'Disciplinar', 'Beneficio', 'Outro')),
  cor text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Tipos padrao
INSERT INTO tipos_ocorrencia (titulo, categoria, cor) VALUES
  ('Atestado Medico', 'Ausencia', '#EF4444'),
  ('Falta Justificada', 'Ausencia', '#F97316'),
  ('Falta Injustificada', 'Ausencia', '#DC2626'),
  ('Hora Extra', 'Remuneracao', '#22C55E'),
  ('Adicional Noturno', 'Remuneracao', '#14B8A6'),
  ('Advertencia Verbal', 'Disciplinar', '#F59E0B'),
  ('Advertencia Escrita', 'Disciplinar', '#D97706'),
  ('Suspensao', 'Disciplinar', '#B91C1C'),
  ('Vale Transporte', 'Beneficio', '#3B82F6'),
  ('Vale Alimentacao', 'Beneficio', '#6366F1'),
  ('Licenca Maternidade', 'Ausencia', '#EC4899'),
  ('Licenca Paternidade', 'Ausencia', '#8B5CF6'),
  ('Afastamento INSS', 'Ausencia', '#78716C'),
  ('Outro', 'Outro', '#6B7280')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. TABELA: ferias_saldo (Periodos Aquisitivos)
-- =====================================================
CREATE TABLE IF NOT EXISTS ferias_saldo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  dias_direito integer NOT NULL DEFAULT 30,
  dias_gozados integer NOT NULL DEFAULT 0,
  dias_vendidos integer NOT NULL DEFAULT 0,
  dias_restantes integer GENERATED ALWAYS AS (dias_direito - dias_gozados - dias_vendidos) STORED,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'Disponivel',
  created_at timestamptz DEFAULT now(),

  CONSTRAINT chk_dias_vendidos CHECK (dias_vendidos >= 0 AND dias_vendidos <= 10),
  CONSTRAINT chk_dias_gozados CHECK (dias_gozados >= 0),
  CONSTRAINT chk_dias_direito CHECK (dias_direito > 0)
);

CREATE INDEX IF NOT EXISTS idx_ferias_saldo_funcionario ON ferias_saldo(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ferias_saldo_vencimento ON ferias_saldo(data_vencimento);

-- =====================================================
-- 3. TABELA: ferias
-- =====================================================
CREATE TABLE IF NOT EXISTS ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias integer NOT NULL,
  tipo text NOT NULL DEFAULT 'Individual' CHECK (tipo IN ('Individual', 'Coletiva')),
  status text NOT NULL DEFAULT 'Programada' CHECK (status IN ('Programada', 'Em Andamento', 'Concluida', 'Cancelada')),
  periodo_aquisitivo_id uuid REFERENCES ferias_saldo(id) ON DELETE SET NULL,
  abono_pecuniario boolean DEFAULT false,
  dias_vendidos integer DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT chk_ferias_datas CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_ferias_dias CHECK (dias > 0)
);

CREATE INDEX IF NOT EXISTS idx_ferias_funcionario ON ferias(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ferias_status ON ferias(status);
CREATE INDEX IF NOT EXISTS idx_ferias_datas ON ferias(data_inicio, data_fim);

-- =====================================================
-- 4. TABELA: ferias_coletivas
-- =====================================================
CREATE TABLE IF NOT EXISTS ferias_coletivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias integer NOT NULL,
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  setor_id uuid REFERENCES setores(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT chk_coletivas_datas CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_coletivas_dias CHECK (dias > 0)
);

-- =====================================================
-- 5. TABELA: ocorrencias
-- =====================================================
CREATE TABLE IF NOT EXISTS ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  tipo_ocorrencia_id uuid NOT NULL REFERENCES tipos_ocorrencia(id) ON DELETE RESTRICT,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date,
  dias integer NOT NULL DEFAULT 1,
  valor numeric(10,2),
  arquivo_url text,
  observacao text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT chk_ocorrencia_dias CHECK (dias > 0)
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_funcionario ON ocorrencias(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_tipo ON ocorrencias(tipo_ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_data ON ocorrencias(data_inicio);

-- =====================================================
-- 6. TABELA: filhos (caso nao exista)
-- =====================================================
CREATE TABLE IF NOT EXISTS filhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data_nascimento date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_filhos_funcionario ON filhos(funcionario_id);

-- =====================================================
-- 7. FUNCAO: Atualizar status do ferias_saldo automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION fn_atualizar_status_ferias_saldo()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular dias_restantes (campo GENERATED, mas precisamos do status)
  IF (NEW.dias_direito - NEW.dias_gozados - NEW.dias_vendidos) <= 0 THEN
    NEW.status := 'Gozado';
  ELSIF NEW.data_vencimento < CURRENT_DATE AND (NEW.dias_direito - NEW.dias_gozados - NEW.dias_vendidos) > 0 THEN
    NEW.status := 'Vencido';
  ELSIF NEW.dias_gozados > 0 OR NEW.dias_vendidos > 0 THEN
    NEW.status := 'Parcial';
  ELSE
    NEW.status := 'Disponivel';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ferias_saldo_status ON ferias_saldo;
CREATE TRIGGER trg_ferias_saldo_status
  BEFORE INSERT OR UPDATE ON ferias_saldo
  FOR EACH ROW
  EXECUTE FUNCTION fn_atualizar_status_ferias_saldo();

-- =====================================================
-- 8. FUNCAO: Atualizar status das ferias automaticamente
--    (Programada -> Em Andamento -> Concluida)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_atualizar_status_ferias()
RETURNS void AS $$
BEGIN
  -- Ferias que ja comecaram
  UPDATE ferias
  SET status = 'Em Andamento'
  WHERE status = 'Programada'
    AND data_inicio <= CURRENT_DATE
    AND data_fim >= CURRENT_DATE;

  -- Ferias que ja terminaram
  UPDATE ferias
  SET status = 'Concluida'
  WHERE status IN ('Programada', 'Em Andamento')
    AND data_fim < CURRENT_DATE;

  -- Atualizar saldos vencidos
  UPDATE ferias_saldo
  SET status = 'Vencido'
  WHERE status NOT IN ('Gozado', 'Vencido')
    AND data_vencimento < CURRENT_DATE
    AND (dias_direito - dias_gozados - dias_vendidos) > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. VIEW: vw_ferias_a_vencer
-- =====================================================
CREATE OR REPLACE VIEW vw_ferias_a_vencer AS
SELECT
  fs.id,
  fs.funcionario_id,
  f.nome_completo AS nome,
  f.codigo,
  TO_CHAR(fs.periodo_inicio, 'DD/MM/YYYY') || ' a ' || TO_CHAR(fs.periodo_fim, 'DD/MM/YYYY') AS periodo_aquisitivo,
  fs.dias_restantes,
  fs.data_vencimento,
  (fs.data_vencimento - CURRENT_DATE) AS dias_para_vencer,
  CASE
    WHEN fs.data_vencimento < CURRENT_DATE THEN 'VENCIDA'
    WHEN fs.data_vencimento <= (CURRENT_DATE + INTERVAL '4 months') THEN 'ALERTA'
    ELSE 'OK'
  END AS situacao
FROM ferias_saldo fs
JOIN funcionarios f ON f.id = fs.funcionario_id
WHERE f.status = 'Ativo'
  AND (fs.dias_direito - fs.dias_gozados - fs.dias_vendidos) > 0
ORDER BY
  CASE
    WHEN fs.data_vencimento < CURRENT_DATE THEN 0
    WHEN fs.data_vencimento <= (CURRENT_DATE + INTERVAL '4 months') THEN 1
    ELSE 2
  END,
  fs.data_vencimento ASC;

-- =====================================================
-- 10. VIEW: vw_proximas_ferias
-- =====================================================
CREATE OR REPLACE VIEW vw_proximas_ferias AS
SELECT
  fer.id,
  fer.funcionario_id,
  f.nome_completo AS nome,
  f.codigo,
  u.titulo AS unidade,
  s.titulo AS setor,
  fer.data_inicio,
  fer.data_fim,
  fer.dias,
  fer.status
FROM ferias fer
JOIN funcionarios f ON f.id = fer.funcionario_id
LEFT JOIN unidades u ON u.id = f.unidade_id
LEFT JOIN setores s ON s.id = f.setor_id
WHERE fer.status IN ('Programada', 'Em Andamento')
  AND fer.data_fim >= CURRENT_DATE
ORDER BY fer.data_inicio ASC;

-- =====================================================
-- 11. VIEW: vw_calendario (Unificada)
-- =====================================================
CREATE OR REPLACE VIEW vw_calendario AS
-- Ferias individuais
SELECT
  fer.id,
  'Ferias - ' || f.nome_completo AS titulo,
  'ferias'::text AS tipo,
  f.nome_completo AS funcionario_nome,
  fer.data_inicio,
  fer.data_fim,
  fer.dias,
  '#F5AF00' AS cor
FROM ferias fer
JOIN funcionarios f ON f.id = fer.funcionario_id
WHERE fer.status != 'Cancelada'

UNION ALL

-- Ocorrencias
SELECT
  o.id,
  t.titulo || ' - ' || f.nome_completo AS titulo,
  'ocorrencia'::text AS tipo,
  f.nome_completo AS funcionario_nome,
  o.data_inicio,
  COALESCE(o.data_fim, o.data_inicio) AS data_fim,
  o.dias,
  t.cor
FROM ocorrencias o
JOIN funcionarios f ON f.id = o.funcionario_id
JOIN tipos_ocorrencia t ON t.id = o.tipo_ocorrencia_id

UNION ALL

-- Ferias coletivas
SELECT
  fc.id,
  'Coletivas: ' || fc.titulo AS titulo,
  'ferias_coletivas'::text AS tipo,
  NULL AS funcionario_nome,
  fc.data_inicio,
  fc.data_fim,
  fc.dias,
  '#E57B25' AS cor
FROM ferias_coletivas fc;

-- =====================================================
-- 12. VIEW: vw_resumo_setores (caso nao exista)
-- =====================================================
CREATE OR REPLACE VIEW vw_resumo_setores AS
SELECT
  s.id,
  s.titulo,
  s.tipo,
  s.unidade_id,
  u.titulo AS unidade_titulo,
  COUNT(f.id) AS num_funcionarios
FROM setores s
LEFT JOIN unidades u ON u.id = s.unidade_id
LEFT JOIN funcionarios f ON f.setor_id = s.id AND f.status = 'Ativo'
GROUP BY s.id, s.titulo, s.tipo, s.unidade_id, u.titulo
ORDER BY s.titulo;

-- =====================================================
-- 13. VIEW: vw_resumo_unidades (caso nao exista)
-- =====================================================
CREATE OR REPLACE VIEW vw_resumo_unidades AS
SELECT
  u.id,
  u.titulo,
  u.cnpj,
  u.cidade,
  u.estado,
  COUNT(DISTINCT s.id) AS num_setores,
  COUNT(DISTINCT f.id) AS num_funcionarios
FROM unidades u
LEFT JOIN setores s ON s.unidade_id = u.id
LEFT JOIN funcionarios f ON f.unidade_id = u.id AND f.status = 'Ativo'
GROUP BY u.id, u.titulo, u.cnpj, u.cidade, u.estado
ORDER BY u.titulo;

-- =====================================================
-- 14. FUNCAO: Creditar saldo automatico na admissao
--     (30 dias a cada aniversario de admissao)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_creditar_ferias_saldo()
RETURNS void AS $$
DECLARE
  rec RECORD;
  periodo_start DATE;
  periodo_end DATE;
  vencimento DATE;
  ano_count INTEGER;
BEGIN
  FOR rec IN
    SELECT id, data_admissao
    FROM funcionarios
    WHERE status = 'Ativo' AND data_admissao IS NOT NULL
  LOOP
    ano_count := 0;
    LOOP
      periodo_start := rec.data_admissao + (ano_count * INTERVAL '1 year');
      periodo_end := rec.data_admissao + ((ano_count + 1) * INTERVAL '1 year') - INTERVAL '1 day';
      vencimento := rec.data_admissao + ((ano_count + 2) * INTERVAL '1 year') - INTERVAL '1 day';

      -- Sair se o periodo ainda nao comecou
      EXIT WHEN periodo_start > CURRENT_DATE;

      -- Inserir apenas se nao existir
      INSERT INTO ferias_saldo (funcionario_id, periodo_inicio, periodo_fim, dias_direito, data_vencimento)
      SELECT rec.id, periodo_start::date, periodo_end::date, 30, vencimento::date
      WHERE NOT EXISTS (
        SELECT 1 FROM ferias_saldo
        WHERE funcionario_id = rec.id
          AND periodo_inicio = periodo_start::date
      );

      ano_count := ano_count + 1;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar creditacao inicial
SELECT fn_creditar_ferias_saldo();

-- =====================================================
-- 15. RLS (Row Level Security) - Politicas basicas
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE tipos_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias_saldo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias_coletivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE filhos ENABLE ROW LEVEL SECURITY;

-- Politicas: usuarios autenticados podem tudo (ajuste conforme necessidade)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tipos_ocorrencia', 'ferias_saldo', 'ferias', 'ferias_coletivas', 'ocorrencias', 'filhos']
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "%s_select" ON %I;
      CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (true);
    ', tbl, tbl, tbl, tbl);

    EXECUTE format('
      DROP POLICY IF EXISTS "%s_insert" ON %I;
      CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (true);
    ', tbl, tbl, tbl, tbl);

    EXECUTE format('
      DROP POLICY IF EXISTS "%s_update" ON %I;
      CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    ', tbl, tbl, tbl, tbl);

    EXECUTE format('
      DROP POLICY IF EXISTS "%s_delete" ON %I;
      CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING (true);
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;

-- =====================================================
-- 16. STORAGE: Politica para bucket arquivos-rh
-- =====================================================
-- (Caso a pasta atestados ainda nao tenha politica)
-- Executar apenas se necessario:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('arquivos-rh', 'arquivos-rh', true)
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PRONTO! Execute fn_atualizar_status_ferias()
-- periodicamente (cron ou edge function) para manter
-- os status de ferias atualizados automaticamente.
-- =====================================================

-- Exemplo de execucao manual:
-- SELECT fn_atualizar_status_ferias();
-- SELECT fn_creditar_ferias_saldo();
