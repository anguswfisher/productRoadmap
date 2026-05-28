import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RoadmapStorageService, SaveState } from '../roadmap-editor/roadmap-storage.service';
import { genId, APPS, AppKey, AppDef } from '../roadmap-editor/roadmap-model';
import {
  NextDoc,
  NextItem,
  NextHorizon,
  HORIZONS,
  horizonDef,
} from './next-model';

@Component({
  selector: 'app-next-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './next-editor.component.html',
  styleUrls: ['./next.component.scss'],
})
export class NextEditorComponent implements OnInit {
  readonly horizons = HORIZONS;
  readonly apps: AppDef[] = APPS;
  doc: NextDoc = { items: [], published: false };
  loading = true;
  saveState: SaveState = 'idle';

  appDef(key: AppKey): AppDef {
    return this.apps.find((a) => a.key === key)!;
  }
  isItemBadgeSelected(item: NextItem, app: AppKey): boolean {
    return !!item.badges?.includes(app);
  }
  toggleItemBadge(item: NextItem, app: AppKey): void {
    const set = new Set(item.badges ?? []);
    if (set.has(app)) set.delete(app);
    else set.add(app);
    item.badges = Array.from(set);
    this.persist();
  }

  constructor(private storage: RoadmapStorageService) {}

  async ngOnInit(): Promise<void> {
    this.doc = await this.storage.getNext();
    this.loading = false;
    this.saveState = 'saved';
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

  itemsFor(horizon: NextHorizon): NextItem[] {
    return this.doc.items.filter((i) => i.horizon === horizon);
  }

  horizonDef = horizonDef;

  addItem(horizon: NextHorizon = 'soon'): void {
    this.doc.items.push({
      id: genId('next'),
      title: '',
      notes: '',
      horizon,
    });
    this.persist();
  }

  deleteItem(item: NextItem): void {
    this.doc.items = this.doc.items.filter((i) => i.id !== item.id);
    this.persist();
  }

  onItemChange(): void {
    this.persist();
  }

  async togglePublish(): Promise<void> {
    this.doc.published = !this.doc.published;
    await this.storage.saveNextNow(this.doc, (s) => (this.saveState = s));
  }

  trackItem = (_: number, i: NextItem) => i.id;

  private persist(): void {
    this.storage.saveNext(this.doc, (s) => (this.saveState = s));
  }
}
