// Shared roadmap types + helpers, used by the editor and the public view.

// A stream key is now an arbitrary per-roadmap id (initiatives are created by
// the user), so it's just a string. ColorKey stays a fixed palette so the
// existing CSS classes + export styling keep working.
export type StreamKey = string;

export type ColorKey =
  | 'catina'
  | 'ai-assistant'
  | 'risk'
  | 'enterprise'
  | 'commerce'
  | 'ubp'
  | 'platform'
  | 'ubp-ecomm'
  | 'ubp-catina';

export type Lane = 'dev' | 'release';

export type AppKey =
  | 'catina'
  | 'ecomm'
  | 'ai'
  | 'risk'
  | 'enterprise'
  | 'platform'
  | 'product';

export interface TileLink {
  label: string;
  url: string;
}

export interface Tile {
  id: string;
  stream: StreamKey; // which initiative row
  lane: Lane;
  month: number; // 0–2 within the quarter
  color: ColorKey; // usually the initiative's color
  milestone: boolean;
  badges: AppKey[];
  label?: string;
  items: string[];
  createdBy?: string[];
  /** New: multiple named links (PRD, Artifact, etc.). */
  links?: TileLink[];
  /** Legacy single link; render as fallback if `links` isn't set. */
  link?: string;
}

// An "initiative" is a left-hand row. Created by the user; color auto-assigned.
export interface StreamDef {
  key: StreamKey;
  name: string;
  meta: string; // short tag / subtitle
  color: ColorKey;
  /** New: multiple named links (DevOps, PRD, Figma, etc.). */
  links?: TileLink[];
  /** Legacy single DevOps link — kept for backward compat. */
  devopsLink?: string;
}

export interface MonthDef {
  month: string;
  quarter: string;
  current: boolean;
}

export interface AppDef {
  key: AppKey;
  label: string;
  badgeClass: string;
  chipDotColor: string;
}

// A full roadmap for one quarter.
export interface Roadmap {
  id: string;
  quarter: number; // 1–4
  year: number;
  initiatives: StreamDef[];
  tiles: Tile[];
  published: boolean;
}

export const LANES: { key: Lane; label: string }[] = [
  { key: 'dev', label: 'Dev / Testing' },
  { key: 'release', label: 'Releases' },
];

export const APPS: AppDef[] = [
  { key: 'catina', label: 'Catina', badgeClass: 'badge-catina', chipDotColor: 'var(--catina)' },
  { key: 'ecomm', label: 'eCommerce', badgeClass: 'badge-ecomm', chipDotColor: 'var(--commerce)' },
  { key: 'ai', label: 'AI', badgeClass: 'badge-ai', chipDotColor: 'var(--ai-assistant)' },
  { key: 'risk', label: 'Risk', badgeClass: 'badge-risk', chipDotColor: 'var(--risk)' },
  { key: 'enterprise', label: 'Enterprise', badgeClass: 'badge-enterprise', chipDotColor: 'var(--enterprise)' },
  { key: 'platform', label: 'Platform', badgeClass: 'badge-platform', chipDotColor: 'var(--platform)' },
  { key: 'product', label: 'Product', badgeClass: 'badge-product', chipDotColor: '#d97706' },
];

// Palette used to auto-assign a color to each new initiative (cycles).
export const COLOR_PALETTE: ColorKey[] = [
  'catina',
  'ai-assistant',
  'risk',
  'enterprise',
  'commerce',
  'ubp',
  'platform',
];

// Hex equivalents (for the slides export, which needs raw colors).
export const COLOR_HEX: Record<ColorKey, string> = {
  catina: '2E86C1',
  'ai-assistant': '7C3AED',
  risk: 'C2185B',
  enterprise: '2E7D32',
  commerce: 'C2410C',
  ubp: 'B45309',
  platform: '475569',
  'ubp-ecomm': '0E7490',
  'ubp-catina': '6D28D9',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Returns the 3 MonthDefs for a quarter/year, flagging the current month. */
export function quarterMonths(quarter: number, year: number, today = new Date()): MonthDef[] {
  const startMonth = (quarter - 1) * 3; // 0,3,6,9
  const curYear = today.getFullYear();
  const curMonth = today.getMonth();
  return [0, 1, 2].map((offset) => {
    const m = startMonth + offset;
    return {
      month: MONTH_NAMES[m],
      quarter: `Q${quarter} · ${year}`,
      current: year === curYear && m === curMonth,
    };
  });
}

export function quarterLabel(quarter: number, year: number): string {
  return `Q${quarter} ${year}`;
}

/** Next palette color, choosing the least-used so colors spread out. */
export function nextColor(initiatives: StreamDef[]): ColorKey {
  const counts = new Map<ColorKey, number>();
  for (const c of COLOR_PALETTE) counts.set(c, 0);
  for (const i of initiatives) counts.set(i.color, (counts.get(i.color) ?? 0) + 1);
  let best: ColorKey = COLOR_PALETTE[0];
  let min = Infinity;
  for (const c of COLOR_PALETTE) {
    const n = counts.get(c) ?? 0;
    if (n < min) {
      min = n;
      best = c;
    }
  }
  return best;
}

export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface CombinedRoadmap {
  streams: StreamDef[];
  months: MonthDef[];
  tiles: Tile[];
  title: string;
}

/**
 * Stitches multiple quarter roadmaps into one wide timeline: initiatives merged
 * into shared rows (by key), months concatenated chronologically, tiles remapped
 * to absolute columns. Empty leading/trailing months are trimmed.
 */
export function combineRoadmaps(roadmaps: Roadmap[]): CombinedRoadmap {
  const sorted = [...roadmaps].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
  const streams: StreamDef[] = [];
  const seen = new Set<StreamKey>();
  let months: MonthDef[] = [];
  let tiles: Tile[] = [];
  let offset = 0;

  for (const r of sorted) {
    for (const init of r.initiatives) {
      if (!seen.has(init.key)) {
        seen.add(init.key);
        streams.push(init);
      }
    }
    const qm = quarterMonths(r.quarter, r.year);
    months = months.concat(qm);
    for (const t of r.tiles) {
      tiles.push({ ...t, id: `${r.id}:${t.id}`, month: offset + t.month });
    }
    offset += qm.length;
  }

  // Trim empty leading/trailing months.
  if (tiles.length && months.length) {
    const used = tiles.map((t) => t.month);
    const min = Math.min(...used);
    const max = Math.max(...used);
    if (min > 0 || max < months.length - 1) {
      months = months.slice(min, max + 1);
      tiles = tiles.map((t) => ({ ...t, month: t.month - min }));
    }
  }

  let title = 'Full timeline';
  if (sorted.length === 1) {
    title = quarterLabel(sorted[0].quarter, sorted[0].year);
  } else if (sorted.length > 1) {
    const f = sorted[0];
    const l = sorted[sorted.length - 1];
    title = `${quarterLabel(f.quarter, f.year)} – ${quarterLabel(l.quarter, l.year)}`;
  }

  return { streams, months, tiles, title };
}

/**
 * Builds a rolling roadmap window starting at `anchor` (defaults to today),
 * spanning `monthCount` months. Tiles from any roadmap whose absolute month
 * falls in the window are remapped to their offset from the anchor. Useful for
 * leader views like "what's coming up in the next 3/6/12 months."
 */
export function rollingWindow(
  roadmaps: Roadmap[],
  monthCount: number,
  anchor: Date = new Date(),
): CombinedRoadmap {
  const baseY = anchor.getFullYear();
  const baseM = anchor.getMonth();
  const baseAbs = baseY * 12 + baseM;

  const months: MonthDef[] = [];
  for (let i = 0; i < monthCount; i++) {
    const total = baseM + i;
    const y = baseY + Math.floor(total / 12);
    const mn = ((total % 12) + 12) % 12;
    months.push({
      month: MONTH_NAMES[mn],
      quarter: `Q${Math.floor(mn / 3) + 1} · ${y}`,
      current: i === 0,
    });
  }

  const streams: StreamDef[] = [];
  const seen = new Set<StreamKey>();
  const tiles: Tile[] = [];

  // Sort roadmaps chronologically so initiatives appear in a stable order.
  const sorted = [...roadmaps].sort((a, b) => a.year - b.year || a.quarter - b.quarter);

  for (const r of sorted) {
    const rStartAbs = r.year * 12 + (r.quarter - 1) * 3;
    const overlaps = rStartAbs + 2 >= baseAbs && rStartAbs <= baseAbs + monthCount - 1;
    if (!overlaps) continue;

    for (const init of r.initiatives) {
      if (!seen.has(init.key)) {
        seen.add(init.key);
        streams.push(init);
      }
    }

    for (const t of r.tiles) {
      const offset = rStartAbs + t.month - baseAbs;
      if (offset >= 0 && offset < monthCount) {
        tiles.push({ ...t, id: `${r.id}:${t.id}`, month: offset });
      }
    }
  }

  const firstMonth = months[0]?.month ?? '';
  const lastMonth = months[months.length - 1]?.month ?? '';
  const title = `Next ${monthCount} months · ${firstMonth} – ${lastMonth}`;

  return { streams, months, tiles, title };
}
