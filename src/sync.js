import { supabase } from './supabase'

export async function pull() {
  const { data, error } = await supabase
    .from('budget_state')
    .select('data, updated_at')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function push(state) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('budget_state').upsert({
    user_id: user.id,
    data: state,
    updated_at: new Date().toISOString()
  })
  if (error) throw error
}

export function subscribeToChanges(onRemoteChange) {
  const channel = supabase
    .channel('budget_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'budget_state' },
      (payload) => {
        if (payload.new && payload.new.data) {
          onRemoteChange(payload.new.data)
        }
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
