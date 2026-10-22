// Captures the visible text of every source page into evidence/, with a manifest (URL, UTC time, SHA-256).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const urls = JSON.parse(fs.readFileSync('content/source_urls.json', 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
const manifest = [];
for (const url of urls) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n{3,}/g, '\n\n');
    const slug = url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    fs.writeFileSync(`evidence/${slug}.txt`, `URL: ${url}\n\n${text}`);
    manifest.push({ url, file: `${slug}.txt`, captured_utc: new Date().toISOString(), sha256: crypto.createHash('sha256').update(text).digest('hex') });
    console.log('ok', url, text.length);
  } catch (e) { console.log('FAIL', url, e.message); }
}
fs.writeFileSync('evidence/manifest.json', JSON.stringify(manifest, null, 1));
await browser.close();
