-- ============================================================================
-- 1. FIX: Políticas RLS na tabela "ferias"
--    A tabela tem RLS habilitado mas faltam policies para SELECT/UPDATE/DELETE.
--    Isso causa 403 ao tentar ler ou atualizar férias.
-- ============================================================================

-- Garante que RLS está habilitado
ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias' AND policyname = 'allow_select_ferias'
  ) THEN
    CREATE POLICY allow_select_ferias ON ferias
      FOR SELECT TO authenticated USING (true);
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias' AND policyname = 'allow_insert_ferias'
  ) THEN
    CREATE POLICY allow_insert_ferias ON ferias
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias' AND policyname = 'allow_update_ferias'
  ) THEN
    CREATE POLICY allow_update_ferias ON ferias
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias' AND policyname = 'allow_delete_ferias'
  ) THEN
    CREATE POLICY allow_delete_ferias ON ferias
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- 2. FIX: Policy de UPDATE em ferias_movimentacoes (faltava)
--    O trigger que debita/estorna o ledger pode precisar de UPDATE além de INSERT.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias_movimentacoes' AND policyname = 'allow_update_ferias_movimentacoes'
  ) THEN
    CREATE POLICY allow_update_ferias_movimentacoes ON ferias_movimentacoes
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 3. FIX: Recriar trigger function como SECURITY DEFINER
--    O trigger que insere movimentações ao mudar status precisa bypassar RLS,
--    senão o INSERT na ferias_movimentacoes falha com "violates row-level security".
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_ferias_status_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alocacao RECORD;
BEGIN
  -- Só atua quando o status realmente muda
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- ── Aprovada → debita saldo (gozo + venda) ──
  IF NEW.status = 'Aprovada' THEN
    -- Débitos de gozo
    FOR v_alocacao IN
      SELECT ferias_periodo_id, dias
      FROM ferias_alocacoes
      WHERE ferias_id = NEW.id
    LOOP
      INSERT INTO ferias_movimentacoes
        (ferias_periodo_id, data, natureza, tipo, dias, origem_tabela, origem_id, observacao)
      VALUES
        (v_alocacao.ferias_periodo_id, now()::date, 'Débito', 'Gozo', v_alocacao.dias,
         'ferias', NEW.id, 'Aprovação de férias');
    END LOOP;

    -- Débitos de venda/abono
    FOR v_alocacao IN
      SELECT ferias_periodo_id, dias
      FROM ferias_venda_alocacoes
      WHERE ferias_id = NEW.id
    LOOP
      INSERT INTO ferias_movimentacoes
        (ferias_periodo_id, data, natureza, tipo, dias, origem_tabela, origem_id, observacao)
      VALUES
        (v_alocacao.ferias_periodo_id, now()::date, 'Débito', 'Venda/Abono', v_alocacao.dias,
         'ferias', NEW.id, 'Abono pecuniário aprovado');
    END LOOP;

  -- ── Cancelada → estorna débitos anteriores ──
  ELSIF NEW.status = 'Cancelada' THEN
    FOR v_alocacao IN
      SELECT ferias_periodo_id, dias, tipo
      FROM ferias_movimentacoes
      WHERE origem_tabela = 'ferias'
        AND origem_id = NEW.id
        AND natureza = 'Débito'
    LOOP
      INSERT INTO ferias_movimentacoes
        (ferias_periodo_id, data, natureza, tipo, dias, origem_tabela, origem_id, observacao)
      VALUES
        (v_alocacao.ferias_periodo_id, now()::date, 'Crédito', 'Estorno', v_alocacao.dias,
         'ferias', NEW.id, 'Estorno por cancelamento');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recria o trigger (DROP + CREATE garante que aponta para a nova function)
DROP TRIGGER IF EXISTS trg_ferias_status_ledger ON ferias;
CREATE TRIGGER trg_ferias_status_ledger
  AFTER UPDATE OF status ON ferias
  FOR EACH ROW
  EXECUTE FUNCTION fn_ferias_status_ledger();

-- ============================================================================
-- 4. FEATURE: Geração automática de períodos aquisitivos
--    Cron/trigger que cria o próximo período quando o último vence.
--    Considera apenas funcionários com data_admissao antes de 2026-02-01
--    e gera períodos a partir de 02/2026 para não poluir a base.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_gerar_periodos_aquisitivos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func RECORD;
  v_ultimo_fim DATE;
  v_novo_inicio DATE;
  v_novo_fim DATE;
  v_vencimento DATE;
BEGIN
  -- Para cada funcionário ativo que tenha pelo menos 1 período
  FOR v_func IN
    SELECT DISTINCT f.funcionario_id, func.data_admissao
    FROM ferias_periodos f
    JOIN funcionarios func ON func.id = f.funcionario_id
    WHERE func.status = 'Ativo'
  LOOP
    -- Pega a data fim do último período aquisitivo
    SELECT MAX(aquisitivo_fim) INTO v_ultimo_fim
    FROM ferias_periodos
    WHERE funcionario_id = v_func.funcionario_id;

    -- Se o último período já venceu (aquisitivo_fim <= hoje),
    -- cria o próximo período de 1 ano
    WHILE v_ultimo_fim <= CURRENT_DATE LOOP
      v_novo_inicio := v_ultimo_fim + INTERVAL '1 day';
      v_novo_fim    := v_novo_inicio + INTERVAL '1 year' - INTERVAL '1 day';
      v_vencimento  := v_novo_fim + INTERVAL '11 months';

      -- Só cria períodos a partir de 2026-02-01
      IF v_novo_inicio >= '2026-02-01'::date THEN
        INSERT INTO ferias_periodos
          (funcionario_id, aquisitivo_inicio, aquisitivo_fim, data_vencimento, dias_direito)
        VALUES
          (v_func.funcionario_id, v_novo_inicio, v_novo_fim, v_vencimento, 30)
        ON CONFLICT DO NOTHING;
      END IF;

      v_ultimo_fim := v_novo_fim;
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger: quando um período vence, gerar o próximo automaticamente
-- (dispara no INSERT/UPDATE de ferias_periodos para manter atualizado)
CREATE OR REPLACE FUNCTION fn_auto_proximo_periodo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existe BOOLEAN;
  v_novo_inicio DATE;
  v_novo_fim DATE;
  v_vencimento DATE;
  v_func_ativo BOOLEAN;
BEGIN
  -- Verifica se o funcionário está ativo
  SELECT (status = 'Ativo') INTO v_func_ativo
  FROM funcionarios WHERE id = NEW.funcionario_id;

  IF NOT v_func_ativo THEN
    RETURN NEW;
  END IF;

  -- Calcula próximo período
  v_novo_inicio := NEW.aquisitivo_fim + INTERVAL '1 day';
  v_novo_fim    := v_novo_inicio + INTERVAL '1 year' - INTERVAL '1 day';
  v_vencimento  := v_novo_fim + INTERVAL '11 months';

  -- Só cria a partir de 2026-02-01 e se o período corrente já venceu
  IF v_novo_inicio >= '2026-02-01'::date AND NEW.aquisitivo_fim <= CURRENT_DATE THEN
    -- Verifica se já existe
    SELECT EXISTS(
      SELECT 1 FROM ferias_periodos
      WHERE funcionario_id = NEW.funcionario_id
        AND aquisitivo_inicio = v_novo_inicio
    ) INTO v_existe;

    IF NOT v_existe THEN
      INSERT INTO ferias_periodos
        (funcionario_id, aquisitivo_inicio, aquisitivo_fim, data_vencimento, dias_direito)
      VALUES
        (NEW.funcionario_id, v_novo_inicio, v_novo_fim, v_vencimento, 30);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_proximo_periodo ON ferias_periodos;
CREATE TRIGGER trg_auto_proximo_periodo
  AFTER INSERT OR UPDATE ON ferias_periodos
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_proximo_periodo();

-- ============================================================================
-- 5. Executa a geração inicial para preencher períodos faltantes
--    (para funcionários que já têm períodos vencidos)
-- ============================================================================
SELECT fn_gerar_periodos_aquisitivos();

-- ============================================================================
-- 6. (Opcional) Agendar via pg_cron para rodar diariamente
--    Descomente se pg_cron estiver habilitado no Supabase:
-- ============================================================================
-- SELECT cron.schedule(
--   'gerar-periodos-aquisitivos',
--   '0 3 * * *',  -- todo dia às 3h da manhã
--   $$ SELECT fn_gerar_periodos_aquisitivos() $$
-- );
