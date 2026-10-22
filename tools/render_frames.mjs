// Renders every frame at its exact time and encodes near-lossless segments.
// usage: node tools/render_frames.mjs <subs 1|0> <out.mp4> [workers]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [subs = '1', out = 'build/video.mp4', workers = '4'] = process.argv.slice(2);
const script = JSON.parse(fs.readFileSync('content/script.json', 'utf8'));
const FPS = script.video.fps;
const url = 'file://' + path.resolve('animation/index.html') + `?subs=${subs}`;
const browser = await chromium.launch();
const probe = await browser.newPage();
await probe.goto(url); await probe.evaluate(() => window.ready);
const DUR = await probe.evaluate(() => window.DURATION);
// sound cues come from the same key moments the animation uses
fs.writeFileSync('build/sfx_cues.json', JSON.stringify(await probe.evaluate(() => window.sfxCues()), null, 1));
await probe.close();
const total = Math.round(DUR * FPS), N = Number(workers), per = Math.ceil(total / N);
fs.mkdirSync('build/seg', { recursive: true });
async function work(w) {
  const a = w * per, b = Math.min(total, a + per);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url); await page.evaluate(() => window.ready);
  const seg = `build/seg/${path.basename(out, '.mp4')}-${w}.mp4`;
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv444p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (w === 0 && f % 300 === 0) console.log(`frame ${f}/${b}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  return seg;
}
const segs = await Promise.all([...Array(N).keys()].map(work));
await browser.close();
fs.writeFileSync('build/seg/list.txt', segs.map((s) => `file '${path.resolve(s)}'`).join('\n'));
await new Promise((r) => spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'build/seg/list.txt', '-c', 'copy', out], { stdio: 'inherit' }).on('close', r));
console.log(`done ${out}: ${total} frames at ${FPS} fps`);
