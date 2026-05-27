import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { buildRoadmapHtml } from '../roadmap-editor/roadmap-export';
import { RoadmapStorageService } from '../roadmap-editor/roadmap-storage.service';
import { STREAMS, MONTHS, LANES, APPS, Tile } from '../roadmap-editor/roadmap-model';

// Public, read-only view of the live roadmap. No login required, no editing —
// it renders the same self-contained read-only HTML as the export, built from
// the current tiles in Supabase.
@Component({
  selector: 'app-roadmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roadmap.component.html',
  styleUrls: ['./roadmap.component.scss'],
})
export class RoadmapComponent implements OnInit {
  html: SafeHtml | null = null;
  loading = true;
  error = false;

  constructor(
    private sanitizer: DomSanitizer,
    private storage: RoadmapStorageService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const tiles = (await this.storage.load<Tile>()) ?? [];
      const doc = buildRoadmapHtml({
        streams: STREAMS,
        months: MONTHS,
        lanes: LANES,
        apps: APPS,
        tiles,
      });
      this.html = this.sanitizer.bypassSecurityTrustHtml(doc);
    } catch {
      this.error = true;
    } finally {
      this.loading = false;
    }
  }
}
