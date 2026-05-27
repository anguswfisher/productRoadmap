// Builds a PowerPoint (.pptx) deck from the current roadmap: a title slide plus
// one slide per value stream (a Dev/Release × months table of that stream's items).
import { StreamDef, MonthDef, Lane, AppDef, Tile } from './roadmap-model';

export interface SlidesData {
  streams: StreamDef[];
  months: MonthDef[];
  lanes: { key: Lane; label: string }[];
  apps: AppDef[];
  tiles: Tile[];
}

// Stream accent colors (hex, no '#') roughly matching the on-screen palette.
const STREAM_COLOR: Record<string, string> = {
  catina: '2E86C1',
  'ai-assistant': '7C3AED',
  risk: 'C2185B',
  enterprise: '2E7D32',
  commerce: 'C2410C',
  ubp: 'B45309',
  platform: '475569',
};

function cellText(tiles: Tile[]): string {
  if (!tiles.length) return '';
  return tiles
    .map((t) => {
      const star = t.milestone ? '★ ' : '';
      const body = t.items.join('; ');
      const by =
        t.createdBy && t.createdBy.length ? `  — ${t.createdBy.join(', ')}` : '';
      return `${star}${body}${by}`;
    })
    .join('\n');
}

export async function exportRoadmapSlides(data: SlidesData): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  // ── Title slide ────────────────────────────────────────────────
  const title = pptx.addSlide();
  title.background = { color: 'F7F6F3' };
  title.addText('ACD Product Roadmap', {
    x: 0.5,
    y: 2.5,
    w: 12.33,
    h: 1,
    fontSize: 40,
    bold: true,
    color: '1A1D24',
    align: 'center',
  });
  title.addText('What we’re building, and when', {
    x: 0.5,
    y: 3.6,
    w: 12.33,
    h: 0.6,
    fontSize: 18,
    color: '5F6573',
    align: 'center',
  });
  title.addText(
    `May – September 2026   ·   Generated ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`,
    {
      x: 0.5,
      y: 4.3,
      w: 12.33,
      h: 0.4,
      fontSize: 12,
      color: '8A8F9A',
      align: 'center',
    },
  );

  // ── One slide per stream ───────────────────────────────────────
  const monthCount = data.months.length;
  const firstColW = 1.6;
  const monthColW = (12.5 - firstColW) / monthCount;

  for (const s of data.streams) {
    const slide = pptx.addSlide();
    const color = STREAM_COLOR[s.key] ?? '475569';

    slide.addText(s.name, {
      x: 0.4,
      y: 0.3,
      w: 12.5,
      h: 0.6,
      fontSize: 26,
      bold: true,
      color,
    });
    slide.addText(s.meta, {
      x: 0.4,
      y: 0.92,
      w: 12.5,
      h: 0.35,
      fontSize: 12,
      color: '5F6573',
    });

    // Header row: blank corner + month headers.
    const header: unknown[] = [
      { text: '', options: { fill: { color } } },
      ...data.months.map((m) => ({
        text: `${m.month}\n${m.quarter}`,
        options: {
          bold: true,
          color: 'FFFFFF',
          fill: { color },
          align: 'center',
          fontSize: 11,
        },
      })),
    ];

    const rows: unknown[][] = [header];
    for (const lane of data.lanes) {
      const row: unknown[] = [
        {
          text: lane.label,
          options: {
            bold: true,
            fontSize: 11,
            fill: { color: 'EFEDE8' },
            valign: 'middle',
            color: '1A1D24',
          },
        },
      ];
      data.months.forEach((_m, mi) => {
        const tiles = data.tiles.filter(
          (t) => t.stream === s.key && t.lane === lane.key && t.month === mi,
        );
        row.push({
          text: cellText(tiles),
          options: { fontSize: 9, valign: 'top', color: '1A1D24' },
        });
      });
      rows.push(row);
    }

    slide.addTable(rows as never, {
      x: 0.4,
      y: 1.45,
      w: 12.5,
      colW: [firstColW, ...data.months.map(() => monthColW)],
      rowH: [0.5, 2.45, 2.45],
      border: { type: 'solid', color: 'D8D5CD', pt: 0.5 },
      valign: 'top',
      autoPage: false,
    });
  }

  await pptx.writeFile({ fileName: 'ACD-Product-Roadmap.pptx' });
}
