import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImagePlan, resolveImagePlan } from '../lib/image-resolver.cjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BRIEF_DIR = join(ROOT, 'content-plans', 'brief-plans');
const FINDINGS_DIR = join(ROOT, 'content-plans', 'research');
const BRAND_MAP_PATH = join(ROOT, 'config', 'brand-assets.json');
const OUTPUT_DIR = join(ROOT, 'content-plans', 'image-candidates');

function parseArgs() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--mp-id=')) {
      return arg.slice(8);
    }
  }
  return null;
}

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

function main() {
  const mpId = parseArgs();
  if (!mpId) {
    console.error('Usage: node resolve-images.mjs --mp-id=<mpId>');
    process.exit(1);
  }

  const briefPath = join(BRIEF_DIR, `${mpId}-brief.json`);
  const findingsPath = join(FINDINGS_DIR, `${mpId}-findings.json`);

  const brief = loadJson(briefPath);
  if (!brief) {
    console.error(`Brief not found: ${briefPath}`);
    process.exit(1);
  }

  const findings = loadJson(findingsPath);
  if (!findings) {
    console.error(`Findings not found: ${findingsPath}`);
    process.exit(1);
  }

  let brandMap = {};
  try {
    brandMap = JSON.parse(readFileSync(BRAND_MAP_PATH, 'utf8'));
  } catch {
    console.warn('Brand map not found, continuing without brand-map resolution');
  }

  const template = brief.template || findings.template || '';
  const imagePlan = brief.imagePlan || buildImagePlan(template, brief.topic || '', brief);
  const resolved = resolveImagePlan(imagePlan, findings, brandMap);

  resolved.mpId = mpId;
  resolved.template = template;
  resolved.createdAt = new Date().toISOString();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, `${mpId}-images.json`);
  writeFileSync(outPath, JSON.stringify(resolved, null, 2), 'utf8');

  console.log(`Image candidates written: ${outPath}`);
  console.log(`  template: ${template}`);
  console.log(`  intro: ${resolved.intro ? resolved.intro.primary?.url || 'pending' : 'none'}`);
  console.log(`  slides: ${resolved.slides?.length || 0}`);
  console.log(`  logos: ${resolved.introLogoSlots?.length || 0}`);
}

main();
