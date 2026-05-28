import { Injectable } from '@angular/core';
import { supabase, isSupabaseConfigured } from '../../auth/supabase-client';
import { Roadmap, StreamDef, Tile } from './roadmap-model';
import { NextDoc, NextItem } from '../next/next-model';

// ── Supabase table (run once in the SQL editor) ─────────────────────
//
//   create table roadmaps (
//     id uuid primary key default gen_random_uuid(),
//     quarter int not null check (quarter between 1 and 4),
//     year int not null,
//     initiatives jsonb not null default '[]'::jsonb,
//     tiles jsonb not null default '[]'::jsonb,
//     published boolean not null default false,
//     created_at timestamptz not null default now(),
//     updated_at timestamptz not null default now(),
//     unique (quarter, year)
//   );
//   alter table roadmaps enable row level security;
//   create policy "roadmaps public read published" on roadmaps for select using (published = true);
//   create policy "roadmaps auth read all" on roadmaps for select to authenticated using (true);
//   create policy "roadmaps auth write" on roadmaps for all to authenticated using (true) with check (true);

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const FLUSH_DELAY_MS = 800;

interface RoadmapRow {
  id: string;
  quarter: number;
  year: number;
  initiatives: StreamDef[];
  tiles: Tile[];
  published: boolean;
}

function toRoadmap(row: RoadmapRow): Roadmap {
  return {
    id: row.id,
    quarter: row.quarter,
    year: row.year,
    initiatives: row.initiatives ?? [],
    tiles: row.tiles ?? [],
    published: !!row.published,
  };
}

const NEXT_ID = 'default';

@Injectable({ providedIn: 'root' })
export class RoadmapStorageService {
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: Roadmap | null = null;
  private nextFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private nextPending: NextDoc | null = null;

  get enabled(): boolean {
    return isSupabaseConfigured;
  }

  /** All roadmaps (team view — includes drafts). Sorted newest first. */
  async list(): Promise<Roadmap[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('roadmaps')
      .select('*')
      .order('year', { ascending: false })
      .order('quarter', { ascending: false });
    if (error) {
      console.error('Roadmaps load failed:', error.message);
      return [];
    }
    return (data as RoadmapRow[]).map(toRoadmap);
  }

  /** Published roadmaps only (public view). */
  async listPublished(): Promise<Roadmap[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('published', true)
      .order('year', { ascending: false })
      .order('quarter', { ascending: false });
    if (error) {
      console.error('Published roadmaps load failed:', error.message);
      return [];
    }
    return (data as RoadmapRow[]).map(toRoadmap);
  }

  /** Creates a new (empty, unpublished) roadmap for a quarter/year. */
  async create(quarter: number, year: number): Promise<Roadmap | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('roadmaps')
      .insert({ quarter, year, initiatives: [], tiles: [], published: false })
      .select('*')
      .single();
    if (error) {
      console.error('Create roadmap failed:', error.message);
      return null;
    }
    return toRoadmap(data as RoadmapRow);
  }

  async remove(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('roadmaps').delete().eq('id', id);
    if (error) {
      console.error('Delete roadmap failed:', error.message);
      return false;
    }
    return true;
  }

  /** Immediate save (used for publish toggles, structural changes). */
  async saveNow(roadmap: Roadmap, onState?: (s: SaveState) => void): Promise<void> {
    if (!isSupabaseConfigured) return;
    onState?.('saving');
    const { error } = await this.write(roadmap);
    onState?.(error ? 'error' : 'saved');
  }

  /** Debounced save (used while editing tiles). */
  save(roadmap: Roadmap, onState?: (s: SaveState) => void): void {
    if (!isSupabaseConfigured) return;
    this.pending = roadmap;
    onState?.('saving');
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(onState), FLUSH_DELAY_MS);
  }

  private async flush(onState?: (s: SaveState) => void): Promise<void> {
    this.flushTimer = null;
    if (this.pending === null) return;
    const roadmap = this.pending;
    this.pending = null;
    const { error } = await this.write(roadmap);
    onState?.(error ? 'error' : 'saved');
  }

  private async write(roadmap: Roadmap) {
    return supabase
      .from('roadmaps')
      .update({
        initiatives: roadmap.initiatives,
        tiles: roadmap.tiles,
        published: roadmap.published,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roadmap.id);
  }

  // ── "What's coming next" doc ────────────────────────────────────
  /** Returns the single Next-Items doc. RLS handles public vs auth visibility. */
  async getNext(): Promise<NextDoc> {
    if (!isSupabaseConfigured) return { items: [], published: false };
    const { data, error } = await supabase
      .from('next_items')
      .select('items,published')
      .eq('id', NEXT_ID)
      .maybeSingle();
    if (error) {
      console.error('Next items load failed:', error.message);
      return { items: [], published: false };
    }
    return {
      items: (data?.items as NextItem[]) ?? [],
      published: !!data?.published,
    };
  }

  /** Immediate save (publish toggle, structural change). */
  async saveNextNow(doc: NextDoc, onState?: (s: SaveState) => void): Promise<void> {
    if (!isSupabaseConfigured) return;
    onState?.('saving');
    const { error } = await this.writeNext(doc);
    onState?.(error ? 'error' : 'saved');
  }

  /** Debounced save (item edits). */
  saveNext(doc: NextDoc, onState?: (s: SaveState) => void): void {
    if (!isSupabaseConfigured) return;
    this.nextPending = doc;
    onState?.('saving');
    if (this.nextFlushTimer) clearTimeout(this.nextFlushTimer);
    this.nextFlushTimer = setTimeout(() => void this.flushNext(onState), FLUSH_DELAY_MS);
  }

  private async flushNext(onState?: (s: SaveState) => void): Promise<void> {
    this.nextFlushTimer = null;
    if (this.nextPending === null) return;
    const doc = this.nextPending;
    this.nextPending = null;
    const { error } = await this.writeNext(doc);
    onState?.(error ? 'error' : 'saved');
  }

  private async writeNext(doc: NextDoc) {
    return supabase.from('next_items').upsert({
      id: NEXT_ID,
      items: doc.items,
      published: doc.published,
      updated_at: new Date().toISOString(),
    });
  }
}
