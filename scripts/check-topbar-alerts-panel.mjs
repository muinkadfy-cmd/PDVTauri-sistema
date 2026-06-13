#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[topbar-alerts-panel-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const panel = read('src/components/layout/TopbarAlertsPanel.tsx');
for (const token of [
  'Central de alertas',
  'Notificações do sistema',
  'Mensagens e suporte',
  'getBackupAlertState',
  'getMonthlyLicenseStatusSync',
  'onBackupAlertChange',
]) {
  if (!panel.includes(token)) {
    console.error(`[topbar-alerts-panel-check] Painel sem token: ${token}`);
    ok = false;
  }
}

const topbar = read('src/components/layout/Topbar.tsx');
for (const token of [
  'TopbarAlertsPanel',
  'alertsPanelMode',
  'toggleTopbarPanel',
  'mode="alerts"',
  'mode="notifications"',
  'mode="messages"',
]) {
  if (!topbar.includes(token)) {
    console.error(`[topbar-alerts-panel-check] Topbar sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/components/layout/TopbarAlertsPanel.css');
for (const token of [
  '.topbar-alerts-panel',
  '.topbar-alert-card--danger',
  '.topbar-alert-card--warn',
  '@media (max-width: 900px)',
]) {
  if (!css.includes(token)) {
    console.error(`[topbar-alerts-panel-check] CSS sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[topbar-alerts-panel-check] OK: central leve de alertas/notificações/mensagens instalada.');
