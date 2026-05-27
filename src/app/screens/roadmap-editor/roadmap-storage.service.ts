import { Injectable } from '@angular/core';
import { supabase, isSupabaseConfigured } from '../../auth/supabase-client';
import { ROADMAP_ID } from './roadmap-supabase.config';

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
//   -- Require a signed-in user (Supabase Auth) to read or write.
//   create policy "roadmap auth read"  on roadmap for select to authenticated using (true);
//   create policy "roadmap auth write" on roadmap for all    to authenticated using (true) with check (true);
//
// Row is created automatically on first save via upsert. Because this service
// shares the same Supabase client as AuthService, the signed-in user's token is
// attached to these requests automatically.

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const FLUSH_DELAY_MS = 800;

@Injectable({ providedIn: 'root' })
export class RoadmapStorageService {
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: unknown[] | null = null;

  /** True when a real Supabase project is configured. */
  get enabled(): boolean {
    return isSupabaseConfigured;
  }

  /** Fetch the shared roadmap's tiles, or null if unavailable / not yet created. */
  async load<T>(): Promise<T[] | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
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
    if (!isSupabaseConfigured) return;
    this.pending = tiles;
    onState?.('saving');
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(onState), FLUSH_DELAY_MS);
  }

  private async flush(onState?: (s: SaveState) => void): Promise<void> {
    this.flushTimer = null;
    if (this.pending === null) return;
    const tiles = this.pending;
    this.pending = null;
    const { error } = await supabase
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
