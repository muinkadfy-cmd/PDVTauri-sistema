import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`[FAIL] ${message}`);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};

const smartAdmin = String(scripts["smart:admin"] || "");
const smartRelease = String(scripts["smart:release"] || "");
const smartReleaseTest = String(scripts["smart:release:test"] || "");
const smartReleasePublish = String(scripts["smart:release:publish"] || "");
const prebuild = String(scripts["prebuild"] || "");
const checkP10N = String(scripts["check:p10n-automation"] || "");

if (smartAdmin.includes("smart-admin-p10n.ps1")) ok("script npm smart:admin registrado");
else fail("package.json precisa registrar smart:admin");

if (
  smartRelease.includes("smart-release-p10n.ps1") ||
  smartRelease.includes("smart-release-p10p.ps1")
) ok("package.json registra smart:release");
else fail("package.json precisa registrar smart:release");

if (checkP10N.includes("check-p10n-automation.mjs")) ok("script npm check:p10n-automation registrado");
else fail("package.json precisa registrar check:p10n-automation");

if (prebuild.includes("fix-public-version-exact-p10m.mjs")) ok("prebuild corrige version.json sem timestamp");
else fail("prebuild precisa chamar fix-public-version-exact-p10m.mjs");

for (const file of [
  "scripts/smart-admin-p10n.ps1",
  "scripts/smart-release-p10n.ps1",
  "scripts/smart-release-p10p.ps1",
  "scripts/license-admin-p10l.ps1",
  "scripts/p10n-sync-version.mjs",
  "scripts/fix-public-version-exact-p10m.mjs"
]) {
  if (exists(file)) ok(`${file} existe`);
  else fail(`${file} ausente`);
}

const envFiles = [
  ".env.production.local",
  ".env.local",
  ".env"
].filter(exists);

const envText = envFiles.map(read).join("\n");
const sourceText = exists("src/config/env.ts") ? read("src/config/env.ts") : "";

if (
  envText.includes("VITE_SMARTTECH_LICENSE_API_URL") ||
  envText.includes("VITE_LICENSE_WORKER_URL") ||
  envText.includes("VITE_HYBRID_LICENSE_WORKER_URL") ||
  sourceText.includes("VITE_SMARTTECH_LICENSE_API_URL") ||
  sourceText.includes("VITE_LICENSE_WORKER_URL") ||
  sourceText.includes("VITE_HYBRID_LICENSE_WORKER_URL")
) ok("app le URL do Worker de licenca");
else fail("app precisa ler variavel VITE_* da URL do Worker de licenca");

if (
  envText.includes("VITE_LICENSE_API_URL") ||
  envText.includes("VITE_SMARTTECH_LICENSE_API_URL") ||
  envText.includes("VITE_HYBRID_LICENSE_API_URL")
) ok("ambiente de build tem aliases da URL da licenca");
else fail("ambiente de build precisa ter aliases da URL da licenca");

if (
  smartReleaseTest.includes("smart-release-p10p.ps1") &&
  smartReleaseTest.includes("-AllowUnsigned")
) ok("smart:release:test usa fluxo P10P com AllowUnsigned");
else fail("smart:release:test precisa usar smart-release-p10p.ps1 -AllowUnsigned");

if (
  smartReleasePublish.includes("smart-release-p10p.ps1") &&
  smartReleasePublish.includes("-Publish")
) ok("smart:release:publish usa fluxo P10P com Publish");
else fail("smart:release:publish precisa usar smart-release-p10p.ps1 -Publish");

if (failures.length > 0) {
  console.log("");
  console.error(`[check:p10n-automation] FALHOU: ${failures.length} item(ns).`);
  process.exit(1);
}

console.log("");
console.log("[check:p10n-automation] OK: automacao P10N/P10P pronta.");
