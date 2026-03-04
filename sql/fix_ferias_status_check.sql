-- Corrige a constraint ferias_status_check para aceitar todos os status usados pelo sistema.
-- Executar no Supabase SQL Editor.

ALTER TABLE ferias DROP CONSTRAINT IF EXISTS ferias_status_check;

ALTER TABLE ferias ADD CONSTRAINT ferias_status_check
  CHECK (status IN ('Programada', 'Aprovada', 'Em Andamento', 'Concluída', 'Cancelada'));

-- Também garante RLS para ferias_alocacoes e ferias_venda_alocacoes
-- (necessário para que o client possa inserir alocações)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias_alocacoes' AND policyname = 'allow_insert_ferias_alocacoes'
  ) THEN
    CREATE POLICY allow_insert_ferias_alocacoes ON ferias_alocacoes
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias_alocacoes' AND policyname = 'allow_select_ferias_alocacoes'
  ) THEN
    CREATE POLICY allow_select_ferias_alocacoes ON ferias_alocacoes
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias_venda_alocacoes' AND policyname = 'allow_insert_ferias_venda_alocacoes'
  ) THEN
    CREATE POLICY allow_insert_ferias_venda_alocacoes ON ferias_venda_alocacoes
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ferias_venda_alocacoes' AND policyname = 'allow_select_ferias_venda_alocacoes'
  ) THEN
    CREATE POLICY allow_select_ferias_venda_alocacoes ON ferias_venda_alocacoes
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
