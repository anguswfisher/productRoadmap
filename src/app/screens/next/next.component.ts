import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RoadmapStorageService } from '../roadmap-editor/roadmap-storage.service';
import { APPS, AppKey, AppDef } from '../roadmap-editor/roadmap-model';
import {
  NextDoc,
  NextItem,
  NextHorizon,
  HORIZONS,
  horizonDef,
} from './next-model';

@Component({
  selector: 'app-next',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './next.component.html',
  styleUrls: ['./next.component.scss'],
})
export class NextComponent implements OnInit {
  readonly horizons = HORIZONS;
  readonly apps: AppDef[] = APPS;
  doc: NextDoc = { items: [], published: false };
  loading = true;
  error = false;

  appDef(key: AppKey): AppDef {
    return this.apps.find((a) => a.key === key)!;
  }

  constructor(private storage: RoadmapStorageService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.doc = await this.storage.getNext();
    } catch {
      this.error = true;
    } finally {
      this.loading = false;
    }
  }

  itemsFor(horizon: NextHorizon): NextItem[] {
    return this.doc.items.filter((i) => i.horizon === horizon);
  }

  horizonDef = horizonDef;

  get hasItems(): boolean {
    return this.doc.items.length > 0;
  }
}
