import { createClient } from '@supabase/supabase-js'

// Essas variáveis vêm do arquivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cria a "ponte" entre o app e o banco de dados
export const supabase = createClient(supabaseUrl, supabaseKey)