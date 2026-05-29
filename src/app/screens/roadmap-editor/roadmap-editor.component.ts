import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { buildRoadmapHtml } from './roadmap-export';
import {
  downloadRoadmapHtml,
  copyRoadmapHtml,
  exportRoadmapPdf,
} from './roadmap-export-actions';
import { RoadmapStorageService, SaveState } from './roadmap-storage.service';
import {
  StreamKey,
  Lane,
  AppKey,
  Tile,
  StreamDef,
  MonthDef,
  AppDef,
  Roadmap,
  TileLink,
  LANES,
  APPS,
  COLOR_PALETTE,
  ColorKey,
  quarterMonths,
  quarterLabel,
  nextColor,
  genId,
  combineRoadmaps,
  rollingWindow,
  buildEditableTimeline,
  MonthMap,
} from './roadmap-model';

export type EditorMode = 'edit' | 'timeline' | 'rolling';

@Component({
  selector: 'app-roadmap-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roadmap-editor.component.html',
  styleUrls: ['./roadmap-editor.component.scss'],
})
export class RoadmapEditorComponent {
  readonly lanes: { key: Lane; label: string }[] = LANES;
  readonly apps: AppDef[] = APPS;

  readonly people: string[] = [
    'Roger', 'Bruce', 'Devin', 'Angus', 'Kiki', 'Xy', 'Other Stakeholders',
  ];

  // ── Multi-roadmap state ─────────────────────────────────────────
  roadmaps: Roadmap[] = [];
  current: Roadmap | null = null;
  private currentMonths: MonthDef[] = [];

  // What's currently rendered (varies by mode).
  display: { streams: StreamDef[]; months: MonthDef[]; tiles: Tile[] } = {
    streams: [], months: [], tiles: [],
  };
  monthMap: MonthMap = [];

  loading = true;
  hiddenStreams = new Set<StreamKey>();

  // New-roadmap modal
  newRoadmapOpen = false;
  newQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  newYear = new Date().getFullYear();

  // Add-initiative
  newInitiativeName = '';

  // Edit-initiative modal
  editInitiativeOpen = false;
  editingInitiativeKey: StreamKey | null = null;
  editName = '';
  editMeta = '';
  editColor: ColorKey = 'platform';
  editLinks: TileLink[] = [];

  // Drag state (tiles)
  private draggingId: string | null = null;
  dragOverKey: string | null = null;

  // Drag state (initiative rows)
  draggingStreamKey: StreamKey | null = null;
  streamDropOverKey: StreamKey | null = null;

  // Add/edit block modal
  modalOpen = false;
  editingTileId: string | null = null;
  private modalCell: { stream: StreamKey; lane: Lane; month: number } | null = null;
  modalText = '';
  modalMilestone = false;
  modalBadges = new Set<AppKey>();
  modalCreatedBy = new Set<string>();
  modalLinks: TileLink[] = [];

  copied = false;
  saveState: SaveState = 'idle';

  // Editor mode: 'edit' (live grid for one quarter) | 'timeline' (all quarters stitched) | 'rolling' (next N months from today).
  mode: EditorMode = 'edit';
  rollingMonths = 3;
  readonly rollingOptions = [1, 2, 3, 6];
  readonly palette: ColorKey[] = COLOR_PALETTE;
  timelineHtml: SafeHtml | null = null;

  constructor(
    private storage: RoadmapStorageService,
    private sanitizer: DomSanitizer,
  ) {
    void this.init();
  }

  get timelineMode(): boolean {
    return this.mode !== 'edit';
  }

  setMode(mode: EditorMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.refreshView();
  }

  setRollingMonths(n: number): void {
    this.rollingMonths = n;
    if (this.mode === 'rolling') this.refreshView();
  }

  /** Rebuilds whichever surface the current mode uses (iframe for rolling, native grid otherwise). */
  private refreshView(): void {
    if (this.mode === 'rolling') {
      this.timelineHtml = this.sanitizer.bypassSecurityTrustHtml(this.buildHtml(false));
    } else {
      this.timelineHtml = null;
    }
    this.refreshDisplay();
  }

  // ── Convenience accessors ───────────────────────────────────────
  get streams(): StreamDef[] { return this.display.streams; }
  get months(): MonthDef[] { return this.display.months; }
  get tiles(): Tile[] { return this.display.tiles; }

  get currentLabel(): string {
    return this.current ? quarterLabel(this.current.quarter, this.current.year) : '';
  }

  /** Rebuilds `display` + `monthMap` from current state. Called after any change. */
  private refreshDisplay(): void {
    if (this.mode === 'timeline') {
      const c = buildEditableTimeline(this.roadmaps);
      this.display = { streams: c.streams, months: c.months, tiles: c.tiles };
      this.monthMap = c.monthMap;
    } else if (this.mode === 'edit' && this.current) {
      this.display = {
        streams: this.current.initiatives,
        months: this.currentMonths,
        tiles: this.current.tiles,
      };
      this.monthMap = this.currentMonths.map(
        (_, i) => ({ roadmapId: this.current!.id, localMonth: i }),
      );
    } else {
      // rolling mode renders via iframe (timelineHtml) — display is unused.
      this.display = { streams: [], months: [], tiles: [] };
      this.monthMap = [];
    }
  }

  /** Resolves a displayed tile (possibly with a synthetic id) back to its source. */
  private resolveSourceTile(displayedId: string): { roadmap: Roadmap; tile: Tile } | null {
    if (this.mode === 'edit') {
      if (!this.current) return null;
      const tile = this.current.tiles.find((t) => t.id === displayedId);
      return tile ? { roadmap: this.current, tile } : null;
    }
    // Timeline-mode synthetic id format: "{roadmapId}:{originalTileId}"
    const idx = displayedId.indexOf(':');
    if (idx < 0) return null;
    const roadmapId = displayedId.slice(0, idx);
    const tileId = displayedId.slice(idx + 1);
    const r = this.roadmaps.find((x) => x.id === roadmapId);
    const tile = r?.tiles.find((t) => t.id === tileId);
    return r && tile ? { roadmap: r, tile } : null;
  }

  /** Maps a displayed column (absolute month index) to its source roadmap + local month. */
  private resolveDestination(month: number): { roadmap: Roadmap; localMonth: number } | null {
    const entry = this.monthMap[month];
    if (!entry) return null;
    const r = this.roadmaps.find((x) => x.id === entry.roadmapId);
    return r ? { roadmap: r, localMonth: entry.localMonth } : null;
  }

  /** Copies an initiative into a roadmap if it's missing there (so cross-roadmap drops work). */
  private ensureInitiative(target: Roadmap, key: StreamKey): void {
    if (target.initiatives.some((s) => s.key === key)) return;
    for (const r of this.roadmaps) {
      if (r === target) continue;
      const init = r.initiatives.find((s) => s.key === key);
      if (init) {
        target.initiatives.push({ ...init });
        return;
      }
    }
  }

  private persistRoadmap(r: Roadmap): void {
    this.storage.saveRoadmap(r, (s) => (this.saveState = s));
    this.refreshDisplay();
  }

  get saveLabel(): string {
    if (!this.storage.enabled) return 'Local only';
    switch (this.saveState) {
      case 'saving': return 'Saving…';
      case 'saved': return 'Saved';
      case 'error': return 'Save failed';
      default: return 'Synced';
    }
  }

  // ── Load ────────────────────────────────────────────────────────
  private async init(): Promise<void> {
    this.loading = true;
    this.roadmaps = await this.storage.list();
    if (this.roadmaps.length) this.selectRoadmap(this.roadmaps[0]);
    this.loading = false;
    this.refreshDisplay();
  }

  selectRoadmap(r: Roadmap): void {
    this.current = r;
    this.currentMonths = quarterMonths(r.quarter, r.year);
    this.hiddenStreams.clear();
    this.saveState = 'saved';
    this.refreshDisplay();
  }

  selectRoadmapById(id: string): void {
    const r = this.roadmaps.find((x) => x.id === id);
    if (r) this.selectRoadmap(r);
  }

  // ── New roadmap ─────────────────────────────────────────────────
  openNewRoadmap(): void {
    this.newRoadmapOpen = true;
  }
  closeNewRoadmap(): void {
    this.newRoadmapOpen = false;
  }

  async createRoadmap(): Promise<void> {
    const quarter = Number(this.newQuarter);
    const year = Number(this.newYear);
    if (!quarter || !year) return;
    if (this.roadmaps.some((r) => r.quarter === quarter && r.year === year)) {
      const existing = this.roadmaps.find(
        (r) => r.quarter === quarter && r.year === year,
      )!;
      this.selectRoadmap(existing);
      this.closeNewRoadmap();
      return;
    }
    const created = await this.storage.create(quarter, year);
    if (created) {
      this.roadmaps = [created, ...this.roadmaps];
      this.selectRoadmap(created);
    }
    this.closeNewRoadmap();
  }

  async deleteRoadmap(): Promise<void> {
    if (!this.current) return;
    const label = this.currentLabel;
    if (!confirm(`Delete the ${label} roadmap? This cannot be undone.`)) return;
    const id = this.current.id;
    const ok = await this.storage.remove(id);
    if (ok) {
      this.roadmaps = this.roadmaps.filter((r) => r.id !== id);
      this.current = null;
      if (this.roadmaps.length) this.selectRoadmap(this.roadmaps[0]);
    }
  }

  // ── Publish ─────────────────────────────────────────────────────
  async togglePublish(): Promise<void> {
    if (!this.current) return;
    this.current.published = !this.current.published;
    await this.storage.saveNow(this.current, (s) => (this.saveState = s));
  }

  // ── Initiatives (left-hand rows) ────────────────────────────────
  addInitiative(): void {
    const name = this.newInitiativeName.trim();
    if (!name) return;

    if (this.mode === 'edit') {
      if (!this.current) return;
      const color = nextColor(this.current.initiatives);
      this.current.initiatives.push({ key: genId('init'), name, meta: '', color });
      this.persistRoadmap(this.current);
    } else if (this.mode === 'timeline' && this.roadmaps.length) {
      // Add the new initiative to every quarter so it appears across the timeline.
      const color = nextColor(this.display.streams);
      const key = genId('init');
      for (const r of this.roadmaps) {
        r.initiatives.push({ key, name, meta: '', color });
        this.persistRoadmap(r);
      }
    }
    this.newInitiativeName = '';
  }

  openEditInitiative(stream: StreamKey, event?: Event): void {
    event?.stopPropagation();
    // Use the merged display list — works for both edit and timeline mode.
    const init = this.display.streams.find((s) => s.key === stream);
    if (!init) return;
    this.editingInitiativeKey = init.key;
    this.editName = init.name;
    this.editMeta = init.meta ?? '';
    this.editColor = init.color;
    // Migrate legacy single devopsLink into the new list form.
    this.editLinks = init.links?.map((l) => ({ label: l.label, url: l.url }))
      ?? (init.devopsLink ? [{ label: 'DevOps', url: init.devopsLink }] : []);
    this.editInitiativeOpen = true;
  }

  addEditLink(): void {
    this.editLinks.push({ label: '', url: '' });
  }
  removeEditLink(index: number): void {
    this.editLinks.splice(index, 1);
  }
  trackEditLink = (i: number) => i;

  /** Returns the links to render on an initiative (handles legacy devopsLink). */
  streamLinks(s: StreamDef): TileLink[] {
    if (s.links && s.links.length) return s.links;
    if (s.devopsLink) return [{ label: 'DevOps', url: s.devopsLink }];
    return [];
  }

  closeEditInitiative(): void {
    this.editInitiativeOpen = false;
    this.editingInitiativeKey = null;
  }

  pickEditColor(color: ColorKey): void {
    this.editColor = color;
  }

  saveEditInitiative(): void {
    if (!this.editingInitiativeKey) return;
    const newName = this.editName.trim();
    if (!newName) return;
    const meta = this.editMeta.trim();
    const newColor = this.editColor;
    const links = this.editLinks
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url);

    const applyTo = (roadmap: Roadmap): boolean => {
      const init = roadmap.initiatives.find((s) => s.key === this.editingInitiativeKey);
      if (!init) return false;
      const prevColor = init.color;
      init.name = newName;
      init.meta = meta;
      init.color = newColor;
      init.links = links.length ? links.map((l) => ({ ...l })) : undefined;
      init.devopsLink = undefined;
      if (prevColor !== newColor) {
        for (const t of roadmap.tiles) {
          if (t.stream === init.key && t.color === prevColor) t.color = newColor;
        }
      }
      return true;
    };

    // Initiative properties (name/color/meta/links) are global per key — apply
    // to every roadmap that has this initiative, regardless of mode.
    for (const r of this.roadmaps) {
      if (applyTo(r)) this.persistRoadmap(r);
    }
    this.closeEditInitiative();
  }

  removeInitiative(stream: StreamKey, event: Event): void {
    event.stopPropagation();
    const init = this.display.streams.find((s) => s.key === stream);
    const name = init?.name ?? 'this initiative';

    if (this.mode === 'edit') {
      if (!this.current) return;
      const tileCount = this.current.tiles.filter((t) => t.stream === stream).length;
      if (!confirm(
        `Remove "${name}"${tileCount ? ` and its ${tileCount} block(s)` : ''}?`,
      )) return;
      this.current.initiatives = this.current.initiatives.filter((s) => s.key !== stream);
      this.current.tiles = this.current.tiles.filter((t) => t.stream !== stream);
      this.persistRoadmap(this.current);
    } else if (this.mode === 'timeline') {
      const tileCount = this.roadmaps.reduce(
        (n, r) => n + r.tiles.filter((t) => t.stream === stream).length, 0,
      );
      if (!confirm(
        `Remove "${name}" across all quarters${tileCount ? ` (and ${tileCount} block(s))` : ''}?`,
      )) return;
      for (const r of this.roadmaps) {
        const had = r.initiatives.some((s) => s.key === stream)
          || r.tiles.some((t) => t.stream === stream);
        if (!had) continue;
        r.initiatives = r.initiatives.filter((s) => s.key !== stream);
        r.tiles = r.tiles.filter((t) => t.stream !== stream);
        this.persistRoadmap(r);
      }
    }
    return;
  }

  // ── Lookups ─────────────────────────────────────────────────────
  appDef(key: AppKey): AppDef {
    return this.apps.find((a) => a.key === key)!;
  }

  tilesFor(stream: StreamKey, lane: Lane, month: number): Tile[] {
    return this.tiles.filter(
      (t) => t.stream === stream && t.lane === lane && t.month === month,
    );
  }

  trackTile = (_: number, t: Tile) => t.id;
  trackStream = (_: number, s: StreamDef) => s.key;

  // ── Stream filter pills ─────────────────────────────────────────
  toggleStream(stream: StreamKey): void {
    if (this.hiddenStreams.has(stream)) this.hiddenStreams.delete(stream);
    else this.hiddenStreams.add(stream);
  }

  isStreamActive(stream: StreamKey): boolean {
    return !this.hiddenStreams.has(stream);
  }

  // ── Drag & drop: reorder initiative rows ────────────────────────
  onStreamDragStart(s: StreamDef, event: DragEvent): void {
    this.draggingStreamKey = s.key;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `row:${s.key}`);
    }
  }
  onStreamDragOver(event: DragEvent, s: StreamDef): void {
    if (!this.draggingStreamKey || this.draggingStreamKey === s.key) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.streamDropOverKey = s.key;
  }
  onStreamDragLeave(s: StreamDef): void {
    if (this.streamDropOverKey === s.key) this.streamDropOverKey = null;
  }
  onStreamDrop(event: DragEvent, s: StreamDef): void {
    event.preventDefault();
    this.streamDropOverKey = null;
    if (!this.draggingStreamKey || this.draggingStreamKey === s.key) {
      this.draggingStreamKey = null;
      return;
    }
    const draggedKey = this.draggingStreamKey;
    this.draggingStreamKey = null;

    if (this.mode === 'edit') {
      if (!this.current) return;
      const inits = this.current.initiatives;
      const from = inits.findIndex((i) => i.key === draggedKey);
      const to = inits.findIndex((i) => i.key === s.key);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = inits.splice(from, 1);
      inits.splice(to, 0, moved);
      this.persistRoadmap(this.current);
      return;
    }

    if (this.mode === 'timeline') {
      // Reorder the merged display list, then propagate that order to every
      // roadmap (each roadmap sorts its own initiatives by the new global order).
      const merged = this.display.streams;
      const from = merged.findIndex((i) => i.key === draggedKey);
      const to = merged.findIndex((i) => i.key === s.key);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = merged.splice(from, 1);
      merged.splice(to, 0, moved);
      const orderIndex = new Map<StreamKey, number>();
      merged.forEach((init, i) => orderIndex.set(init.key, i));
      for (const r of this.roadmaps) {
        r.initiatives.sort(
          (a, b) => (orderIndex.get(a.key) ?? 1e9) - (orderIndex.get(b.key) ?? 1e9),
        );
        this.persistRoadmap(r);
      }
    }
  }
  onStreamDragEnd(): void {
    this.draggingStreamKey = null;
    this.streamDropOverKey = null;
  }

  // ── Drag & drop: tiles ──────────────────────────────────────────
  cellKey(stream: StreamKey, lane: Lane, month: number): string {
    return `${stream}|${lane}|${month}`;
  }

  onDragStart(tile: Tile): void {
    this.draggingId = tile.id;
  }

  onDragEnd(): void {
    this.draggingId = null;
    this.dragOverKey = null;
  }

  onDragOver(event: DragEvent, stream: StreamKey, lane: Lane, month: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverKey = this.cellKey(stream, lane, month);
  }

  onDragLeave(stream: StreamKey, lane: Lane, month: number): void {
    if (this.dragOverKey === this.cellKey(stream, lane, month)) {
      this.dragOverKey = null;
    }
  }

  onDrop(event: DragEvent, stream: StreamKey, lane: Lane, month: number): void {
    event.preventDefault();
    this.dragOverKey = null;
    const draggedId = this.draggingId;
    this.draggingId = null;
    if (!draggedId) return;

    const src = this.resolveSourceTile(draggedId);
    const dest = this.resolveDestination(month);
    if (!src || !dest) return;

    this.ensureInitiative(dest.roadmap, stream);
    const destInit = dest.roadmap.initiatives.find((s) => s.key === stream);

    if (src.roadmap === dest.roadmap) {
      src.tile.stream = stream;
      src.tile.lane = lane;
      src.tile.month = dest.localMonth;
      if (destInit) src.tile.color = destInit.color;
      this.persistRoadmap(src.roadmap);
    } else {
      // Cross-roadmap move: remove from source, push fresh tile into destination.
      src.roadmap.tiles = src.roadmap.tiles.filter((t) => t.id !== src.tile.id);
      dest.roadmap.tiles.push({
        ...src.tile,
        id: genId('t'),
        stream, lane,
        month: dest.localMonth,
        color: destInit?.color ?? src.tile.color,
      });
      this.persistRoadmap(src.roadmap);
      this.persistRoadmap(dest.roadmap);
    }
  }

  // ── Delete & inline edit ────────────────────────────────────────
  deleteTile(tile: Tile): void {
    const src = this.resolveSourceTile(tile.id);
    if (!src) return;
    src.roadmap.tiles = src.roadmap.tiles.filter((t) => t.id !== src.tile.id);
    this.persistRoadmap(src.roadmap);
  }

  onItemEdit(tile: Tile, index: number, event: Event): void {
    const src = this.resolveSourceTile(tile.id);
    if (!src) return;
    const text = (event.target as HTMLElement).textContent?.trim() ?? '';
    if (text) {
      src.tile.items[index] = text;
    } else {
      src.tile.items.splice(index, 1);
      if (src.tile.items.length === 0) {
        src.roadmap.tiles = src.roadmap.tiles.filter((t) => t.id !== src.tile.id);
      }
    }
    this.persistRoadmap(src.roadmap);
  }

  // ── Add/edit block modal ────────────────────────────────────────
  get modalTitle(): string {
    return this.editingTileId ? 'Edit block' : 'Add block';
  }
  get modalSubmitLabel(): string {
    return this.editingTileId ? 'Save changes' : 'Add block';
  }

  openAdd(stream: StreamKey, lane: Lane, month: number): void {
    this.editingTileId = null;
    this.modalCell = { stream, lane, month };
    this.modalText = '';
    this.modalMilestone = false;
    this.modalBadges = new Set<AppKey>();
    this.modalCreatedBy = new Set<string>();
    this.modalLinks = [];
    this.modalOpen = true;
  }

  openEdit(tile: Tile): void {
    this.editingTileId = tile.id;
    this.modalCell = { stream: tile.stream, lane: tile.lane, month: tile.month };
    this.modalText = tile.items.join('\n');
    this.modalMilestone = tile.milestone;
    this.modalBadges = new Set<AppKey>(tile.badges);
    this.modalCreatedBy = new Set<string>(tile.createdBy ?? []);
    // Migrate legacy single `link` into the new list form.
    this.modalLinks = tile.links?.map((l) => ({ label: l.label, url: l.url }))
      ?? (tile.link ? [{ label: '', url: tile.link }] : []);
    this.modalOpen = true;
  }

  addModalLink(): void {
    this.modalLinks.push({ label: '', url: '' });
  }
  removeModalLink(index: number): void {
    this.modalLinks.splice(index, 1);
  }
  trackModalLink = (i: number) => i;

  /** Returns the links to render on a tile (handles legacy single-link tiles). */
  tileLinks(tile: Tile): TileLink[] {
    if (tile.links && tile.links.length) return tile.links;
    if (tile.link) return [{ label: '', url: tile.link }];
    return [];
  }

  closeAdd(): void {
    this.modalOpen = false;
    this.modalCell = null;
    this.editingTileId = null;
  }

  toggleBadge(app: AppKey): void {
    if (this.modalBadges.has(app)) this.modalBadges.delete(app);
    else this.modalBadges.add(app);
  }
  isBadgeSelected(app: AppKey): boolean {
    return this.modalBadges.has(app);
  }
  togglePerson(name: string): void {
    if (this.modalCreatedBy.has(name)) this.modalCreatedBy.delete(name);
    else this.modalCreatedBy.add(name);
  }
  isPersonSelected(name: string): boolean {
    return this.modalCreatedBy.has(name);
  }

  submitAdd(): void {
    if (!this.modalCell) return;
    const items = this.modalText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;

    const links = this.modalLinks
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url);

    if (this.editingTileId) {
      const src = this.resolveSourceTile(this.editingTileId);
      if (src) {
        src.tile.items = items;
        src.tile.milestone = this.modalMilestone;
        src.tile.badges = Array.from(this.modalBadges);
        src.tile.createdBy = Array.from(this.modalCreatedBy);
        src.tile.links = links.length ? links : undefined;
        src.tile.link = undefined; // clear legacy field
        this.persistRoadmap(src.roadmap);
      }
    } else {
      const dest = this.resolveDestination(this.modalCell.month);
      if (!dest) {
        this.closeAdd();
        return;
      }
      this.ensureInitiative(dest.roadmap, this.modalCell.stream);
      const init = dest.roadmap.initiatives.find((s) => s.key === this.modalCell!.stream);
      dest.roadmap.tiles.push({
        id: genId('t'),
        stream: this.modalCell.stream,
        lane: this.modalCell.lane,
        month: dest.localMonth,
        color: init?.color ?? 'platform',
        milestone: this.modalMilestone,
        badges: Array.from(this.modalBadges),
        items,
        createdBy: Array.from(this.modalCreatedBy),
        links: links.length ? links : undefined,
      });
      this.persistRoadmap(dest.roadmap);
    }
    this.closeAdd();
  }

  // ── Export ──────────────────────────────────────────────────────
  private exportPayload() {
    if (this.mode === 'timeline') {
      const c = combineRoadmaps(this.roadmaps);
      return {
        streams: c.streams, months: c.months,
        lanes: this.lanes, apps: this.apps,
        tiles: c.tiles, title: c.title,
      };
    }
    if (this.mode === 'rolling') {
      const c = rollingWindow(this.roadmaps, this.rollingMonths);
      return {
        streams: c.streams, months: c.months,
        lanes: this.lanes, apps: this.apps,
        tiles: c.tiles, title: c.title,
      };
    }
    return {
      streams: this.streams, months: this.months,
      lanes: this.lanes, apps: this.apps,
      tiles: this.tiles, title: this.currentLabel,
    };
  }

  private buildHtml(chrome = true): string {
    return buildRoadmapHtml({ ...this.exportPayload(), chrome });
  }

  private exportFileName(ext: string): string {
    let base: string;
    if (this.mode === 'timeline') base = 'full-timeline';
    else if (this.mode === 'rolling') base = `next-${this.rollingMonths}-months`;
    else base = this.currentLabel;
    return `roadmap-${base.replace(/\s+/g, '-')}.${ext}`;
  }

  exportHtml(): void {
    downloadRoadmapHtml(this.buildHtml(), this.exportFileName('html'));
  }

  pdfBusy = false;

  async exportPdf(): Promise<void> {
    if (this.pdfBusy) return;
    this.pdfBusy = true;
    try {
      await exportRoadmapPdf(this.buildHtml(), this.exportFileName('pdf'));
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      this.pdfBusy = false;
    }
  }

  slidesBusy = false;

  async exportSlides(): Promise<void> {
    if (this.slidesBusy) return;
    this.slidesBusy = true;
    try {
      const { exportRoadmapSlides } = await import('./roadmap-slides');
      await exportRoadmapSlides(this.exportPayload());
    } catch (err) {
      console.error('Slides export failed:', err);
    } finally {
      this.slidesBusy = false;
    }
  }

  async copyEmbed(): Promise<void> {
    if (await copyRoadmapHtml(this.buildHtml())) {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    }
  }

  // ── Persistence ─────────────────────────────────────────────────
  private persist(): void {
    if (!this.current) return;
    this.persistRoadmap(this.current);
  }
}
