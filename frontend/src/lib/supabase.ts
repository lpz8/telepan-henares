import { createClient } from '@supabase/supabase-js'
const SUPABASE_URL = 'https://cbozydjosionujkrxhwz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNib3p5ZGpvc2lvbnVqa3J4aHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTU5ODUsImV4cCI6MjA5MDM5MTk4NX0.wsfCKk-T4X3YVH_F_iyFTu27G-ljUH8ZSVH-ihuhXyI'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
