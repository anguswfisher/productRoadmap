// "What's coming next" — a backlog of items not yet slotted into a specific
// quarter's roadmap.
import { AppKey } from '../roadmap-editor/roadmap-model';

export type NextHorizon = 'soon' | 'later' | 'researching';

export interface NextItem {
  id: string;
  title: string;
  notes?: string;
  horizon: NextHorizon;
  badges?: AppKey[];
}

export interface NextDoc {
  items: NextItem[];
  published: boolean;
}

export interface HorizonDef {
  key: NextHorizon;
  label: string;
  description: string;
  color: string; // hex
  bg: string;
}

export const HORIZONS: HorizonDef[] = [
  { key: 'soon',        label: 'Up next',     description: 'Likely next quarter',          color: '#15803d', bg: '#dcfce7' },
  { key: 'later',       label: 'Later',       description: 'Targeted for later this year', color: '#b45309', bg: '#fef3c7' },
  { key: 'researching', label: 'Researching', description: 'Discovery / unscoped',          color: '#5b21b6', bg: '#ede9fe' },
];

export function horizonDef(key: NextHorizon): HorizonDef {
  return HORIZONS.find((h) => h.key === key) ?? HORIZONS[2];
}
