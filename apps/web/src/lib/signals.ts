/**
 * FairDrop Passive Signals Library (< 2 KB gzipped, zero external dependencies)
 * Passively observes interaction entropy, browser hardware, and headless indicators
 * without storing or transmitting personal data.
 */

export interface ClientSignals {
  deviceFp: string;
  behaviorScore: number; // 0.0 (bot likelihood) to 1.0 (organic human)
  features: {
    mouseEntropy: number;
    scrollCount: number;
    keyCadenceVariance: number;
    dwellTimeMs: number;
    interactionType: 'mouse' | 'touch' | 'keyboard' | 'none';
    isHeadless: boolean;
    headlessReasons: string[];
    hardwareConcurrency: number;
    timezone: string;
    language: string;
    canvasHash: string;
  };
}

let isInitialized = false;
const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
const mouseMoves: { x: number; y: number; t: number }[] = [];
const keyIntervals: number[] = [];
let lastKeyTime = 0;
let scrollCount = 0;
let interactionType: 'mouse' | 'touch' | 'keyboard' | 'none' = 'none';

export function initSignalListeners(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  try {
    window.addEventListener(
      'mousemove',
      (e) => {
        interactionType = interactionType === 'touch' ? 'touch' : 'mouse';
        if (mouseMoves.length < 40) {
          mouseMoves.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchstart',
      () => {
        interactionType = 'touch';
      },
      { passive: true }
    );

    window.addEventListener(
      'scroll',
      () => {
        scrollCount++;
      },
      { passive: true }
    );

    window.addEventListener(
      'keydown',
      () => {
        if (interactionType === 'none') interactionType = 'keyboard';
        const now = performance.now();
        if (lastKeyTime > 0) {
          const delta = now - lastKeyTime;
          if (delta < 2000 && keyIntervals.length < 25) {
            keyIntervals.push(delta);
          }
        }
        lastKeyTime = now;
      },
      { passive: true }
    );
  } catch {}
}

if (typeof window !== 'undefined') {
  initSignalListeners();
}

function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getCanvasFingerprint(): string {
  if (typeof document === 'undefined') return 'server-canvas';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-2d-context';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', sans-serif";
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(0, 0, 160, 40);
    ctx.fillStyle = '#070c1e';
    ctx.fillText('FairDrop🛡️500', 8, 8);
    ctx.strokeStyle = '#22c55e';
    ctx.arc(130, 20, 12, 0, Math.PI * 2);
    ctx.stroke();

    return fnv1a(canvas.toDataURL());
  } catch {
    return 'canvas-blocked';
  }
}

function detectHeadless(): { isHeadless: boolean; reasons: string[] } {
  if (typeof window === 'undefined') return { isHeadless: false, reasons: [] };

  const reasons: string[] = [];
  const nav = navigator as any;

  if (nav.webdriver === true) {
    reasons.push('navigator.webdriver is true');
  }
  if (/HeadlessChrome|PhantomJS|Electron/i.test(nav.userAgent)) {
    reasons.push('Headless token in userAgent');
  }
  if ((window as any).chrome && (!nav.plugins || nav.plugins.length === 0)) {
    reasons.push('Chrome environment with zero plugins');
  }
  if (!nav.languages || nav.languages.length === 0) {
    reasons.push('Missing navigator.languages');
  }
  if (window.outerWidth === 0 && window.outerHeight === 0) {
    reasons.push('Zero outer dimensions');
  }

  return {
    isHeadless: reasons.length > 0,
    reasons
  };
}

function calculateMouseEntropy(): number {
  if (mouseMoves.length < 3) return 0.5;

  let angleVariance = 0;
  let prevAngle = 0;

  for (let i = 1; i < mouseMoves.length; i++) {
    const dx = mouseMoves[i].x - mouseMoves[i - 1].x;
    const dy = mouseMoves[i].y - mouseMoves[i - 1].y;
    const angle = Math.atan2(dy, dx);
    if (i > 1) {
      angleVariance += Math.abs(angle - prevAngle);
    }
    prevAngle = angle;
  }

  const normalized = Math.min(1, angleVariance / (mouseMoves.length * 1.5));
  return Number(normalized.toFixed(3));
}

function calculateCadenceVariance(): number {
  if (keyIntervals.length < 3) return 0.5;

  const mean = keyIntervals.reduce((a, b) => a + b, 0) / keyIntervals.length;
  const variance =
    keyIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    keyIntervals.length;
  const stdDev = Math.sqrt(variance);

  const score = Math.min(1, stdDev / 100);
  return Number(score.toFixed(3));
}

export async function collectSignals(): Promise<ClientSignals> {
  const dwellTimeMs = Math.round(
    typeof performance !== 'undefined'
      ? performance.now() - startTime
      : 1200
  );

  const headlessCheck = detectHeadless();
  const mouseEntropy = calculateMouseEntropy();
  const cadenceVariance = calculateCadenceVariance();
  const canvasHash = getCanvasFingerprint();

  const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const lang = nav.language || 'en';
  const concurrency = nav.hardwareConcurrency || 4;

  const rawFingerprint = [
    canvasHash,
    concurrency,
    nav.deviceMemory || 8,
    screen.colorDepth || 24,
    screen.width,
    screen.height,
    tz,
    lang
  ].join('|');

  const deviceFp = `fp_${fnv1a(rawFingerprint)}_${fnv1a(nav.userAgent || 'ua')}`;

  let score = 0.5;
  if (headlessCheck.isHeadless) {
    score -= 0.45;
  } else {
    score += 0.15;
  }

  if (dwellTimeMs > 800) score += 0.1;
  if (dwellTimeMs > 2500) score += 0.05;
  if (mouseEntropy > 0.35) score += 0.15;
  if (cadenceVariance > 0.25) score += 0.1;
  if (scrollCount > 0) score += 0.05;

  const finalScore = Number(Math.max(0.01, Math.min(0.99, score)).toFixed(2));

  return {
    deviceFp,
    behaviorScore: finalScore,
    features: {
      mouseEntropy,
      scrollCount,
      keyCadenceVariance: cadenceVariance,
      dwellTimeMs,
      interactionType,
      isHeadless: headlessCheck.isHeadless,
      headlessReasons: headlessCheck.reasons,
      hardwareConcurrency: concurrency,
      timezone: tz,
      language: lang,
      canvasHash
    }
  };
}
