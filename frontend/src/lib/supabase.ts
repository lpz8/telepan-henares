import { createClient } from '@supabase/supabase-js'
const SUPABASE_URL = 'https://bpuczelfocsezmwhbjev.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdWN6ZWxmb2NzZXptd2hiamV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDY1NzAsImV4cCI6MjEwNjg4MjU3MH0.h4Qch_k4nUma0G6NNbrEHLLTc0lvpj0N7hH2HtTmPho'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)