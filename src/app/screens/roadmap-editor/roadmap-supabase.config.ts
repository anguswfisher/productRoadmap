// Supabase connection for the Product Roadmap editor.
//
// The publishable (anon) key is a *public* client key — it is safe to ship in
// frontend code. Access is controlled by Row Level Security policies on the
// `roadmap` table (see the SQL in roadmap-storage.service.ts header comment).
//
// Fill these in with the values from your Supabase project:
//   Project URL:      Project Settings → Data API → Project URL
//   Publishable key:  Project Settings → API Keys → Publishable key (sb_publishable_…)
// Until they are set, the editor falls back to localStorage-only persistence.

export const SUPABASE_URL = 'https://zwqnvynhkhkrraxfcjjn.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_BLUb17UqXxO1yRwBXIs9mw_CjnxkOs5';

// The single shared roadmap lives in one row keyed by this id.
export const ROADMAP_ID = 'default';
