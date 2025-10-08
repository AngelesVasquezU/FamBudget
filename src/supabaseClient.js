import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xtkfwphgsexjldtwhrsd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0a2Z3cGhnc2V4amxkdHdocnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjM0NTgsImV4cCI6MjA3NTQ5OTQ1OH0.ZamRxFjrolyEif6wgQTrEsaP-VMWlYpEtpf9PY0OAnE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)