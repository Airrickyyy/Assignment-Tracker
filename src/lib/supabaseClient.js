import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'YOUR_PROJECT_URL') {
  throw new Error(
    '[JARVIS] VITE_SUPABASE_URL is not set. ' +
    'Open .env.local and replace YOUR_PROJECT_URL with your Supabase project URL.'
  )
}

if (!supabaseAnon || supabaseAnon === 'YOUR_PUBLISHABLE_OR_ANON_KEY') {
  throw new Error(
    '[JARVIS] VITE_SUPABASE_ANON_KEY is not set. ' +
    'Open .env.local and replace YOUR_PUBLISHABLE_OR_ANON_KEY with your anon/public key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnon)
