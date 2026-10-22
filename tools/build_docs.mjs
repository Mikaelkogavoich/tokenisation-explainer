// Script document as PDF (printed from HTML) and Word, both built from content/script.json
// and the voice timeline, so the document says exactly what the video says.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import * as docx from '/opt/node22/lib/node_modules/docx/dist/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const S = JSON.parse(fs.readFileSync('content/script.json', 'utf8'));
const TL = JSON.parse(fs.readFileSync('build/timeline.json', 'utf8'));
const MAN = JSON.parse(fs.readFileSync('evidence/manifest.json', 'utf8'));
const tc = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; };
const span = (id) => { const i = TL.scenes.findIndex((s) => s.id === id); const a = i ? TL.scenes[i].start - 0.35 : 0; const b = TL.scenes[i + 1] ? TL.scenes[i + 1].start - 0.35 : TL.duration; return [a, b]; };
const captured = (url) => (MAN.find((m) => m.url === url) || {}).captured_utc || '';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const words = S.scenes.reduce((n, s) => n + s.vo.join(' ').split(/\s+/).length, 0);

const intro = [
  ['Asset', S.meta.asset],
  ['Runtime', `${TL.duration.toFixed(1)} seconds, 1920 x 1080, ${S.video.fps} fps, H.264 MP4`],
  ['Voiceover', `${S.voice.accent}, ${words} words, generated with ${S.voice.engine} (voice ${S.voice.voice}, Apache 2.0)`],
  ['Subtitles', 'Burned into the main video, and supplied as SRT and WebVTT files'],
  ['Spelling', S.meta.spelling],
  ['Fact rule', 'Every statement about Redbelly Network or Tokeniser below is matched to a verbatim quote from the supplied resources. No price talk, no returns, no investment advice.'],
];

// ---------- PDF ----------
const fontFace = (w) => `@font-face{font-family:Montserrat;font-weight:${w};src:url(file://${path.resolve(`assets/fonts/Montserrat-${w}.ttf`)})}`;
let html = `<!doctype html><html><head><meta charset="utf-8"><style>
${[400, 500, 600, 700].map(fontFace).join('\n')}
@font-face{font-family:Plex;src:url(file://${path.resolve('assets/fonts/IBMPlexMono-500.ttf')})}
@page{size:A4;margin:16mm 15mm 18mm}
body{font-family:Montserrat;color:#343740;font-size:9.6pt;line-height:1.45}
h1{font-size:24pt;margin:0 0 4pt;font-weight:700;letter-spacing:-.01em}
h2{font-size:13pt;margin:18pt 0 6pt;font-weight:700}
.kick{font-family:Plex;color:#009c9c;font-size:8.5pt;letter-spacing:.12em;text-transform:uppercase}
.sub{color:#5e6270;font-size:11pt;margin-bottom:14pt}
table{border-collapse:collapse;width:100%}
.meta td{padding:4pt 6pt;border-bottom:1px solid #e2ded7;vertical-align:top}.meta td:first-child{width:22%;font-weight:600}
.scene{border:1px solid #d8d5cf;border-radius:8pt;padding:10pt 12pt;margin:0 0 10pt}.claims tr,.vo,h3{break-inside:avoid}h2{break-after:avoid}
.scene h3{margin:0 0 6pt;font-size:11.5pt}.tc{font-family:Plex;font-size:8.5pt;color:#5e6270;float:right}
.vo{background:#f2fff7;border-left:3pt solid #54f9a1;padding:6pt 9pt;margin:4pt 0 8pt;font-size:10.5pt;font-weight:500}
.lbl{font-weight:700;font-size:8pt;letter-spacing:.06em;text-transform:uppercase;color:#5e6270;margin-top:6pt}
.ost{display:inline-block;background:#eff0f2;border-radius:10pt;padding:1pt 7pt;margin:2pt 3pt 0 0;font-size:8.6pt}
.claims td{border-top:1px solid #e2ded7;padding:4pt 5pt;vertical-align:top;font-size:8.6pt}.claims td:first-child{width:30%;font-weight:600}
.q{font-style:italic}.src{color:#009c9c}
.foot{color:#5e6270;font-size:8pt}
</style></head><body>
<div class="kick">Script document · ${esc(S.meta.task)}</div>
<h1>${esc(S.meta.title)}</h1><div class="sub">${esc(S.meta.subtitle)}</div>
<table class="meta">${intro.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
<h2>Full voiceover</h2><p>${S.scenes.map((s) => s.vo.join(' ')).map(esc).join(' ')}</p>
<h2>Scene by scene</h2>`;
for (const sc of S.scenes) {
  const [a, b] = span(sc.id);
  html += `<div class="scene"><span class="tc">${tc(a)} to ${tc(b)}</span><h3>${esc(sc.name)}</h3>
  <div class="lbl">Voiceover</div><div class="vo">${sc.vo.map(esc).join(' ')}</div>
  <div class="lbl">On screen text</div><div>${sc.on_screen.map((o) => `<span class="ost">${esc(o)}</span>`).join('')}</div>
  <div class="lbl">Visual</div><div>${esc(sc.visual)}</div>
  <div class="lbl">Fact check</div><table class="claims">${sc.claims.map((c) => `<tr><td>${esc(c.covers)}</td><td><span class="q">“${esc(c.quote)}”</span><br><span class="src">${esc(S.sources[c.source].title)}, ${esc(S.sources[c.source].url)}</span></td></tr>`).join('')}</table></div>`;
}
html += `<h2>Sources</h2><table class="claims">${Object.values(S.sources).map((s) => `<tr><td>${esc(s.title)}</td><td>${esc(s.url)}<br><span class="foot">Text snapshot: evidence/${esc(s.evidence)}, captured ${esc(captured(s.url))}</span></td></tr>`).join('')}</table>
<h2>Notes for reviewers</h2><p>The fund in the video is an illustrative example, not a real product, and is labelled as such on screen. The closing frame states "Illustrative example only. Not investment advice." The video carries no names, handles, watermarks or credits. Music and all sound effects were generated from code for this project; the voice model and fonts are under licences that allow commercial use (see LICENSES).</p>
</body></html>`;
fs.mkdirSync('public/docs', { recursive: true });
fs.writeFileSync('build/script.html', html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.resolve('build/script.html'));
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: 'public/docs/one-building-one-token-script.pdf', format: 'A4', printBackground: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7pt;color:#8d94a6;width:100%;text-align:center;font-family:sans-serif">One building, one token · script · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' } });
await browser.close();

// ---------- Word ----------
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = docx;
const F = 'Montserrat';
const P = (text, o = {}) => new Paragraph({ spacing: { after: o.after == null ? 120 : o.after }, children: [new TextRun({ text, font: F, size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color || '343740' })] });
const cell = (children, w, shade) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children });
const kids = [
  P(`Script document · ${S.meta.task}`, { size: 16, color: '009C9C' }),
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: S.meta.title, font: F, size: 48, bold: true, color: '343740' })] }),
  P(S.meta.subtitle, { size: 22, color: '5E6270', after: 240 }),
  new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: intro.map(([a, b]) => new TableRow({ children: [cell([P(a, { bold: true, after: 0 })], 25), cell([P(b, { after: 0 })], 75)] })) }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun({ text: 'Full voiceover', font: F, bold: true, size: 26 })] }),
  P(S.scenes.map((s) => s.vo.join(' ')).join(' ')),
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun({ text: 'Scene by scene', font: F, bold: true, size: 26 })] }),
];
for (const sc of S.scenes) {
  const [a, b] = span(sc.id);
  kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240 }, children: [new TextRun({ text: `${sc.name}  (${tc(a)} to ${tc(b)})`, font: F, bold: true, size: 23 })] }));
  kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: [cell([P('Voiceover', { bold: true, after: 0 })], 22, 'F2FFF7'), cell([P(sc.vo.join(' '), { after: 0, size: 21 })], 78, 'F2FFF7')] }),
    new TableRow({ children: [cell([P('On screen text', { bold: true, after: 0 })], 22), cell(sc.on_screen.map((o) => P(o, { after: 40 })), 78)] }),
    new TableRow({ children: [cell([P('Visual', { bold: true, after: 0 })], 22), cell([P(sc.visual, { after: 0 })], 78)] }),
    ...sc.claims.map((c) => new TableRow({ children: [cell([P(`Claim: ${c.covers}`, { bold: true, after: 0, size: 18 })], 22),
      cell([P(`“${c.quote}”`, { italics: true, after: 40, size: 18 }), P(`${S.sources[c.source].title}, ${S.sources[c.source].url}`, { size: 16, color: '009C9C', after: 0 })], 78)] })),
  ] }));
}
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun({ text: 'Sources', font: F, bold: true, size: 26 })] }));
for (const s of Object.values(S.sources)) kids.push(P(`${s.title}: ${s.url} (snapshot evidence/${s.evidence}, captured ${captured(s.url)})`, { size: 18 }));
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun({ text: 'Notes for reviewers', font: F, bold: true, size: 26 })] }));
kids.push(P('The fund in the video is an illustrative example, not a real product, and is labelled as such on screen. The closing frame states "Illustrative example only. Not investment advice." The video carries no names, handles, watermarks or credits. Music and all sound effects were generated from code for this project; the voice model and fonts are under licences that allow commercial use (see LICENSES).'));
const doc = new Document({ creator: 'Redbelly DAO Task Board submission', title: S.meta.title, styles: { default: { document: { run: { font: F } } } }, sections: [{ children: kids }] });
fs.writeFileSync('public/docs/one-building-one-token-script.docx', await Packer.toBuffer(doc));
console.log('docs written');
