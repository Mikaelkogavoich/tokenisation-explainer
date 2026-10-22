// Collects the text drawn on screen across each scene, so check.py can confirm every on screen line in the script appears in the video.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + path.resolve('animation/index.html') + '?subs=0'); await p.evaluate(() => window.ready);
const out = await p.evaluate(() => {
  const res = {}; const sc = window.DATA.timeline.scenes;
  sc.forEach((s, i) => {
    const end = sc[i + 1] ? sc[i + 1].start - 0.55 : window.DURATION;
    const seen = new Set();
    for (let t = s.start - 0.3; t <= end; t += 0.25) { window.renderAt(t); document.querySelectorAll('#stage text').forEach((n) => { if (Number(getComputedStyle(n).opacity) > 0) seen.add(n.textContent); }); }
    res[s.id] = [...seen].join(' | ');
  });
  return res;
});
console.log(JSON.stringify(out)); await b.close();
