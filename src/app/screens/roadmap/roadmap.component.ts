import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-roadmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roadmap.component.html',
  styleUrls: ['./roadmap.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class RoadmapComponent {
  readonly roadmapSrc: SafeResourceUrl;

  constructor(sanitizer: DomSanitizer) {
    this.roadmapSrc = sanitizer.bypassSecurityTrustResourceUrl(
      'assets/roadmap/roadmap.html',
    );
  }
}
