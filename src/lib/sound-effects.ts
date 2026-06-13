import { APP_EVENTS, emitAppEvent } from '@/lib/app-events';

export const SOUND_EFFECTS_KEY = 'smart-tech-sound-effects-enabled';
export const SOUND_VOLUME_KEY = 'smart-tech-sound-effects-volume';
export const SOUND_PRESET_KEY = 'smart-tech-sound-effects-preset';

export type AppSoundKind =
  | 'startup'
  | 'action'
  | 'navigation'
  | 'notification'
  | 'success'
  | 'warning'
  | 'error';

export type AppSoundPreset = 'suave' | 'classico' | 'digital' | 'sino' | 'reforcado';

export const SOUND_PRESET_OPTIONS: Array<{ value: AppSoundPreset; label: string }> = [
  { value: 'suave', label: 'Suave' },
  { value: 'classico', label: 'Clássico' },
  { value: 'digital', label: 'Digital' },
  { value: 'sino', label: 'Sino' },
  { value: 'reforcado', label: 'Reforçado' },
];

type SoundStep = {
  frequency: number;
  start: number;
  duration: number;
  type?: OscillatorType;
};

let audioContext: AudioContext | null = null;
let installed = false;
let pendingStartup = false;
let startupPlayed = false;
let lastActionAt = 0;
let lastNotificationAt = 0;

function clampVolume(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 75;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function isSoundPreset(value: unknown): value is AppSoundPreset {
  return value === 'suave' || value === 'classico' || value === 'digital' || value === 'sino' || value === 'reforcado';
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;

  try {
    if (!audioContext) audioContext = new AudioContextCtor();
    return audioContext;
  } catch {
    return null;
  }
}

export function getSoundEffectsEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(SOUND_EFFECTS_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function getSoundVolume(): number {
  try {
    if (typeof localStorage === 'undefined') return 75;
    return clampVolume(localStorage.getItem(SOUND_VOLUME_KEY) ?? 75);
  } catch {
    return 75;
  }
}

export function getSoundPreset(): AppSoundPreset {
  try {
    if (typeof localStorage === 'undefined') return 'suave';
    const stored = localStorage.getItem(SOUND_PRESET_KEY);
    return isSoundPreset(stored) ? stored : 'suave';
  } catch {
    return 'suave';
  }
}

function emitSoundPreferencesChanged(): void {
  emitAppEvent(APP_EVENTS.UI_SOUNDS_CHANGED, {
    enabled: getSoundEffectsEnabled(),
    volume: getSoundVolume(),
    preset: getSoundPreset(),
  });
}

export function setSoundEffectsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_EFFECTS_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
  emitSoundPreferencesChanged();
}

export function setSoundVolume(volume: number): void {
  try {
    localStorage.setItem(SOUND_VOLUME_KEY, String(clampVolume(volume)));
  } catch {
    // ignore
  }
  emitSoundPreferencesChanged();
}

export function setSoundPreset(preset: AppSoundPreset): void {
  try {
    localStorage.setItem(SOUND_PRESET_KEY, isSoundPreset(preset) ? preset : 'suave');
  } catch {
    // ignore
  }
  emitSoundPreferencesChanged();
}

function classicoStepsFor(kind: AppSoundKind): SoundStep[] {
  switch (kind) {
    case 'startup':
      return [
        { frequency: 523.25, start: 0, duration: 0.09, type: 'sine' },
        { frequency: 659.25, start: 0.075, duration: 0.09, type: 'sine' },
        { frequency: 783.99, start: 0.15, duration: 0.12, type: 'sine' },
      ];
    case 'success':
      return [
        { frequency: 660, start: 0, duration: 0.075, type: 'sine' },
        { frequency: 880, start: 0.07, duration: 0.11, type: 'sine' },
      ];
    case 'warning':
      return [
        { frequency: 440, start: 0, duration: 0.08, type: 'triangle' },
        { frequency: 392, start: 0.075, duration: 0.1, type: 'triangle' },
      ];
    case 'error':
      return [
        { frequency: 320, start: 0, duration: 0.09, type: 'triangle' },
        { frequency: 250, start: 0.08, duration: 0.12, type: 'triangle' },
      ];
    case 'notification':
      return [
        { frequency: 784, start: 0, duration: 0.08, type: 'sine' },
        { frequency: 987.77, start: 0.075, duration: 0.13, type: 'sine' },
      ];
    case 'navigation':
      return [{ frequency: 620, start: 0, duration: 0.07, type: 'sine' }];
    case 'action':
    default:
      return [{ frequency: 720, start: 0, duration: 0.055, type: 'sine' }];
  }
}

function suaveStepsFor(kind: AppSoundKind): SoundStep[] {
  switch (kind) {
    case 'startup':
      return [
        { frequency: 392, start: 0, duration: 0.1, type: 'sine' },
        { frequency: 523.25, start: 0.08, duration: 0.11, type: 'sine' },
        { frequency: 659.25, start: 0.16, duration: 0.12, type: 'sine' },
      ];
    case 'success':
      return [
        { frequency: 523.25, start: 0, duration: 0.08, type: 'sine' },
        { frequency: 659.25, start: 0.075, duration: 0.12, type: 'sine' },
      ];
    case 'warning':
      return [
        { frequency: 392, start: 0, duration: 0.09, type: 'sine' },
        { frequency: 349.23, start: 0.085, duration: 0.11, type: 'sine' },
      ];
    case 'error':
      return [
        { frequency: 293.66, start: 0, duration: 0.1, type: 'triangle' },
        { frequency: 246.94, start: 0.09, duration: 0.13, type: 'triangle' },
      ];
    case 'notification':
      return [
        { frequency: 587.33, start: 0, duration: 0.09, type: 'sine' },
        { frequency: 783.99, start: 0.08, duration: 0.13, type: 'sine' },
      ];
    case 'navigation':
      return [{ frequency: 493.88, start: 0, duration: 0.075, type: 'sine' }];
    case 'action':
    default:
      return [{ frequency: 587.33, start: 0, duration: 0.06, type: 'sine' }];
  }
}

function digitalStepsFor(kind: AppSoundKind): SoundStep[] {
  switch (kind) {
    case 'startup':
      return [
        { frequency: 660, start: 0, duration: 0.055, type: 'square' },
        { frequency: 880, start: 0.06, duration: 0.055, type: 'square' },
        { frequency: 1046.5, start: 0.12, duration: 0.075, type: 'square' },
      ];
    case 'success':
      return [
        { frequency: 880, start: 0, duration: 0.055, type: 'square' },
        { frequency: 1174.66, start: 0.06, duration: 0.08, type: 'square' },
      ];
    case 'warning':
      return [
        { frequency: 622.25, start: 0, duration: 0.06, type: 'square' },
        { frequency: 466.16, start: 0.065, duration: 0.08, type: 'square' },
      ];
    case 'error':
      return [
        { frequency: 392, start: 0, duration: 0.065, type: 'sawtooth' },
        { frequency: 261.63, start: 0.07, duration: 0.095, type: 'sawtooth' },
      ];
    case 'notification':
      return [
        { frequency: 987.77, start: 0, duration: 0.055, type: 'square' },
        { frequency: 1318.51, start: 0.06, duration: 0.08, type: 'square' },
      ];
    case 'navigation':
      return [{ frequency: 784, start: 0, duration: 0.045, type: 'square' }];
    case 'action':
    default:
      return [{ frequency: 1046.5, start: 0, duration: 0.04, type: 'square' }];
  }
}

function sinoStepsFor(kind: AppSoundKind): SoundStep[] {
  switch (kind) {
    case 'startup':
      return [
        { frequency: 523.25, start: 0, duration: 0.14, type: 'sine' },
        { frequency: 1046.5, start: 0.04, duration: 0.18, type: 'sine' },
        { frequency: 1318.51, start: 0.14, duration: 0.2, type: 'sine' },
      ];
    case 'success':
      return [
        { frequency: 659.25, start: 0, duration: 0.12, type: 'sine' },
        { frequency: 1318.51, start: 0.055, duration: 0.16, type: 'sine' },
      ];
    case 'warning':
      return [
        { frequency: 493.88, start: 0, duration: 0.13, type: 'sine' },
        { frequency: 987.77, start: 0.055, duration: 0.14, type: 'sine' },
      ];
    case 'error':
      return [
        { frequency: 349.23, start: 0, duration: 0.14, type: 'triangle' },
        { frequency: 698.46, start: 0.06, duration: 0.16, type: 'triangle' },
      ];
    case 'notification':
      return [
        { frequency: 783.99, start: 0, duration: 0.12, type: 'sine' },
        { frequency: 1567.98, start: 0.055, duration: 0.16, type: 'sine' },
      ];
    case 'navigation':
      return [{ frequency: 1046.5, start: 0, duration: 0.085, type: 'sine' }];
    case 'action':
    default:
      return [{ frequency: 1318.51, start: 0, duration: 0.065, type: 'sine' }];
  }
}


function reforcadoStepsFor(kind: AppSoundKind): SoundStep[] {
  switch (kind) {
    case 'startup':
      return [
        { frequency: 659.25, start: 0, duration: 0.12, type: 'triangle' },
        { frequency: 880, start: 0.075, duration: 0.14, type: 'triangle' },
        { frequency: 1174.66, start: 0.15, duration: 0.18, type: 'triangle' },
      ];
    case 'success':
      return [
        { frequency: 784, start: 0, duration: 0.1, type: 'triangle' },
        { frequency: 1174.66, start: 0.075, duration: 0.14, type: 'triangle' },
      ];
    case 'warning':
      return [
        { frequency: 622.25, start: 0, duration: 0.11, type: 'square' },
        { frequency: 523.25, start: 0.085, duration: 0.13, type: 'square' },
      ];
    case 'error':
      return [
        { frequency: 392, start: 0, duration: 0.12, type: 'sawtooth' },
        { frequency: 293.66, start: 0.09, duration: 0.16, type: 'sawtooth' },
      ];
    case 'notification':
      return [
        { frequency: 987.77, start: 0, duration: 0.11, type: 'triangle' },
        { frequency: 1567.98, start: 0.075, duration: 0.15, type: 'triangle' },
      ];
    case 'navigation':
      return [{ frequency: 880, start: 0, duration: 0.085, type: 'triangle' }];
    case 'action':
    default:
      return [{ frequency: 1046.5, start: 0, duration: 0.075, type: 'triangle' }];
  }
}

function stepsFor(kind: AppSoundKind, preset: AppSoundPreset): SoundStep[] {
  if (preset === 'classico') return classicoStepsFor(kind);
  if (preset === 'digital') return digitalStepsFor(kind);
  if (preset === 'sino') return sinoStepsFor(kind);
  if (preset === 'reforcado') return reforcadoStepsFor(kind);
  return suaveStepsFor(kind);
}

function volumeCurve(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  // Curva levemente mais alta em volumes médios e mais forte no máximo.
  // Mantém 0 como mudo real, mas deixa 70-100% audível em notebook/PC fraco.
  return Math.pow(clamped, 0.72);
}

function volumeFor(kind: AppSoundKind): number {
  const preferenceVolume = volumeCurve(getSoundVolume() / 100);
  if (preferenceVolume <= 0) return 0;

  // P27: ganho interno reforçado. O controle continua 0-100%,
  // mas 100% agora entrega volume perceptível sem depender do Windows no máximo.
  if (kind === 'action' || kind === 'navigation') return 0.105 * preferenceVolume;
  if (kind === 'startup') return 0.16 * preferenceVolume;
  if (kind === 'error') return 0.18 * preferenceVolume;
  return 0.19 * preferenceVolume;
}

function scheduleSound(ctx: AudioContext, kind: AppSoundKind): void {
  const master = ctx.createGain();
  const now = ctx.currentTime;
  const volume = volumeFor(kind);
  if (volume <= 0) return;
  const steps = stepsFor(kind, getSoundPreset());
  const tail = Math.max(...steps.map((step) => step.start + step.duration), 0.1) + 0.08;

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + tail);
  master.connect(ctx.destination);

  for (const step of steps) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + step.start;
    const end = start + step.duration;

    osc.type = step.type || 'sine';
    osc.frequency.setValueAtTime(step.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export function playAppSound(kind: AppSoundKind): void {
  if (!getSoundEffectsEnabled()) return;

  const nowMs = Date.now();
  if ((kind === 'action' || kind === 'navigation') && nowMs - lastActionAt < 90) return;
  if (kind === 'notification' && nowMs - lastNotificationAt < 500) return;
  if (kind === 'startup' && startupPlayed) return;

  if (kind === 'action' || kind === 'navigation') lastActionAt = nowMs;
  if (kind === 'notification') lastNotificationAt = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  const play = () => {
    try {
      if (kind === 'startup') {
        startupPlayed = true;
        pendingStartup = false;
      }
      scheduleSound(ctx, kind);
    } catch {
      // ignore
    }
  };

  if (ctx.state === 'suspended') {
    if (kind === 'startup') pendingStartup = true;
    void ctx.resume()
      .then(() => {
        if (ctx.state === 'running') play();
      })
      .catch(() => {
        if (kind === 'startup') pendingStartup = true;
      });
    return;
  }

  play();
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(
    [
      'button',
      'a[href]',
      '[role="button"]',
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="reset"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'select',
      'summary',
      '[data-sound-action]',
    ].join(',')
  );

  if (!(interactive instanceof HTMLElement)) return false;
  if (interactive.hasAttribute('disabled')) return false;
  if (interactive.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

function unlockPendingStartup(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume()
    .then(() => {
      if (pendingStartup && getSoundEffectsEnabled() && !startupPlayed) {
        window.setTimeout(() => playAppSound('startup'), 140);
      }
    })
    .catch(() => undefined);
}

function handleClick(event: MouseEvent): void {
  unlockPendingStartup();
  if (!isInteractiveTarget(event.target)) return;
  playAppSound('action');
}

function handleNotificationUpdated(event: Event): void {
  const action = (event as CustomEvent<{ action?: string }>).detail?.action;
  if (action && action !== 'created') return;
  playAppSound('notification');
}

export function installGlobalSoundEffects(): void {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('click', handleClick, true);
  document.addEventListener('pointerdown', unlockPendingStartup, { capture: true, passive: true });
  window.addEventListener('notificacoes-updated', handleNotificationUpdated as EventListener);
}
