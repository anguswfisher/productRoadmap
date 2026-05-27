// Shared roadmap types + static configuration, used by both the editor and the
// public read-only view.

export type StreamKey =
  | 'catina'
  | 'ai-assistant'
  | 'risk'
  | 'enterprise'
  | 'commerce'
  | 'ubp'
  | 'platform';

export type ColorKey = StreamKey | 'ubp-ecomm' | 'ubp-catina';

export type Lane = 'dev' | 'release';

export type AppKey =
  | 'catina'
  | 'ecomm'
  | 'ai'
  | 'risk'
  | 'enterprise'
  | 'platform'
  | 'product';

export interface Tile {
  id: string;
  stream: StreamKey;
  lane: Lane;
  month: number;
  color: ColorKey;
  milestone: boolean;
  badges: AppKey[];
  label?: string;
  items: string[];
  createdBy?: string[];
}

export interface StreamDef {
  key: StreamKey;
  name: string;
  meta: string;
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

export const STREAMS: StreamDef[] = [
  { key: 'catina', name: 'Catina: New Editor', meta: 'Editor · Migration · Meter · Collaboration' },
  { key: 'ai-assistant', name: 'AI Assistant', meta: 'In-product AI chat' },
  { key: 'risk', name: 'AI Risk Review', meta: 'Document risk analysis' },
  { key: 'enterprise', name: 'Enterprise APIs & Partnerships', meta: 'Integrations & partner platform' },
  { key: 'commerce', name: 'Commerce & Buying Journey', meta: 'DOD+ · eComm · Pricing' },
  { key: 'ubp', name: 'Define the Meter', meta: 'Usage Based Pricing · Staged UI Elements' },
  { key: 'platform', name: 'Platform & Internal Tooling', meta: 'Infra · Auth · SC · Internal apps' },
];

export const MONTHS: MonthDef[] = [
  { month: 'May', quarter: 'Q2 · 2026', current: true },
  { month: 'June', quarter: 'Q2 · 2026', current: false },
  { month: 'July', quarter: 'Q3 · 2026', current: false },
  { month: 'August', quarter: 'Q3 · 2026', current: false },
  { month: 'September', quarter: 'Q3 · 2026', current: false },
];

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
