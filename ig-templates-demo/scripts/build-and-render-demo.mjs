import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { getRequiredImageFields, validateRemoteImage } from '../lib/render-image-validation.cjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const mpIdArg = process.argv.find(arg => arg.startsWith('--mp-id='));
if (!mpIdArg) {
  console.error('Error: --mp-id argument is required. Usage: node build-and-render.mjs --mp-id=mp-YYYYMMDD-slug');
  process.exit(1);
}
const mpId = mpIdArg.split('=')[1];

const planPath = join(ROOT, 'content-plans', 'slides', `${mpId}-plan.json`);
let plan;
try {
  const planRaw = readFileSync(planPath, 'utf8');
  plan = JSON.parse(planRaw);
} catch (err) {
  console.error(`Error reading slide plan at ${planPath}:`, err.message);
  process.exit(1);
}

const isiCount = plan.slides.filter(s => s.type === 'isi').length;
const accountHandle = String(plan.account_watermark || '').trim();
const CONSTANTS = {
  ACCOUNT_WATERMARK: accountHandle,
  FOLLOW_CTA: accountHandle ? `Follow ${accountHandle} for more.` : 'Follow my account',
  TOTAL: String(isiCount).padStart(2, '0'),
  CTA_CMD: 'save this. test later.',
};

const INJECTED_CONSTANT_KEYS = new Set(['AVATAR_URL', 'HANDLE', 'ACCOUNT_WATERMARK', 'FOLLOW_CTA', 'TOTAL']);

const pngPaths = [];
const renderLogs = [];
let successfulSlides = 0;
let failedSlides = 0;

const browserWSEndpoint = process.env.CHROMIUM_WS_ENDPOINT;
const browser = browserWSEndpoint
  ? await puppeteer.connect({ browserWSEndpoint })
  : await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

const outDir = join(ROOT, 'Demo render', mpId) + '/';
mkdirSync(outDir, { recursive: true });

for (const slide of plan.slides) {
  try {
    const slideTemplate = slide.template || plan.template;
    const templateFile = join(ROOT, 'templates', `${slideTemplate}-${slide.type}.html`);

    const sanitizedSlideData = Object.fromEntries(
      Object.entries(slide.data || {}).filter(([key]) => !INJECTED_CONSTANT_KEYS.has(key)),
    );
    const merged = { ...CONSTANTS, ...sanitizedSlideData };

    const imageFailures = [];
    for (const field of getRequiredImageFields(slideTemplate, slide)) {
      const url = merged[field] || '';
      if (!url) {
        imageFailures.push({ field, reason: 'required image URL is empty' });
        continue;
      }

      const validation = await validateRemoteImage(url);
      if (!validation.valid) {
        imageFailures.push({ field, reason: validation.reason, url });
      }
    }

    if (imageFailures.length > 0) {
      throw new Error(`image validation failed: ${imageFailures.map(f => `${f.field} -> ${f.reason}`).join('; ')}`);
    }

    let html = readFileSync(templateFile, 'utf8');

    for (const [key, val] of Object.entries(merged)) {
      html = html.replaceAll('{{' + key + '}}', String(val ?? ''));
    }

    html = html.replace(/\{\{[A-Z0-9_]+\}\}/g, '');

    const tmpPath = outDir + '_tmp_' + slide.id + '.html';
    writeFileSync(tmpPath, html, 'utf8');

    const fileUrl = 'file:///' + tmpPath.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 300));

    const pngOut = outDir + slide.id + '.png';
    await page.screenshot({
      type: 'png',
      path: pngOut,
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
    });

    unlinkSync(tmpPath);

    pngPaths.push(pngOut);
    successfulSlides++;
    renderLogs.push({ slideId: slide.id, status: 'success' });
    console.log(`[OK] Rendered slide ${slide.id} -> ${pngOut}`);
  } catch (err) {
    failedSlides++;
    renderLogs.push({ slideId: slide.id, status: 'failed', error: err.message });
    console.error(`[FAIL] Slide ${slide.id}:`, err.message);
  }
}

await browser.close();

const renderLog = {
  mpId,
  template: plan.template,
  totalSlides: plan.slides.length,
  successfulSlides,
  failedSlides,
  pngPaths,
  renderLogs,
  createdAt: new Date().toISOString(),
};

writeFileSync(outDir + 'render-log.json', JSON.stringify(renderLog, null, 2), 'utf8');
console.log(`\nRender complete. Log written to ${outDir}render-log.json`);
console.log(`Success: ${successfulSlides}, Failed: ${failedSlides}`);

process.exit(failedSlides > 0 ? 1 : 0);
