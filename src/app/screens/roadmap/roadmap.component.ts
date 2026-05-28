import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { buildRoadmapHtml } from '../roadmap-editor/roadmap-export';
import {
  downloadRoadmapHtml,
  copyRoadmapHtml,
  exportRoadmapPdf,
} from '../roadmap-editor/roadmap-export-actions';
import { RoadmapStorageService } from '../roadmap-editor/roadmap-storage.service';
import {
  Roadmap,
  StreamDef,
  MonthDef,
  Tile,
  LANES,
  APPS,
  quarterMonths,
  quarterLabel,
  combineRoadmaps,
  rollingWindow,
} from '../roadmap-editor/roadmap-model';

interface RenderPayload {
  streams: StreamDef[];
  months: MonthDef[];
  lanes: typeof LANES;
  apps: typeof APPS;
  tiles: Tile[];
  title: string;
}

// Public, read-only view. No login. Shows published roadmaps: single quarter
// (picker) or full stitched timeline, with the same export options as the editor.
@Component({
  selector: 'app-roadmap',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './roadmap.component.html',
  styleUrls: ['./roadmap.component.scss'],
})
export class RoadmapComponent implements OnInit {
  published: Roadmap[] = [];
  selectedId: string | null = null;
  mode: 'quarter' | 'timeline' | 'rolling' = 'quarter';
  rollingMonths = 3;
  readonly rollingOptions = [1, 2, 3, 6];
  html: SafeHtml | null = null;
  loading = true;
  error = false;

  pdfBusy = false;
  slidesBusy = false;
  copied = false;
  displayTitle = '';

  private payload: RenderPayload | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private storage: RoadmapStorageService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.published = await this.storage.listPublished();
      if (this.published.length) this.select(this.published[0].id);
    } catch {
      this.error = true;
    } finally {
      this.loading = false;
    }
  }

  label(r: Roadmap): string {
    return quarterLabel(r.quarter, r.year);
  }

  setMode(mode: 'quarter' | 'timeline' | 'rolling'): void {
    this.mode = mode;
    if (mode === 'timeline') this.renderTimeline();
    else if (mode === 'rolling') this.renderRolling();
    else if (this.selectedId) this.select(this.selectedId);
    else if (this.published.length) this.select(this.published[0].id);
  }

  setRollingMonths(n: number): void {
    this.rollingMonths = n;
    if (this.mode === 'rolling') this.renderRolling();
  }

  private renderRolling(): void {
    const c = rollingWindow(this.published, this.rollingMonths);
    this.render({
      streams: c.streams,
      months: c.months,
      lanes: LANES,
      apps: APPS,
      tiles: c.tiles,
      title: c.title,
    });
  }

  select(id: string): void {
    const r = this.published.find((x) => x.id === id);
    if (!r) return;
    this.selectedId = id;
    this.render({
      streams: r.initiatives,
      months: quarterMonths(r.quarter, r.year),
      lanes: LANES,
      apps: APPS,
      tiles: r.tiles,
      title: quarterLabel(r.quarter, r.year),
    });
  }

  private renderTimeline(): void {
    const c = combineRoadmaps(this.published);
    this.render({
      streams: c.streams,
      months: c.months,
      lanes: LANES,
      apps: APPS,
      tiles: c.tiles,
      title: c.title,
    });
  }

  private render(payload: RenderPayload): void {
    this.payload = payload;
    this.displayTitle = payload.title;
    // On-screen: chromeless (no banner/header/footer) to match the editor look.
    this.html = this.sanitizer.bypassSecurityTrustHtml(
      buildRoadmapHtml({ ...payload, chrome: false }),
    );
  }

  // Full self-contained doc for downloads / embedding.
  private fullDoc(): string {
    return this.payload ? buildRoadmapHtml({ ...this.payload, chrome: true }) : '';
  }

  private fileName(ext: string): string {
    const base = this.payload?.title ?? 'roadmap';
    return `roadmap-${base.replace(/\s+/g, '-')}.${ext}`;
  }

  // ── Export ──────────────────────────────────────────────────────
  exportHtml(): void {
    const doc = this.fullDoc();
    if (doc) downloadRoadmapHtml(doc, this.fileName('html'));
  }

  async exportPdf(): Promise<void> {
    const doc = this.fullDoc();
    if (this.pdfBusy || !doc) return;
    this.pdfBusy = true;
    try {
      await exportRoadmapPdf(doc, this.fileName('pdf'));
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      this.pdfBusy = false;
    }
  }

  async exportSlides(): Promise<void> {
    if (this.slidesBusy || !this.payload) return;
    this.slidesBusy = true;
    try {
      const { exportRoadmapSlides } = await import('../roadmap-editor/roadmap-slides');
      await exportRoadmapSlides(this.payload);
    } catch (err) {
      console.error('Slides export failed:', err);
    } finally {
      this.slidesBusy = false;
    }
  }

  async copyEmbed(): Promise<void> {
    const doc = this.fullDoc();
    if (doc && (await copyRoadmapHtml(doc))) {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    }
  }
}
