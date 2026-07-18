// Accent color engine: lets each candidate pick their own theme color, but
// every derived value (hover state, tints, and -- most importantly -- the
// text color placed ON TOP of the accent for buttons/badges) is computed
// from real contrast math, not guessed. That's what actually guarantees
// readability for an arbitrary user-picked color, not just the presets.

export const ACCENT_PRESETS = [
  { name: "Indigo", value: "#818cf8" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Cyan", value: "#22d3ee" },
  { name: "Teal", value: "#2dd4bf" },
  { name: "Green", value: "#4ade80" },
  { name: "Amber", value: "#fbbf24" },
  { name: "Rose", value: "#fb7185" },
  { name: "Violet", value: "#c084fc" },
];

const STORAGE_KEY = "autoapply_accent";
const DEFAULT_ACCENT = "#818cf8";

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// WCAG relative luminance -- https://www.w3.org/WAI/GL/wiki/Relative_luminance
function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Whichever of black/white contrasts better against `hex` -- guarantees
 * readable text regardless of how light or dark the chosen accent is. */
export function getOnColor(hex) {
  const contrastWithWhite = contrastRatio(hex, "#ffffff");
  const contrastWithBlack = contrastRatio(hex, "#000000");
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#0a0a0a";
}

function mix(hex, towardHex, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(towardHex);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

export function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Derives every dependent variable from one base color and writes them as
 * inline custom properties on <html>, which override the theme stylesheet's
 * `var(--primary)` definitions everywhere in the app. */
export function applyAccentColor(hex) {
  if (typeof document === "undefined") return;
  const onColor = getOnColor(hex);
  const hoverTarget = onColor === "#ffffff" ? "#000000" : "#ffffff";
  const root = document.documentElement.style;

  root.setProperty("--primary", hex);
  root.setProperty("--primary-hover", mix(hex, hoverTarget, 0.18));
  root.setProperty("--primary-light", hexToRgba(hex, 0.15));
  root.setProperty("--primary-glow", hexToRgba(hex, 0.28));
  root.setProperty("--on-primary", onColor);
  root.setProperty("--scrollbar-thumb-hover", hexToRgba(hex, 0.45));
}

export function saveAccentColor(hex) {
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    // localStorage unavailable (private browsing etc.) -- color still
    // applies for this session via applyAccentColor, just won't persist.
  }
}

export function loadSavedAccentColor() {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function setAccentColor(hex) {
  applyAccentColor(hex);
  saveAccentColor(hex);
}

export { DEFAULT_ACCENT };
