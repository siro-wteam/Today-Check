#!/usr/bin/env node
/**
 * Export splash-screen.svg to high-resolution splash-screen.png (3x for sharp display).
 * Run: node scripts/export-splash-png.js
 * Requires: npm install -D sharp
 */

const path = require('path');
const fs = require('fs');

const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets', 'images');
const SVG_PATH = path.join(ASSETS, 'splash-screen.svg');
const PNG_PATH = path.join(ASSETS, 'splash-screen.png');

const SCALE = 3; // 3x for @3x devices (414*3 = 1242, 896*3 = 2688)
const DENSITY = 72 * SCALE;

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error('Missing:', SVG_PATH);
    process.exit(1);
  }

  await sharp(SVG_PATH, { density: DENSITY })
    .png()
    .toFile(PNG_PATH);

  const stat = fs.statSync(PNG_PATH);
  console.log('Exported:', PNG_PATH);
  console.log('Size:', (stat.size / 1024).toFixed(1), 'KB');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
