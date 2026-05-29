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
  months: MonthDef[] = [];
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
  editLink = '';

  // Drag state
  private draggingId: string | null = null;
  dragOverKey: string | null = null;

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

  private refreshView(): void {
    this.timelineHtml = this.mode === 'edit'
      ? null
      : this.sanitizer.bypassSecurityTrustHtml(this.buildHtml(false));
  }

  // ── Convenience accessors ───────────────────────────────────────
  get streams(): StreamDef[] {
    return this.current?.initiatives ?? [];
  }

  get tiles(): Tile[] {
    return this.current?.tiles ?? [];
  }

  get currentLabel(): string {
    return this.current ? quarterLabel(this.current.quarter, this.current.year) : '';
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
  }

  selectRoadmap(r: Roadmap): void {
    this.current = r;
    this.months = quarterMonths(r.quarter, r.year);
    this.hiddenStreams.clear();
    this.saveState = 'saved';
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
    if (!this.current) return;
    const name = this.newInitiativeName.trim();
    if (!name) return;
    const color = nextColor(this.current.initiatives);
    this.current.initiatives.push({ key: genId('init'), name, meta: '', color });
    this.newInitiativeName = '';
    this.persist();
  }

  openEditInitiative(stream: StreamKey, event?: Event): void {
    event?.stopPropagation();
    const init = this.current?.initiatives.find((s) => s.key === stream);
    if (!init) return;
    this.editingInitiativeKey = init.key;
    this.editName = init.name;
    this.editMeta = init.meta ?? '';
    this.editColor = init.color;
    this.editLink = init.devopsLink ?? '';
    this.editInitiativeOpen = true;
  }

  closeEditInitiative(): void {
    this.editInitiativeOpen = false;
    this.editingInitiativeKey = null;
  }

  pickEditColor(color: ColorKey): void {
    this.editColor = color;
  }

  saveEditInitiative(): void {
    if (!this.current || !this.editingInitiativeKey) return;
    const init = this.current.initiatives.find((s) => s.key === this.editingInitiativeKey);
    if (!init) return;
    const newName = this.editName.trim();
    if (!newName) return;
    const prevColor = init.color;
    init.name = newName;
    init.meta = this.editMeta.trim();
    init.color = this.editColor;
    init.devopsLink = this.editLink.trim() || undefined;
    // If color changed, recolor that initiative's tiles too.
    if (prevColor !== init.color) {
      for (const t of this.current.tiles) {
        if (t.stream === init.key && t.color === prevColor) {
          t.color = init.color;
        }
      }
    }
    this.persist();
    this.closeEditInitiative();
  }

  removeInitiative(stream: StreamKey, event: Event): void {
    event.stopPropagation();
    if (!this.current) return;
    const init = this.current.initiatives.find((s) => s.key === stream);
    const name = init?.name ?? 'this initiative';
    const tileCount = this.current.tiles.filter((t) => t.stream === stream).length;
    if (
      !confirm(
        `Remove "${name}"${tileCount ? ` and its ${tileCount} block(s)` : ''}?`,
      )
    )
      return;
    this.current.initiatives = this.current.initiatives.filter((s) => s.key !== stream);
    this.current.tiles = this.current.tiles.filter((t) => t.stream !== stream);
    this.persist();
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

  // ── Drag & drop ─────────────────────────────────────────────────
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
    if (!this.draggingId || !this.current) return;
    const tile = this.current.tiles.find((t) => t.id === this.draggingId);
    if (!tile) return;
    tile.stream = stream;
    tile.lane = lane;
    tile.month = month;
    const init = this.streams.find((s) => s.key === stream);
    if (init) tile.color = init.color;
    this.draggingId = null;
    this.persist();
  }

  // ── Delete & inline edit ────────────────────────────────────────
  deleteTile(tile: Tile): void {
    if (!this.current) return;
    this.current.tiles = this.current.tiles.filter((t) => t.id !== tile.id);
    this.persist();
  }

  onItemEdit(tile: Tile, index: number, event: Event): void {
    if (!this.current) return;
    const text = (event.target as HTMLElement).textContent?.trim() ?? '';
    if (text) {
      tile.items[index] = text;
    } else {
      tile.items.splice(index, 1);
      if (tile.items.length === 0) {
        this.current.tiles = this.current.tiles.filter((t) => t.id !== tile.id);
      }
    }
    this.persist();
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
    if (!this.modalCell || !this.current) return;
    const items = this.modalText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;

    const links = this.modalLinks
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url);

    if (this.editingTileId) {
      const tile = this.current.tiles.find((t) => t.id === this.editingTileId);
      if (tile) {
        tile.items = items;
        tile.milestone = this.modalMilestone;
        tile.badges = Array.from(this.modalBadges);
        tile.createdBy = Array.from(this.modalCreatedBy);
        tile.links = links.length ? links : undefined;
        tile.link = undefined; // clear legacy field
      }
    } else {
      const init = this.streams.find((s) => s.key === this.modalCell!.stream);
      this.current.tiles.push({
        id: genId('t'),
        stream: this.modalCell.stream,
        lane: this.modalCell.lane,
        month: this.modalCell.month,
        color: init?.color ?? 'platform',
        milestone: this.modalMilestone,
        badges: Array.from(this.modalBadges),
        items,
        createdBy: Array.from(this.modalCreatedBy),
        links: links.length ? links : undefined,
      });
    }
    this.persist();
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
    this.storage.save(this.current, (s) => (this.saveState = s));
  }
}
