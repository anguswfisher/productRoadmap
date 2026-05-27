import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { buildRoadmapHtml } from './roadmap-export';
import { RoadmapStorageService, SaveState } from './roadmap-storage.service';
import {
  StreamKey,
  Lane,
  AppKey,
  Tile,
  StreamDef,
  MonthDef,
  AppDef,
  STREAMS,
  MONTHS,
  LANES,
  APPS,
} from './roadmap-model';

const STORAGE_KEY = 'roadmap-editor-tiles-v1';

@Component({
  selector: 'app-roadmap-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roadmap-editor.component.html',
  styleUrls: ['./roadmap-editor.component.scss'],
})
export class RoadmapEditorComponent {
  readonly streams: StreamDef[] = STREAMS;
  readonly months: MonthDef[] = MONTHS;
  readonly lanes: { key: Lane; label: string }[] = LANES;
  readonly apps: AppDef[] = APPS;

  readonly people: string[] = [
    'Roger',
    'Bruce',
    'Devin',
    'Angus',
    'Kiki',
    'Xy',
    'Other Stakeholders',
  ];

  tiles: Tile[] = [];
  hiddenStreams = new Set<StreamKey>();

  // Drag state
  private draggingId: string | null = null;
  dragOverKey: string | null = null;

  // Modal state
  modalOpen = false;
  editingTileId: string | null = null;
  private modalCell: { stream: StreamKey; lane: Lane; month: number } | null = null;
  modalText = '';
  modalMilestone = false;
  modalBadges = new Set<AppKey>();
  modalCreatedBy = new Set<string>();

  private idCounter = 0;

  saveState: SaveState = 'idle';

  constructor(private storage: RoadmapStorageService) {
    this.loadLocal();
    void this.initRemote();
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
    if (!this.draggingId) return;
    const tile = this.tiles.find((t) => t.id === this.draggingId);
    if (!tile) return;
    tile.stream = stream;
    tile.lane = lane;
    tile.month = month;
    this.draggingId = null;
    this.persist();
  }

  // ── Delete & edit ───────────────────────────────────────────────
  deleteTile(tile: Tile): void {
    this.tiles = this.tiles.filter((t) => t.id !== tile.id);
    this.persist();
  }

  onItemEdit(tile: Tile, index: number, event: Event): void {
    const text = (event.target as HTMLElement).textContent?.trim() ?? '';
    if (text) {
      tile.items[index] = text;
    } else {
      tile.items.splice(index, 1);
      if (tile.items.length === 0) {
        this.tiles = this.tiles.filter((t) => t.id !== tile.id);
      }
    }
    this.persist();
  }

  // ── Add-block modal ─────────────────────────────────────────────
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
    this.modalOpen = true;
  }

  openEdit(tile: Tile): void {
    this.editingTileId = tile.id;
    this.modalCell = { stream: tile.stream, lane: tile.lane, month: tile.month };
    this.modalText = tile.items.join('\n');
    this.modalMilestone = tile.milestone;
    this.modalBadges = new Set<AppKey>(tile.badges);
    this.modalCreatedBy = new Set<string>(tile.createdBy ?? []);
    this.modalOpen = true;
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
    const items = this.modalText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;

    if (this.editingTileId) {
      const tile = this.tiles.find((t) => t.id === this.editingTileId);
      if (tile) {
        tile.items = items;
        tile.milestone = this.modalMilestone;
        tile.badges = Array.from(this.modalBadges);
        tile.createdBy = Array.from(this.modalCreatedBy);
      }
    } else {
      this.tiles.push({
        id: this.nextId(),
        stream: this.modalCell.stream,
        lane: this.modalCell.lane,
        month: this.modalCell.month,
        color: this.modalCell.stream,
        milestone: this.modalMilestone,
        badges: Array.from(this.modalBadges),
        items,
        createdBy: Array.from(this.modalCreatedBy),
      });
    }

    this.persist();
    this.closeAdd();
  }

  // ── Export ──────────────────────────────────────────────────────
  copied = false;

  private buildHtml(): string {
    return buildRoadmapHtml({
      streams: this.streams,
      months: this.months,
      lanes: this.lanes,
      apps: this.apps,
      tiles: this.tiles,
    });
  }

  exportHtml(): void {
    const blob = new Blob([this.buildHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roadmap-export.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  pdfBusy = false;

  async exportPdf(): Promise<void> {
    if (this.pdfBusy) return;
    this.pdfBusy = true;

    // Render the clean (button-free) export HTML off-screen at full width.
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1720px;height:10px;border:0;';
    document.body.appendChild(iframe);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const doc = iframe.contentDocument;
      if (!doc) throw new Error('Could not access export frame');
      doc.open();
      doc.write(this.buildHtml());
      doc.close();

      // Wait for layout + web fonts so the snapshot matches the on-screen design.
      try {
        await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {
        /* fonts API unavailable — continue */
      }
      await new Promise((r) => setTimeout(r, 350));

      const target = doc.body;
      const width = target.scrollWidth;
      const height = target.scrollHeight;

      const canvas = await html2canvas(target, {
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scale: 2,
        backgroundColor: '#f7f6f3',
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const ratio = Math.min(
        (pageW - margin * 2) / canvas.width,
        (pageH - margin * 2) / canvas.height,
      );
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save('roadmap.pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      document.body.removeChild(iframe);
      this.pdfBusy = false;
    }
  }

  slidesBusy = false;

  async exportSlides(): Promise<void> {
    if (this.slidesBusy) return;
    this.slidesBusy = true;
    try {
      const { exportRoadmapSlides } = await import('./roadmap-slides');
      await exportRoadmapSlides({
        streams: this.streams,
        months: this.months,
        lanes: this.lanes,
        apps: this.apps,
        tiles: this.tiles,
      });
    } catch (err) {
      console.error('Slides export failed:', err);
    } finally {
      this.slidesBusy = false;
    }
  }

  async copyEmbed(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.buildHtml());
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  // ── Persistence ─────────────────────────────────────────────────
  resetToDefault(): void {
    this.tiles = this.seed();
    this.persist();
  }

  private persist(): void {
    this.cacheLocal();
    this.storage.save(this.tiles, (s) => (this.saveState = s));
  }

  private cacheLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tiles));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }

  // Instant paint from the local cache (or seed) before the server responds.
  private loadLocal(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.tiles = JSON.parse(raw) as Tile[];
        this.idCounter = this.tiles.length;
        return;
      }
    } catch {
      /* fall through to seed */
    }
    this.tiles = this.seed();
  }

  // Reconcile with the shared server copy; seed the row on first ever run.
  private async initRemote(): Promise<void> {
    if (!this.storage.enabled) return;
    const remote = await this.storage.load<Tile>();
    if (remote && remote.length) {
      this.tiles = remote;
      this.idCounter = this.tiles.length;
      this.cacheLocal();
      this.saveState = 'saved';
    } else {
      // No server copy yet — push the current tiles up as the initial state.
      this.persist();
    }
  }

  private nextId(): string {
    return `t${Date.now()}-${this.idCounter++}`;
  }

  private seed(): Tile[] {
    this.idCounter = 0;
    const t: Omit<Tile, 'id'>[] = [
      // ── Catina ──
      { stream: 'catina', lane: 'dev', month: 0, color: 'catina', milestone: false, badges: [], items: ['FF cleanup / Amplitude / Collaboration — Discovery', 'DOD+ scoping'] },
      { stream: 'catina', lane: 'dev', month: 1, color: 'catina', milestone: false, badges: [], items: ['New Editor Improvements, stabilization', 'View other editors; simplify variable entry; monitor load time', 'Collaboration — development'] },
      { stream: 'catina', lane: 'dev', month: 2, color: 'catina', milestone: false, badges: [], items: ['Transition Forms to V2 Catina', 'Add Attachments to Agreements in New Editor workflow', 'Move pay app calculations to the front end', 'Collaboration — testing'] },
      { stream: 'catina', lane: 'dev', month: 3, color: 'catina', milestone: false, badges: [], items: ['Add Revision History / Versions for documents'] },
      { stream: 'catina', lane: 'dev', month: 4, color: 'catina', milestone: false, badges: [], items: ['Low-cost E-Signature replacement w/ per-signer tracking display'] },
      { stream: 'catina', lane: 'release', month: 0, color: 'catina', milestone: true, badges: [], items: ['GA Release of New Editor', 'Catina migration starts'] },
      { stream: 'catina', lane: 'release', month: 1, color: 'catina', milestone: false, badges: [], items: ['Catina migration completes'] },
      { stream: 'catina', lane: 'release', month: 2, color: 'catina', milestone: false, badges: [], items: ['DoD+ Migration to Catina', 'Attachments Appended to Documents'] },
      { stream: 'catina', lane: 'release', month: 3, color: 'catina', milestone: false, badges: [], items: ['Version History', 'Collaboration — first release'] },
      { stream: 'catina', lane: 'release', month: 4, color: 'catina', milestone: false, badges: [], items: ['Collaboration — post-MVP enhancements'] },

      // ── AI Assistant ──
      { stream: 'ai-assistant', lane: 'dev', month: 0, color: 'ai-assistant', milestone: false, badges: [], items: ['Product POC — AI Chat v2'] },
      { stream: 'ai-assistant', lane: 'release', month: 0, color: 'ai-assistant', milestone: false, badges: [], items: ['AI Assistant MVP — Opt-In'] },
      { stream: 'ai-assistant', lane: 'release', month: 2, color: 'ai-assistant', milestone: true, badges: [], items: ['GA Release of AI Assistant'] },

      // ── AI Risk Review ──
      { stream: 'risk', lane: 'dev', month: 0, color: 'risk', milestone: false, badges: [], items: ['Product POC for Risk Review', 'Team getting set up / Enterprise API'] },
      { stream: 'risk', lane: 'dev', month: 1, color: 'risk', milestone: false, badges: [], items: ['Complete MVP Risk Review', 'Risk Review app'] },
      { stream: 'risk', lane: 'dev', month: 2, color: 'risk', milestone: false, badges: [], items: ['Risk Review Support / Refinements', 'Risk Review App'] },
      { stream: 'risk', lane: 'release', month: 3, color: 'risk', milestone: true, badges: [], items: ['Risk Review App Release'] },

      // ── Enterprise ──
      { stream: 'enterprise', lane: 'dev', month: 0, color: 'enterprise', milestone: false, badges: [], items: ['Enterprise API Solutioning', 'FusionAuth POC for partners', 'Procore Integration / Pipelines'] },
      { stream: 'enterprise', lane: 'dev', month: 1, color: 'enterprise', milestone: false, badges: [], items: ['Enterprise API Development', 'FusionAuth Configuration for Partners'] },
      { stream: 'enterprise', lane: 'dev', month: 2, color: 'enterprise', milestone: false, badges: [], items: ['Procore Integration Kick-off'] },
      { stream: 'enterprise', lane: 'dev', month: 3, color: 'enterprise', milestone: false, badges: [], items: ['Procore API Integration Development'] },
      { stream: 'enterprise', lane: 'release', month: 2, color: 'enterprise', milestone: true, badges: [], items: ['Enterprise API — MVP Release'] },
      { stream: 'enterprise', lane: 'release', month: 4, color: 'enterprise', milestone: true, badges: [], items: ['Procore API Integration — Beta Release'] },

      // ── Commerce ──
      { stream: 'commerce', lane: 'dev', month: 0, color: 'commerce', milestone: false, badges: ['catina'], items: ['DOD+ Entitlements - Catina'] },
      { stream: 'commerce', lane: 'dev', month: 0, color: 'commerce', milestone: false, badges: ['ecomm'], items: ['DOD+ Entitlements - eCommerce'] },
      { stream: 'commerce', lane: 'dev', month: 1, color: 'commerce', milestone: false, badges: [], items: ['DOD+ Entitlements', 'DOD+ Purchase Migrations', 'eComm — Enhancements'] },
      { stream: 'commerce', lane: 'dev', month: 2, color: 'commerce', milestone: false, badges: [], items: ['eComm — Ongoing Marketing Enhancements'] },
      { stream: 'commerce', lane: 'dev', month: 3, color: 'commerce', milestone: false, badges: [], items: ['eComm — Ongoing Marketing Enhancements'] },
      { stream: 'commerce', lane: 'dev', month: 4, color: 'commerce', milestone: false, badges: [], items: ['eComm — Ongoing Marketing Enhancements'] },

      // ── Define the Meter (UBP) ──
      { stream: 'ubp', lane: 'dev', month: 0, color: 'ubp', milestone: false, badges: ['product'], items: ['Requirement Gathering'] },
      { stream: 'ubp', lane: 'dev', month: 0, color: 'ubp', milestone: false, badges: [], label: 'eCommerce', items: ['eComm: Stripe UBP scoping'] },
      { stream: 'ubp', lane: 'dev', month: 0, color: 'ubp', milestone: false, badges: ['catina'], items: ['Catina: staged UI rollout scoping'] },
      { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: [], items: ['Metered billing architecture', 'Usage tracking instrumentation'] },
      { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: ['catina'], items: ['Any Outstanding Usage Based Statistics'] },
      { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: ['catina'], items: ['Integrate Usage Based Pricing into v2 Editor'] },
      { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: ['ecomm'], items: ['Estuate Scoping and Requirement Writing'] },
      { stream: 'ubp', lane: 'dev', month: 2, color: 'ubp', milestone: false, badges: ['ecomm'], items: ['Implement Usage Based Pricing'] },
      { stream: 'ubp', lane: 'dev', month: 2, color: 'ubp', milestone: false, badges: ['catina'], items: ['Usage Based UI Elements - Next Items'] },
      { stream: 'ubp', lane: 'dev', month: 3, color: 'ubp', milestone: false, badges: [], items: ['Customer-facing usage dashboard'] },
      { stream: 'ubp', lane: 'dev', month: 3, color: 'ubp-ecomm', milestone: false, badges: [], label: 'eCommerce', items: ['eCommerce — Stripe — Usage Based Pricing (cont.)'] },
      { stream: 'ubp', lane: 'dev', month: 4, color: 'ubp-ecomm', milestone: false, badges: [], label: 'eCommerce', items: ['eCommerce — Stripe — UBP finalization'] },
      { stream: 'ubp', lane: 'dev', month: 4, color: 'ubp', milestone: false, badges: ['catina'], items: ['Customers Usage Based Statistics'] },
      { stream: 'ubp', lane: 'release', month: 1, color: 'ubp', milestone: false, badges: ['catina'], items: ['Finalization Address Mismatch Flow'] },
      { stream: 'ubp', lane: 'release', month: 1, color: 'ubp', milestone: false, badges: ['ecomm'], items: ['Estuate POC in Our Env'] },

      // ── Platform ──
      { stream: 'platform', lane: 'dev', month: 1, color: 'platform', milestone: false, badges: [], items: ['Increased logging in Catina (~10% of effort)', 'API / front-end containerization / Doc Certificate', 'Minor enhancements to SC v1; begin rebuilding separately'] },
      { stream: 'platform', lane: 'dev', month: 2, color: 'platform', milestone: false, badges: [], items: ['Increased logging in Catina (~10% of effort)', 'Fusion Auth rollout', 'Development of SCV2'] },
      { stream: 'platform', lane: 'dev', month: 3, color: 'platform', milestone: false, badges: [], items: ['Fusion Auth rollout'] },
      { stream: 'platform', lane: 'release', month: 0, color: 'platform', milestone: false, badges: [], items: ['License transfer tooling', 'Migration status page'] },
      { stream: 'platform', lane: 'release', month: 3, color: 'platform', milestone: true, badges: ['platform'], items: ['Deliver SCv2'] },
    ];
    return t.map((tile) => ({ ...tile, id: this.nextId() }));
  }
}
