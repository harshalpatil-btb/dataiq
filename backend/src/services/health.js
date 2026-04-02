// dealiq/backend/src/services/health.js
import { supabase } from '../lib/clients.js'

export async function recalculateHealth(dealId) {
  // Triggered by the DB trigger — but can also be called manually
  const { data: deal } = await supabase.from('deals').select('health_score').eq('id', dealId).single()
  return deal?.health_score
}
