import { supabase } from './supabase'

export async function pull(syncCode) {
  const { data, error } = await supabase
    .from('budget_state')
    .select('data, updated_at')
    .eq('sync_code', syncCode)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function push(syncCode, state) {
  if (!syncCode) return
  const { error } = await supabase.from('budget_state').upsert({
    sync_code: syncCode,
    data: state,
    updated_at: new Date().toISOString()
  })
  if (error) throw error
}

export function subscribeToChanges(syncCode, onRemoteChange) {
  const channel = supabase
    .channel('budget_state_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'budget_state',
        filter: `sync_code=eq.${syncCode}`
      },
      (payload) => {
        if (payload.new && payload.new.data) {
          onRemoteChange(payload.new.data)
        }
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
