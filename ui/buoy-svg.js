// Buoy: a goofy floating helper drone, shaped like a striped life buoy with a
// screen for a face. One SVG, reused on the loading screen and on the visor.

export function buoySvg({ size = 64, mood = 'happy' } = {}) {
  const eyes =
    mood === 'worried'
      ? '<path d="M38 50 q6 -5 12 0 M70 50 q6 -5 12 0" stroke="#7CF0FF" stroke-width="5" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="44" cy="52" rx="6" ry="8" fill="#7CF0FF"/><ellipse cx="76" cy="52" rx="6" ry="8" fill="#7CF0FF"/>';
  const mouth =
    mood === 'worried'
      ? '<path d="M50 72 q10 -6 20 0" stroke="#7CF0FF" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<path d="M48 68 q12 10 24 0" stroke="#7CF0FF" stroke-width="4" fill="none" stroke-linecap="round"/>';

  return `
<svg class="buoy-svg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
  <line x1="60" y1="14" x2="60" y2="2" stroke="#FFF3D6" stroke-width="4" stroke-linecap="round"/>
  <circle class="buoy-antenna" cx="60" cy="4" r="5" fill="#FFC145"/>
  <ellipse cx="13" cy="64" rx="9" ry="14" fill="#2B2770"/>
  <ellipse cx="107" cy="64" rx="9" ry="14" fill="#2B2770"/>
  <circle cx="60" cy="62" r="48" fill="#FFF3D6"/>
  <path d="M60 14 A48 48 0 0 1 102 38 L60 62 Z" fill="#FF5B1F"/>
  <path d="M102 86 A48 48 0 0 1 60 110 L60 62 Z" fill="#FF5B1F"/>
  <path d="M18 86 A48 48 0 0 1 18 38 L60 62 Z" fill="#FF5B1F"/>
  <circle cx="60" cy="62" r="48" fill="none" stroke="#1B1846" stroke-width="4"/>
  <rect x="26" y="34" width="68" height="54" rx="22" fill="#1B1846"/>
  <rect x="30" y="38" width="22" height="8" rx="4" fill="#FFFFFF" opacity="0.18"/>
  ${eyes}
  ${mouth}
</svg>`;
}
