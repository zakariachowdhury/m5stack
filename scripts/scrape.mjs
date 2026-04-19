#!/usr/bin/env node
// Scrape product data + images for the devices, caps, and units listed below.
// Writes data/products.json and images/<category>/<handle>/<n>.webp.
// Run: node scripts/scrape.mjs

import { writeFile, mkdir, access, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOP = 'https://shop.m5stack.com';
const MAX_IMAGES = 4;
const DELAY_MS = 500;

// { id, handle, category, compatibleDevices? }
// compatibleDevices is only set for parts that can't work with every device.
const PRODUCTS = [
  { id: 'm5sticks3', handle: 'm5sticks3-esp32s3-mini-iot-dev-kit', category: 'devices' },
  { id: 'cardputer-adv', handle: 'm5stack-cardputer-adv-version-esp32-s3', category: 'devices' },

  { id: 'cap-lora', handle: 'cap-lora-1262-for-cardputer-adv-sx1262-atgm336h', category: 'caps', compatibleDevices: ['cardputer-adv'] },

  { id: 'unit-nfc', handle: 'nfc-universal-unit-st25r3916', category: 'units' },
  { id: 'unit-relay-2ch', handle: '2-channel-spst-relay-unit', category: 'units' },
  { id: 'unit-servo-sg90', handle: 'sg90-servo', category: 'units' },
  { id: 'unit-env-iii', handle: 'env-iii-unit-with-temperature-humidity-air-pressure-sensor-sht30-qmp6988', category: 'units' },
  { id: 'unit-pir', handle: 'pir-module', category: 'units' },
  { id: 'unit-angle', handle: 'angle-unit', category: 'units' },
  { id: 'unit-ultrasonic', handle: 'ultrasonic-distance-unit-i2c-rcwl-9620', category: 'units' },
  { id: 'unit-io-hub', handle: 'i-o-hub-1-to-6-expansion-unit-stm32f0', category: 'units' },
  { id: 'unit-light', handle: 'light-sensor-unit', category: 'units' },
  { id: 'unit-mini-proto', handle: 'mini-proto-board-unit', category: 'units' },
  { id: 'unit-rgb-strip', handle: 'digital-rgb-led-weatherproof-strip-sk6812', category: 'units' },
  { id: 'unit-joystick-2', handle: 'i2c-joystick-2-unit-stm32g030', category: 'units' },
  { id: 'unit-mini-hub', handle: 'mini-hub-module', category: 'units' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripTags(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBullets(html) {
  const bullets = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text && text.length < 220) bullets.push(text);
  }
  return bullets.slice(0, 8);
}

function firstSentences(text, n = 2) {
  const cleaned = text.replace(/^\s*Description\s+/i, '').trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(' ').slice(0, 260);
}

function shopifyImageUrl(raw, size = '1200x') {
  // Raw is often "//shop.m5stack.com/cdn/shop/files/xxx.webp?v=123" or ".jpg"
  const url = raw.startsWith('//') ? 'https:' + raw : raw;
  // Insert size before extension: foo.webp -> foo_1200x.webp
  return url.replace(/(\.(?:webp|png|jpg|jpeg))(\?.*)?$/i, `_${size}$1$2`);
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url, dest) {
  if (await fileExists(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

async function fetchProduct(handle) {
  const url = `${SHOP}/products/${handle}.js`;
  const res = await fetch(url, { headers: { 'user-agent': 'm5stack-site-scraper/1.0' } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

async function scrape() {
  const out = { devices: [], caps: [], units: [] };

  for (const { id, handle, category, compatibleDevices } of PRODUCTS) {
    console.log(`-> ${id} (${handle})`);
    const raw = await fetchProduct(handle);

    const descHtml = raw.description || '';
    const descText = stripTags(descHtml);
    const features = extractBullets(descHtml);
    const shortDescription = firstSentences(descText, 2);

    const imageDir = join(ROOT, 'images', category, id);
    await ensureDir(imageDir);

    const images = [];
    const rawImages = (raw.images || []).slice(0, MAX_IMAGES);
    for (let i = 0; i < rawImages.length; i++) {
      const remote = shopifyImageUrl(rawImages[i]);
      // Preserve extension from URL (some are .png)
      const extMatch = remote.match(/\.(webp|png|jpg|jpeg)(\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'webp';
      const localName = `${i + 1}.${ext}`;
      const localPath = join(imageDir, localName);
      const relPath = `images/${category}/${id}/${localName}`;
      try {
        await downloadImage(remote, localPath);
        images.push(relPath);
      } catch (err) {
        console.warn(`   ! image ${i + 1} failed: ${err.message}`);
      }
    }

    const record = {
      id,
      handle,
      title: raw.title,
      category,
      price: raw.price ? (raw.price / 100).toFixed(2) : null,
      currency: 'USD',
      vendor: raw.vendor,
      productType: raw.type || raw.product_type || null,
      tags: raw.tags || [],
      shortDescription,
      features,
      description: descText,
      image: images[0] || null,
      images,
      url: `${SHOP}/products/${handle}`,
      ...(compatibleDevices ? { compatibleDevices } : {}),
    };

    out[category].push(record);
    await sleep(DELAY_MS);
  }

  const dataDir = join(ROOT, 'data');
  await ensureDir(dataDir);
  out.generatedAt = new Date().toISOString();
  await writeFile(join(dataDir, 'products.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote data/products.json (${out.devices.length} devices, ${out.caps.length} caps, ${out.units.length} units)`);
}

scrape().catch((err) => {
  console.error(err);
  process.exit(1);
});
