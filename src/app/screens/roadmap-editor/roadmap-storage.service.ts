import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROADMAP_ID } from './roadmap-supabase.config';

// ── Supabase table setup (run once in the SQL editor) ───────────────
//
//   create table roadmap (
//     id          text primary key,
//     tiles       jsonb not null default '[]'::jsonb,
//     updated_at  timestamptz not null default now()
//   );
//
//   alter table roadmap enable row level security;
//
//   -- single shared roadmap, no auth yet: allow anon read + write to this table.
//   create policy "roadmap anon read"  on roadmap for select using (true);
//   create policy "roadmap anon write" on roadmap
//     for all using (true) with check (true);
//
// Row is created automatically on first save via upsert.

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const FLUSH_DELAY_MS = 800;

@Injectable({ providedIn: 'root' })
export class RoadmapStorageService {
  private client: SupabaseClient | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: unknown[] | null = null;

  constructor() {
    if (this.isConfigured()) {
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  /** True when a real Supabase project is configured. */
  get enabled(): boolean {
    return this.client !== null;
  }

  private isConfigured(): boolean {
    return (
      SUPABASE_URL.startsWith('https://') &&
      !SUPABASE_URL.includes('YOUR-PROJECT') &&
      !!SUPABASE_ANON_KEY &&
      !SUPABASE_ANON_KEY.includes('YOUR-')
    );
  }

  /** Fetch the shared roadmap's tiles, or null if unavailable / not yet created. */
  async load<T>(): Promise<T[] | null> {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('roadmap')
      .select('tiles')
      .eq('id', ROADMAP_ID)
      .maybeSingle();
    if (error) {
      console.error('Roadmap load failed:', error.message);
      return null;
    }
    return (data?.tiles as T[]) ?? null;
  }

  /** Debounced save of the whole tile set. Reports state via the callback. */
  save(tiles: unknown[], onState?: (s: SaveState) => void): void {
    if (!this.client) return;
    this.pending = tiles;
    onState?.('saving');
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(onState), FLUSH_DELAY_MS);
  }

  private async flush(onState?: (s: SaveState) => void): Promise<void> {
    this.flushTimer = null;
    if (!this.client || this.pending === null) return;
    const tiles = this.pending;
    this.pending = null;
    const { error } = await this.client
      .from('roadmap')
      .upsert({ id: ROADMAP_ID, tiles, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Roadmap save failed:', error.message);
      onState?.('error');
    } else {
      onState?.('saved');
    }
  }
}
