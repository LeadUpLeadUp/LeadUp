import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vhvlkerectggovfihjgm.supabase.co'
const SUPABASE_ANON = 'sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
