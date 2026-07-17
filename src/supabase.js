import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  document.body.innerHTML =
    '<div style="color:white;background:#111;padding:20px;font-family:sans-serif;white-space:pre-wrap">' +
    'Missing Supabase config.\n\nURL: ' + url + '\nKEY present: ' + (!!key) +
    '</div>'
}

export const supabase = createClient(url, key)
