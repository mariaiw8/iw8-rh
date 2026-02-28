-- ============================================================
-- SISTEMA DE FÉRIAS COMPLETO - SQL para Supabase
-- Inclui: Triggers, Funções e Views
-- ============================================================

-- ============================================================
-- 1. FUNÇÃO + TRIGGER: Recalcular saldo ao inserir/editar/excluir férias
-- ============================================================

DROP FUNCTION IF EXISTS fn_recalcular_saldo_ferias() CASCADE;

CREATE OR REPLACE FUNCTION fn_recalcular_saldo_ferias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_id UUID;
  v_dias_gozados INT;
  v_dias_vendidos INT;
  v_dias_direito INT;
  v_dias_restantes INT;
  v_novo_status TEXT;
BEGIN
  -- Determinar qual ferias_saldo_id deve ser recalculado
  IF TG_OP = 'DELETE' THEN
    v_saldo_id := OLD.ferias_saldo_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se mudou o ferias_saldo_id, recalcular o antigo também
    IF OLD.ferias_saldo_id IS DISTINCT FROM NEW.ferias_saldo_id AND OLD.ferias_saldo_id IS NOT NULL THEN
      -- Recalcular saldo antigo
      SELECT COALESCE(SUM(f.dias), 0), COALESCE(SUM(f.dias_vendidos), 0)
      INTO v_dias_gozados, v_dias_vendidos
      FROM ferias f
      WHERE f.ferias_saldo_id = OLD.ferias_saldo_id
        AND f.status != 'Cancelada';

      SELECT fs.dias_direito INTO v_dias_direito
      FROM ferias_saldo fs
      WHERE fs.id = OLD.ferias_saldo_id;

      IF v_dias_direito IS NOT NULL THEN
        v_dias_restantes := v_dias_direito - v_dias_gozados - v_dias_vendidos;
        IF v_dias_restantes < 0 THEN v_dias_restantes := 0; END IF;

        IF v_dias_restantes = v_dias_direito THEN
          v_novo_status := 'Disponível';
        ELSIF v_dias_restantes = 0 THEN
          v_novo_status := 'Gozado';
        ELSE
          v_novo_status := 'Parcial';
        END IF;

        UPDATE ferias_saldo
        SET dias_gozados = v_dias_gozados,
            dias_vendidos = v_dias_vendidos,
            dias_restantes = v_dias_restantes,
            status = v_novo_status,
            updated_at = NOW()
        WHERE id = OLD.ferias_saldo_id;
      END IF;
    END IF;
    v_saldo_id := NEW.ferias_saldo_id;
  ELSE
    v_saldo_id := NEW.ferias_saldo_id;
  END IF;

  -- Se não há saldo vinculado, retornar
  IF v_saldo_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Recalcular o saldo atual
  BEGIN
    SELECT COALESCE(SUM(f.dias), 0), COALESCE(SUM(f.dias_vendidos), 0)
    INTO v_dias_gozados, v_dias_vendidos
    FROM ferias f
    WHERE f.ferias_saldo_id = v_saldo_id
      AND f.status != 'Cancelada';

    SELECT fs.dias_direito INTO v_dias_direito
    FROM ferias_saldo fs
    WHERE fs.id = v_saldo_id;

    IF v_dias_direito IS NOT NULL THEN
      v_dias_restantes := v_dias_direito - v_dias_gozados - v_dias_vendidos;
      IF v_dias_restantes < 0 THEN v_dias_restantes := 0; END IF;

      -- Determinar novo status
      IF v_dias_restantes = v_dias_direito THEN
        v_novo_status := 'Disponível';
      ELSIF v_dias_restantes = 0 THEN
        v_novo_status := 'Gozado';
      ELSE
        v_novo_status := 'Parcial';
      END IF;

      UPDATE ferias_saldo
      SET dias_gozados = v_dias_gozados,
          dias_vendidos = v_dias_vendidos,
          dias_restantes = v_dias_restantes,
          status = v_novo_status,
          updated_at = NOW()
      WHERE id = v_saldo_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao recalcular saldo %: %', v_saldo_id, SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Criar trigger na tabela ferias
DROP TRIGGER IF EXISTS trg_recalcular_saldo_ferias ON ferias;

CREATE TRIGGER trg_recalcular_saldo_ferias
AFTER INSERT OR UPDATE OR DELETE ON ferias
FOR EACH ROW
EXECUTE FUNCTION fn_recalcular_saldo_ferias();

-- ============================================================
-- 2. FUNÇÃO + TRIGGER: Férias coletivas geram lançamentos individuais
-- ============================================================

DROP FUNCTION IF EXISTS fn_gerar_ferias_coletivas() CASCADE;

CREATE OR REPLACE FUNCTION fn_gerar_ferias_coletivas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_func RECORD;
  v_saldo_id UUID;
  v_count INT := 0;
BEGIN
  -- Buscar todos os funcionários ativos da unidade/setor
  FOR v_func IN
    SELECT f.id AS funcionario_id
    FROM funcionarios f
    WHERE f.status = 'Ativo'
      AND (NEW.unidade_id IS NULL OR f.unidade_id = NEW.unidade_id)
      AND (NEW.setor_id IS NULL OR f.setor_id = NEW.setor_id)
  LOOP
    -- Buscar saldo disponível mais recente
    SELECT fs.id INTO v_saldo_id
    FROM ferias_saldo fs
    WHERE fs.funcionario_id = v_func.funcionario_id
      AND fs.status IN ('Disponível', 'Parcial')
      AND fs.dias_restantes > 0
    ORDER BY fs.periodo_aquisitivo_inicio DESC
    LIMIT 1;

    -- Criar registro individual de férias
    BEGIN
      INSERT INTO ferias (
        funcionario_id,
        ferias_saldo_id,
        data_inicio,
        data_fim,
        dias,
        tipo,
        status,
        observacao
      ) VALUES (
        v_func.funcionario_id,
        v_saldo_id, -- Pode ser NULL se não tiver saldo
        NEW.data_inicio,
        NEW.data_fim,
        NEW.dias,
        'Coletiva',
        'Programada',
        'Férias coletivas: ' || NEW.titulo
      );

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao gerar férias coletivas para funcionário %: %', v_func.funcionario_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Férias coletivas geradas para % funcionários', v_count;
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_gerar_ferias_coletivas ON ferias_coletivas;

CREATE TRIGGER trg_gerar_ferias_coletivas
AFTER INSERT ON ferias_coletivas
FOR EACH ROW
EXECUTE FUNCTION fn_gerar_ferias_coletivas();

-- ============================================================
-- 3. FUNÇÃO + TRIGGER: Cancelar férias ao excluir coletivas
-- ============================================================

DROP FUNCTION IF EXISTS fn_cancelar_ferias_coletivas() CASCADE;

CREATE OR REPLACE FUNCTION fn_cancelar_ferias_coletivas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Cancelar todas as férias individuais geradas pela coletiva
  UPDATE ferias
  SET status = 'Cancelada',
      updated_at = NOW()
  WHERE tipo = 'Coletiva'
    AND data_inicio = OLD.data_inicio
    AND data_fim = OLD.data_fim
    AND observacao LIKE 'Férias coletivas: ' || OLD.titulo || '%'
    AND status != 'Cancelada';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Canceladas % férias individuais da coletiva "%"', v_count, OLD.titulo;

  RETURN OLD;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_cancelar_ferias_coletivas ON ferias_coletivas;

CREATE TRIGGER trg_cancelar_ferias_coletivas
BEFORE DELETE ON ferias_coletivas
FOR EACH ROW
EXECUTE FUNCTION fn_cancelar_ferias_coletivas();

-- ============================================================
-- 5. VIEW: Gestão de Férias consolidada
-- ============================================================

DROP VIEW IF EXISTS vw_ferias_gestao;

CREATE OR REPLACE VIEW vw_ferias_gestao AS
SELECT
  f.id,
  f.funcionario_id,
  f.ferias_saldo_id,
  f.data_inicio,
  f.data_fim,
  f.dias,
  f.tipo,
  f.status,
  f.abono_pecuniario,
  f.dias_vendidos AS ferias_dias_vendidos,
  f.observacao,
  f.created_at,
  func.nome_completo,
  func.codigo,
  u.titulo AS unidade,
  s.titulo AS setor,
  fs.periodo_aquisitivo_inicio,
  fs.periodo_aquisitivo_fim,
  fs.dias_direito,
  fs.dias_restantes,
  fs.status AS saldo_status
FROM ferias f
INNER JOIN funcionarios func ON func.id = f.funcionario_id
LEFT JOIN unidades u ON u.id = func.unidade_id
LEFT JOIN setores s ON s.id = func.setor_id
LEFT JOIN ferias_saldo fs ON fs.id = f.ferias_saldo_id
ORDER BY f.created_at DESC;

-- ============================================================
-- 6. VIEW: Férias coletivas com resumo
-- ============================================================

DROP VIEW IF EXISTS vw_ferias_coletivas_resumo;

CREATE OR REPLACE VIEW vw_ferias_coletivas_resumo AS
SELECT
  fc.id,
  fc.titulo,
  fc.data_inicio,
  fc.data_fim,
  fc.dias,
  fc.unidade_id,
  fc.setor_id,
  fc.observacao,
  fc.created_at,
  u.titulo AS unidade_nome,
  s.titulo AS setor_nome,
  COALESCE(af.total_afetados, 0) AS total_afetados
FROM ferias_coletivas fc
LEFT JOIN unidades u ON u.id = fc.unidade_id
LEFT JOIN setores s ON s.id = fc.setor_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_afetados
  FROM ferias f
  WHERE f.tipo = 'Coletiva'
    AND f.data_inicio = fc.data_inicio
    AND f.data_fim = fc.data_fim
    AND f.observacao LIKE 'Férias coletivas: ' || fc.titulo || '%'
    AND f.status != 'Cancelada'
) af ON TRUE
ORDER BY fc.data_inicio DESC;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
