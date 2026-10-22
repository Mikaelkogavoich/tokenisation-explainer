// Renders stills at given times: node tools/stills.mjs out_dir t1 t2 ...
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const [out, ...times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await p.goto('file://' + path.resolve('animation/index.html'));
await p.evaluate(() => window.ready);
for (const t of times) {
  await p.evaluate((t) => window.renderAt(t), Number(t));
  await p.screenshot({ path: `${out}/t${String(t).padStart(5, '0')}.png` });
}
await b.close();
