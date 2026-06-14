import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/pages/LoginPage.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const bootBlock = login.slice(login.indexOf('async function runLoginBootProgress'), login.indexOf('function EyeIcon'));
const renderBlock = login.slice(login.indexOf('{LOGIN_BOOT_LINES.map'), login.indexOf('</div>\n              </div>\n            ) : null}', login.indexOf('{LOGIN_BOOT_LINES.map')));

const checks = [
  [
    'Login P7 mantém duração mínima real de 3 segundos',
    login.includes('LOGIN_BOOT_DURATION_MS = 3000') &&
      login.includes('LOGIN_BOOT_MIN_VISIBLE_MS = 3000') &&
      bootBlock.includes('elapsed >= LOGIN_BOOT_MIN_VISIBLE_MS') &&
      bootBlock.includes('const remaining = Math.max(0, LOGIN_BOOT_MIN_VISIBLE_MS - elapsed)'),
  ],
  [
    'Login P7 usa tick suave igual fechamento/backup',
    login.includes('LOGIN_BOOT_TICK_MS = 80') &&
      login.includes('LOGIN_BOOT_COMMAND_MS = 550') &&
      bootBlock.includes('window.setInterval(tick, LOGIN_BOOT_TICK_MS)') &&
      bootBlock.includes('Math.round((elapsed / LOGIN_BOOT_MIN_VISIBLE_MS) * 96)'),
  ],
  [
    'Login P7 não usa mais pulos fixos por etapas',
    !bootBlock.includes('const steps = [') &&
      !bootBlock.includes('waitMs: 700') &&
      !bootBlock.includes('setProgress(step.progress)'),
  ],
  [
    'Login P7 anima linhas tipo terminal com comando ativo',
    login.includes('const [bootCommandIndex, setBootCommandIndex] = useState(0)') &&
      login.includes('setCommandIndex(nextCommandIndex)') &&
      renderBlock.includes('index === bootCommandIndex') &&
      renderBlock.includes("isActive ? '...'"),
  ],
  [
    'Login P7 reseta progresso e comando ao iniciar/finalizar login',
    login.includes('setBootProgress(0);\n    setBootCommandIndex(0);\n    setLoading(true);') &&
      login.includes('setBootProgress(0);\n      setBootCommandIndex(0);\n      setLoading(false);'),
  ],
  [
    'Login P7 mantém navegação só depois do loading',
    login.includes('await runLoginBootProgress(setBootProgress, setBootCommandIndex);') &&
      login.indexOf('await runLoginBootProgress(setBootProgress, setBootCommandIndex);') < login.indexOf("navigate(from || '/painel'"),
  ],
  [
    'CSS P7 suaviza barra como backup',
    css.includes('transition: width 260ms ease') &&
      css.includes('login-boot-shimmer') &&
      css.includes('animation: login-boot-shimmer') &&
      css.includes('text-shadow: 0 0 10px rgba(34, 197, 94, 0.22)'),
  ],
  [
    'Script P7 registrado no package.json',
    pkg.scripts?.['check:login-loading-suave-p7'] === 'node scripts/check-login-loading-suave-p7.mjs',
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}
if (failed.length) {
  console.error(`\n[check:login-loading-suave-p7] Falhou em ${failed.length} verificacao(oes).`);
  process.exit(1);
}
console.log(`\n[check:login-loading-suave-p7] OK: ${checks.length}/${checks.length}`);
