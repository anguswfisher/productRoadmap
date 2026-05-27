// Shared export actions used by both the editor and the public read-only view.
// (Slides live in roadmap-slides.ts; this covers HTML download, copy, and PDF.)

export function downloadRoadmapHtml(doc: string, filename: string): void {
  const blob = new Blob([doc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyRoadmapHtml(doc: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(doc);
    return true;
  } catch {
    return false;
  }
}

/** Rasterizes the read-only HTML and fits the whole roadmap onto one A4 page. */
export async function exportRoadmapPdf(doc: string, filename: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1720px;height:10px;border:0;';
  document.body.appendChild(iframe);
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const d = iframe.contentDocument;
    if (!d) throw new Error('Could not access export frame');
    d.open();
    d.write(doc);
    d.close();
    try {
      await (d as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      /* fonts API unavailable */
    }
    await new Promise((r) => setTimeout(r, 350));
    const target = d.body;
    const width = target.scrollWidth;
    const height = target.scrollHeight;
    const canvas = await html2canvas(target, {
      width, height, windowWidth: width, windowHeight: height,
      scale: 2, backgroundColor: '#f7f6f3', useCORS: true,
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
    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
