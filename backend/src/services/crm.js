// dealiq/backend/src/services/crm.js
// CRM sync stubs — replace with real HubSpot/Salesforce API calls

export async function syncToCRM({ org_id, deal, action }) {
  // TODO: check org's CRM settings and sync accordingly
  // For MVP this is a no-op — add HubSpot/Salesforce logic later
  console.log(`CRM sync: ${action} deal ${deal.id}`)
}
