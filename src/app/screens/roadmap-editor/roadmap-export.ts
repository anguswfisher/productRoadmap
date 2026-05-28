// Generates a self-contained, read-only HTML snapshot of the roadmap —
// the same "Export Embeddable HTML" output as the original tool.

interface ExportStream { key: string; name: string; meta: string; color: string; devopsLink?: string; }
interface ExportMonth { month: string; quarter: string; current: boolean; }
interface ExportLane { key: string; label: string; }
interface ExportApp { key: string; label: string; badgeClass: string; }
interface ExportTile {
  stream: string;
  lane: string;
  month: number;
  color: string;
  milestone: boolean;
  badges: string[];
  label?: string;
  items: string[];
  createdBy?: string[];
  link?: string;
}

export interface ExportData {
  streams: ExportStream[];
  months: ExportMonth[];
  lanes: ExportLane[];
  apps: ExportApp[];
  tiles: ExportTile[];
  title?: string;
  /** When false, omit the banner/header/footer chrome (just legend + grid). */
  chrome?: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ROADMAP_CSS = `
  :root {
    --bg:#f7f6f3;--bg-elevated:#ffffff;--bg-soft:#fafaf7;--border:#e8e6e0;--border-strong:#d8d5cd;
    --text:#1a1d24;--text-muted:#5f6573;--text-dim:#8a8f9a;
    --accent:#d92447;--accent-soft:#fce7eb;--accent-dark:#b51c39;
    --release:#16a34a;--release-soft:#dcfce7;--release-dark:#15803d;
    --catina:#2e86c1;--catina-bg:#e8f2fa;--catina-bg-soft:#f3f8fc;--catina-border:#b8d8ed;--catina-text:#1a5a85;
    --ai-assistant:#7c3aed;--ai-assistant-bg:#f0ebfd;--ai-assistant-bg-soft:#f7f4fe;--ai-assistant-border:#d4c2f5;--ai-assistant-text:#5b21b6;
    --risk:#c2185b;--risk-bg:#fce4ec;--risk-bg-soft:#fdf0f5;--risk-border:#f0b8cf;--risk-text:#8a0f3f;
    --enterprise:#2e7d32;--enterprise-bg:#e6f4e7;--enterprise-bg-soft:#f1f9f2;--enterprise-border:#b8d8b9;--enterprise-text:#1b5e20;
    --commerce:#c2410c;--commerce-bg:#fde8d8;--commerce-bg-soft:#fdf3eb;--commerce-border:#f0c8a3;--commerce-text:#8a2c08;
    --platform:#475569;--platform-bg:#e8ecf1;--platform-bg-soft:#f1f4f8;--platform-border:#c4ccd8;--platform-text:#2c3848;
    --ubp:#b45309;--ubp-bg:#fef3c7;--ubp-bg-soft:#fffbeb;--ubp-border:#fcd34d;--ubp-text:#78350f;
    --ubp-ecomm:#0e7490;--ubp-ecomm-bg:#cffafe;--ubp-ecomm-bg-soft:#ecfeff;--ubp-ecomm-border:#67e8f9;--ubp-ecomm-text:#164e63;
    --ubp-catina:#6d28d9;--ubp-catina-bg:#ede9fe;--ubp-catina-bg-soft:#f5f3ff;--ubp-catina-border:#c4b5fd;--ubp-catina-text:#4c1d95;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter Tight',-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:0 0 80px;letter-spacing:-0.005em;}
  .banner{background:var(--accent);color:white;padding:14px 40px;display:flex;align-items:center;justify-content:space-between;font-size:14px;}
  .banner-left{display:flex;align-items:baseline;gap:14px;}
  .banner-left .brand{font-weight:700;font-size:18px;letter-spacing:-0.01em;}
  .banner-left .brand .light{font-weight:400;margin-left:4px;}
  .banner-left .tagline{font-style:italic;opacity:.85;font-size:13px;}
  .banner-right{display:flex;align-items:center;gap:12px;font-size:13px;opacity:.9;font-style:italic;}
  .container{max-width:1640px;margin:0 auto;padding:48px 40px 0;}
  .header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid var(--border);}
  .header-left .eyebrow{display:inline-block;padding:5px 14px;background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;border-radius:100px;margin-bottom:16px;}
  .header-left h1{font-family:'Fraunces',serif;font-weight:600;font-size:56px;line-height:1;letter-spacing:-0.025em;}
  .header-left h1 em{font-style:italic;font-weight:400;color:var(--accent);}
  .header-left .subtitle{margin-top:14px;color:var(--text-muted);font-size:15px;max-width:620px;line-height:1.5;}
  .header-right{text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-dim);line-height:1.7;}
  .header-right .live{display:inline-flex;align-items:center;gap:8px;color:var(--text-muted);}
  .header-right .live::before{content:'';width:7px;height:7px;border-radius:50%;background:#16a34a;box-shadow:0 0 8px rgba(22,163,74,.5);}
  .legend{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;align-items:center;}
  .legend-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 14px 7px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:100px;font-size:13px;font-weight:500;color:var(--text);user-select:none;}
  .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .legend-dot.catina{background:var(--catina);}
  .legend-dot.ai-assistant{background:var(--ai-assistant);}
  .legend-dot.risk{background:var(--risk);}
  .legend-dot.enterprise{background:var(--enterprise);}
  .legend-dot.commerce{background:var(--commerce);}
  .legend-dot.platform{background:var(--platform);}
  .legend-dot.ubp{background:var(--ubp);}
  .legend-divider{width:1px;height:22px;background:var(--border);margin:0 6px;}
  .legend-key{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text-muted);font-weight:500;}
  .legend-key .swatch{display:inline-block;width:16px;height:11px;border-radius:3px;}
  .legend-key .swatch.dev{background:#f0eee8;border:1px dashed var(--border-strong);}
  .legend-key .swatch.release{background:var(--release-soft);border:1px solid var(--release);}
  .roadmap{display:grid;grid-template-columns:200px 120px repeat(5,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.03),0 8px 24px rgba(0,0,0,.04);}
  .month-header{background:var(--bg-elevated);padding:18px 16px;text-align:center;}
  .month-header .month{font-family:'Fraunces',serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;}
  .month-header .quarter{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-dim);margin-top:4px;letter-spacing:.1em;}
  .month-header.current{background:linear-gradient(180deg,var(--accent-soft),rgba(252,231,235,.3));position:relative;}
  .month-header.current::after{content:'NOW';position:absolute;top:10px;right:12px;font-size:9px;color:var(--accent);letter-spacing:.18em;font-weight:700;}
  .month-header.current .month{color:var(--accent);}
  .corner-cell{background:var(--bg-elevated);grid-column:span 2;}
  .stream-row{display:contents;}
  .stream-label{background:var(--bg-elevated);padding:22px 18px;display:flex;flex-direction:column;justify-content:center;border-left:4px solid transparent;grid-row:span 2;}
  .stream-label.catina{border-left-color:var(--catina);}
  .stream-label.ai-assistant{border-left-color:var(--ai-assistant);}
  .stream-label.risk{border-left-color:var(--risk);}
  .stream-label.enterprise{border-left-color:var(--enterprise);}
  .stream-label.commerce{border-left-color:var(--commerce);}
  .stream-label.platform{border-left-color:var(--platform);}
  .stream-label.ubp{border-left-color:var(--ubp);}
  .stream-label .stream-name{font-family:'Fraunces',serif;font-weight:500;font-size:19px;letter-spacing:-0.015em;line-height:1.15;}
  .stream-label .stream-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-dim);margin-top:6px;letter-spacing:.08em;text-transform:uppercase;}
  .stream-label .stream-link{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:inherit;opacity:.7;text-decoration:none;border:1px solid currentColor;padding:2px 6px;border-radius:4px;align-self:flex-start;}
  .stream-label .stream-link:hover{opacity:1;}
  .lane-label{background:var(--bg-soft);padding:14px;display:flex;align-items:center;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-weight:600;gap:8px;}
  .lane-label .lane-icon{display:inline-block;width:14px;height:10px;border-radius:3px;flex-shrink:0;}
  .lane-label.dev .lane-icon{background:#f0eee8;border:1px dashed var(--border-strong);}
  .lane-label.release .lane-icon{background:var(--release-soft);border:1px solid var(--release);}
  .roadmap-cell{background:var(--bg-elevated);padding:10px;min-height:76px;display:flex;flex-direction:column;gap:6px;position:relative;}
  .roadmap-cell.current-month{background:linear-gradient(180deg,rgba(252,231,235,.35),var(--bg-elevated));}
  .tile{padding:10px 12px;border-radius:8px;border:1px solid;font-size:12.5px;line-height:1.4;font-weight:500;position:relative;}
  .tile.dev{border-style:dashed;}
  .tile.dev.catina{background:var(--catina-bg-soft);border-color:var(--catina-border);color:var(--catina-text);}
  .tile.dev.ai-assistant{background:var(--ai-assistant-bg-soft);border-color:var(--ai-assistant-border);color:var(--ai-assistant-text);}
  .tile.dev.risk{background:var(--risk-bg-soft);border-color:var(--risk-border);color:var(--risk-text);}
  .tile.dev.enterprise{background:var(--enterprise-bg-soft);border-color:var(--enterprise-border);color:var(--enterprise-text);}
  .tile.dev.commerce{background:var(--commerce-bg-soft);border-color:var(--commerce-border);color:var(--commerce-text);}
  .tile.dev.platform{background:var(--platform-bg-soft);border-color:var(--platform-border);color:var(--platform-text);}
  .tile.dev.ubp{background:var(--ubp-bg-soft);border-color:var(--ubp-border);color:var(--ubp-text);}
  .tile.dev.ubp-ecomm{background:var(--ubp-ecomm-bg-soft);border-color:var(--ubp-ecomm-border);color:var(--ubp-ecomm-text);}
  .tile.dev.ubp-catina{background:var(--ubp-catina-bg-soft);border-color:var(--ubp-catina-border);color:var(--ubp-catina-text);}
  .tile.release.catina{background:var(--catina-bg);border-color:var(--catina-border);color:var(--catina-text);}
  .tile.release.ai-assistant{background:var(--ai-assistant-bg);border-color:var(--ai-assistant-border);color:var(--ai-assistant-text);}
  .tile.release.risk{background:var(--risk-bg);border-color:var(--risk-border);color:var(--risk-text);}
  .tile.release.enterprise{background:var(--enterprise-bg);border-color:var(--enterprise-border);color:var(--enterprise-text);}
  .tile.release.commerce{background:var(--commerce-bg);border-color:var(--commerce-border);color:var(--commerce-text);}
  .tile.release.platform{background:var(--platform-bg);border-color:var(--platform-border);color:var(--platform-text);}
  .tile.release.ubp{background:var(--ubp-bg);border-color:var(--ubp-border);color:var(--ubp-text);}
  .tile.release.ubp-ecomm{background:var(--ubp-ecomm-bg);border-color:var(--ubp-ecomm-border);color:var(--ubp-ecomm-text);}
  .tile.release.ubp-catina{background:var(--ubp-catina-bg);border-color:var(--ubp-catina-border);color:var(--ubp-catina-text);}
  .tile.milestone{box-shadow:inset 0 0 0 1.5px currentColor;}
  .tile.milestone::before{content:'★';position:absolute;top:6px;right:10px;font-size:11px;color:var(--release);opacity:.95;}
  .tile-label{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-bottom:5px;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.07);}
  .tile-app-badges{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}
  .tile-app-badge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:100px;border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.55);}
  .tile-app-badge .badge-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .badge-catina{color:var(--catina-text);}  .badge-catina .badge-dot{background:var(--catina);}
  .badge-ecomm{color:var(--commerce-text);}  .badge-ecomm .badge-dot{background:var(--commerce);}
  .badge-ai{color:var(--ai-assistant-text);}  .badge-ai .badge-dot{background:var(--ai-assistant);}
  .badge-risk{color:var(--risk-text);}  .badge-risk .badge-dot{background:var(--risk);}
  .badge-enterprise{color:var(--enterprise-text);}  .badge-enterprise .badge-dot{background:var(--enterprise);}
  .badge-platform{color:var(--platform-text);}  .badge-platform .badge-dot{background:var(--platform);}
  .badge-product{color:#92400e;}  .badge-product .badge-dot{background:#d97706;}
  .tile-items{display:flex;flex-direction:column;gap:3px;}
  .tile-item{font-size:12.5px;font-weight:500;}
  .tile-item+.tile-item{padding-top:4px;border-top:1px dashed rgba(0,0,0,.1);}
  .tile-created-by{margin-top:7px;padding-top:6px;border-top:1px dashed rgba(0,0,0,.1);font-size:10px;font-weight:600;color:var(--text-dim);letter-spacing:.02em;}
  .tile-created-by-label{text-transform:uppercase;letter-spacing:.1em;opacity:.7;margin-right:4px;}
  .tile-link{display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:inherit;opacity:.75;text-decoration:none;border:1px solid currentColor;padding:2px 6px;border-radius:4px;align-self:flex-start;}
  .tile-link:hover{opacity:1;}
  .disclaimer{display:flex;align-items:center;gap:14px;padding:14px 40px;background:#fef3c7;border-top:1px solid #f59e0b;border-bottom:1px solid #f59e0b;border-left:6px solid #b45309;color:#78350f;font-size:13.5px;line-height:1.45;font-weight:500;}
  .disclaimer .badge{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:999px;background:#b45309;color:#fff;white-space:nowrap;flex-shrink:0;}
  .disclaimer strong{font-weight:700;color:#78350f;}
  .footer{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  .footer-block{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:20px 22px;}
  .footer-block h4{font-size:11px;color:var(--accent);letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;font-weight:700;}
  .footer-block p{font-size:13.5px;color:var(--text-muted);line-height:1.6;}
  .footer-block p strong{color:var(--text);}
  .footer-block .legend-mini{display:flex;gap:22px;margin-top:14px;flex-wrap:wrap;}
  .footer-block .legend-mini div{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-muted);}
  .footer-block .legend-mini span.star{color:var(--release);font-size:15px;}
  @media(max-width:1280px){.roadmap{grid-template-columns:170px 110px repeat(5,minmax(150px,1fr));}.header{flex-direction:column;align-items:flex-start;gap:16px;}.header-right{text-align:left;}.footer{grid-template-columns:1fr;}}
`;

function renderTile(t: ExportTile, apps: ExportApp[]): string {
  const cls = ['tile', t.lane, t.color, t.milestone ? 'milestone' : '']
    .filter(Boolean)
    .join(' ');
  const label = t.label ? `<div class="tile-label">${esc(t.label)}</div>` : '';
  const badges = t.badges.length
    ? `<div class="tile-app-badges">${t.badges
        .map((b) => {
          const def = apps.find((a) => a.key === b);
          if (!def) return '';
          return `<span class="tile-app-badge ${def.badgeClass}"><span class="badge-dot"></span>${esc(def.label)}</span>`;
        })
        .join('')}</div>`
    : '';
  const items = `<div class="tile-items">${t.items
    .map((i) => `<div class="tile-item">${esc(i)}</div>`)
    .join('')}</div>`;
  const createdBy = t.createdBy && t.createdBy.length
    ? `<div class="tile-created-by"><span class="tile-created-by-label">By</span>${esc(t.createdBy.join(', '))}</div>`
    : '';
  const link = t.link
    ? `<a class="tile-link" href="${esc(t.link)}" target="_blank" rel="noopener">↗ Link</a>`
    : '';
  return `<div class="${cls}">${label}${badges}${items}${link}${createdBy}</div>`;
}

export function buildRoadmapHtml(data: ExportData): string {
  const { streams, months, lanes, apps, tiles } = data;
  const chrome = data.chrome !== false;
  const label = data.title ?? 'Roadmap';
  const windowText = months.length
    ? `${months[0].month} – ${months[months.length - 1].month}`
    : '';

  const monthHeaders = months
    .map(
      (m) =>
        `<div class="month-header${m.current ? ' current' : ''}"><div class="month">${esc(m.month)}</div><div class="quarter">${esc(m.quarter)}</div></div>`,
    )
    .join('');

  const streamRows = streams
    .map((s) => {
      const lanesHtml = lanes
        .map((lane) => {
          const laneLabel = `<div class="lane-label ${lane.key}"><span class="lane-icon"></span>${esc(lane.label)}</div>`;
          const cells = months
            .map((m, mi) => {
              const cellTiles = tiles
                .filter(
                  (t) => t.stream === s.key && t.lane === lane.key && t.month === mi,
                )
                .map((t) => renderTile(t, apps))
                .join('');
              return `<div class="roadmap-cell${m.current ? ' current-month' : ''}">${cellTiles}</div>`;
            })
            .join('');
          return laneLabel + cells;
        })
        .join('');
      const link = s.devopsLink
        ? `<a class="stream-link" href="${esc(s.devopsLink)}" target="_blank" rel="noopener">↗ DevOps</a>`
        : '';
      return `<div class="stream-row"><div class="stream-label ${s.color}"><div class="stream-name">${esc(s.name)}</div><div class="stream-meta">${esc(s.meta)}</div>${link}</div>${lanesHtml}</div>`;
    })
    .join('');

  const legendPills = streams
    .map(
      (s) =>
        `<div class="legend-pill"><span class="legend-dot ${s.color}"></span>${esc(s.name)}</div>`,
    )
    .join('');

  const updated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Product Roadmap — by Value Stream</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${ROADMAP_CSS}</style>
</head>
<body>
${chrome ? `<div class="disclaimer"><span class="badge">⚠ Internal use only</span><span>This roadmap reflects our <strong>current best-guess of commitments</strong> — dates and scope can change. Please be thoughtful when communicating any of this to customers.</span></div>` : ''}
${chrome ? `<div class="banner">
  <div class="banner-left">
    <div class="brand">Product<span class="light">Roadmap</span></div>
    <div class="tagline">powered by the Product team</div>
  </div>
  <div class="banner-right"><span>"What we're building, and when."</span></div>
</div>` : ''}
<div class="container"${chrome ? '' : ' style="padding-top:28px;"'}>
  ${chrome ? `<div class="header">
    <div class="header-left">
      <div class="eyebrow">Product Roadmap</div>
      <h1>ACD Product Roadmap <em>· ${esc(label)}</em></h1>
      <p class="subtitle">What we're building across value streams, and when it ships.</p>
    </div>
    <div class="header-right">
      <div class="live">Updated ${esc(updated)}</div>
      <div style="margin-top:4px;">Owner · Product</div>
      <div>Window · ${esc(windowText)}</div>
    </div>
  </div>` : ''}
  <div class="legend">
    ${legendPills}
    <div class="legend-divider"></div>
    <div class="legend-key"><span class="swatch dev"></span>Dev / Testing</div>
    <div class="legend-key"><span class="swatch release"></span>Release</div>
  </div>
  <div class="roadmap" style="grid-template-columns:200px 120px repeat(${months.length},minmax(0,1fr));">
    <div class="corner-cell"></div>
    ${monthHeaders}
    ${streamRows}
  </div>
</div>
</body></html>`;
}
