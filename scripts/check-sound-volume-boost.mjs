#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[sound-volume-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const sound = read('src/lib/sound-effects.ts');
for (const token of [
  "reforcado",
  "Reforçado",
  "reforcadoStepsFor",
  "volumeCurve",
  "0.19 * preferenceVolume",
  "0.105 * preferenceVolume",
]) {
  if (!sound.includes(token)) {
    console.error(`[sound-volume-check] sound-effects.ts sem token: ${token}`);
    ok = false;
  }
}

const config = read('src/pages/ConfiguracoesPage.tsx');
for (const token of [
  "Toca sons reforçados",
  "sound-volume-boost",
  "Testar som forte",
  "playAppSound('notification')",
]) {
  if (!config.includes(token)) {
    console.error(`[sound-volume-check] ConfiguracoesPage.tsx sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/pages/ConfiguracoesPage.css');
for (const token of [
  ".sound-volume-boost",
  "grid-template-columns: 1fr 54px auto",
]) {
  if (!css.includes(token)) {
    console.error(`[sound-volume-check] ConfiguracoesPage.css sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[sound-volume-check] OK: volume do som reforçado e preferência atualizada.');
