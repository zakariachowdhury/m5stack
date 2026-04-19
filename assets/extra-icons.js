// Monochrome SVG icons for the external-components catalog.
// Each SVG uses currentColor so CSS can tint it to the category accent.
// Designed for a 64×64 viewport; rendered inside the product media frame.

export const EXTRA_ICONS = {
  breadboard: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="10" width="48" height="44" rx="3"/>
    <line x1="8" y1="22" x2="56" y2="22"/>
    <line x1="8" y1="42" x2="56" y2="42"/>
    <g stroke-width="2.2">
      ${Array.from({length: 8}, (_, i) => `<circle cx="${12 + i*5.5}" cy="16" r="0.9" fill="currentColor"/>`).join('')}
      ${Array.from({length: 8}, (_, i) => `<circle cx="${12 + i*5.5}" cy="28" r="0.9" fill="currentColor"/>`).join('')}
      ${Array.from({length: 8}, (_, i) => `<circle cx="${12 + i*5.5}" cy="34" r="0.9" fill="currentColor"/>`).join('')}
      ${Array.from({length: 8}, (_, i) => `<circle cx="${12 + i*5.5}" cy="48" r="0.9" fill="currentColor"/>`).join('')}
    </g>
  </svg>`,

  jumpers: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 18 C 20 6, 44 6, 54 18 C 48 22, 46 28, 50 40"/>
    <path d="M14 26 C 24 14, 40 14, 48 28 C 42 36, 40 42, 44 50"/>
    <rect x="8" y="16" width="6" height="5" rx="1" fill="currentColor"/>
    <rect x="48" y="38" width="6" height="5" rx="1" fill="currentColor"/>
    <rect x="12" y="24" width="6" height="5" rx="1" fill="currentColor"/>
    <rect x="42" y="48" width="6" height="5" rx="1" fill="currentColor"/>
  </svg>`,

  led: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 32 C 20 18, 44 18, 44 32 L 44 40 L 20 40 Z" fill="currentColor" fill-opacity="0.15"/>
    <line x1="26" y1="40" x2="26" y2="56"/>
    <line x1="38" y1="40" x2="38" y2="56"/>
    <path d="M8 14 L 14 20 M12 10 L 18 16 M52 10 L 46 16" stroke-width="1.8"/>
  </svg>`,

  resistor: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="32" x2="18" y2="32"/>
    <line x1="46" y1="32" x2="60" y2="32"/>
    <rect x="18" y="24" width="28" height="16" rx="4" fill="currentColor" fill-opacity="0.1"/>
    <line x1="24" y1="24" x2="24" y2="40" stroke-width="2.2"/>
    <line x1="30" y1="24" x2="30" y2="40" stroke-width="2.2"/>
    <line x1="36" y1="24" x2="36" y2="40" stroke-width="2.2"/>
  </svg>`,

  button: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="14" y="22" width="36" height="26" rx="2"/>
    <circle cx="32" cy="28" r="8" fill="currentColor" fill-opacity="0.2"/>
    <line x1="14" y1="48" x2="14" y2="54"/>
    <line x1="50" y1="48" x2="50" y2="54"/>
    <line x1="24" y1="48" x2="24" y2="54"/>
    <line x1="40" y1="48" x2="40" y2="54"/>
  </svg>`,

  piezo: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="32" r="16"/>
    <circle cx="32" cy="32" r="9" fill="currentColor" fill-opacity="0.15"/>
    <circle cx="32" cy="32" r="2" fill="currentColor"/>
    <path d="M50 22 Q 56 32 50 42 M54 18 Q 62 32 54 46" stroke-width="1.8"/>
  </svg>`,

  ldr: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="34" r="14"/>
    <path d="M22 30 Q 26 40 32 34 Q 38 28 42 38 Q 38 28 32 34 Q 26 40 22 30" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.4"/>
    <line x1="32" y1="48" x2="32" y2="56"/>
    <line x1="20" y1="44" x2="14" y2="50"/>
    <line x1="44" y1="44" x2="50" y2="50"/>
    <path d="M32 8 L32 14 M16 14 L20 18 M48 14 L44 18" stroke-width="1.6"/>
  </svg>`,

  thermistor: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="26" y="10" width="12" height="30" rx="6"/>
    <circle cx="32" cy="46" r="8" fill="currentColor" fill-opacity="0.25"/>
    <line x1="32" y1="14" x2="32" y2="38"/>
    <path d="M44 16 L 48 16 M44 24 L 48 24 M44 32 L 48 32" stroke-width="1.6"/>
  </svg>`,

  motor: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="12" y="18" width="32" height="28" rx="3"/>
    <circle cx="28" cy="32" r="8" fill="currentColor" fill-opacity="0.1"/>
    <text x="28" y="36" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="currentColor" stroke="none">M</text>
    <line x1="44" y1="26" x2="54" y2="26"/>
    <line x1="44" y1="38" x2="54" y2="38"/>
    <line x1="12" y1="24" x2="4" y2="24"/>
    <line x1="12" y1="40" x2="4" y2="40"/>
  </svg>`,

  transistor: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="30" r="14"/>
    <line x1="22" y1="22" x2="22" y2="38"/>
    <line x1="22" y1="30" x2="10" y2="30"/>
    <line x1="22" y1="24" x2="42" y2="14"/>
    <line x1="22" y1="36" x2="42" y2="46"/>
    <path d="M36 40 L42 46 L40 40 Z" fill="currentColor"/>
    <line x1="42" y1="14" x2="42" y2="4"/>
    <line x1="42" y1="46" x2="42" y2="56"/>
  </svg>`,

  speaker: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 24 L 22 24 L 36 14 L 36 50 L 22 40 L 10 40 Z" fill="currentColor" fill-opacity="0.1"/>
    <path d="M44 22 Q 50 32 44 42" stroke-width="1.8"/>
    <path d="M48 16 Q 58 32 48 48" stroke-width="1.8"/>
  </svg>`,

  reed: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="26" width="32" height="12" rx="6" fill="currentColor" fill-opacity="0.05"/>
    <line x1="4" y1="32" x2="10" y2="32"/>
    <line x1="38" y1="32" x2="44" y2="32"/>
    <line x1="14" y1="32" x2="24" y2="32"/>
    <line x1="26" y1="29" x2="34" y2="33"/>
    <rect x="48" y="22" width="12" height="20" rx="2"/>
    <line x1="50" y1="26" x2="58" y2="26" stroke-width="1.6"/>
    <line x1="50" y1="32" x2="58" y2="32" stroke-width="1.6"/>
    <line x1="50" y1="38" x2="58" y2="38" stroke-width="1.6"/>
  </svg>`,

  tilt: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="12" y="22" width="40" height="20" rx="10" transform="rotate(-14 32 32)"/>
    <circle cx="22" cy="30" r="4" fill="currentColor"/>
    <line x1="6" y1="42" x2="14" y2="42"/>
    <line x1="50" y1="42" x2="58" y2="42"/>
  </svg>`,

  potentiometer: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="30" r="16" fill="currentColor" fill-opacity="0.08"/>
    <line x1="32" y1="30" x2="42" y2="22"/>
    <path d="M18 42 A18 18 0 0 1 46 42" stroke-width="1.6"/>
    <line x1="20" y1="52" x2="26" y2="52"/>
    <line x1="32" y1="52" x2="32" y2="58"/>
    <line x1="38" y1="52" x2="44" y2="52"/>
    <line x1="26" y1="46" x2="26" y2="52"/>
    <line x1="38" y1="46" x2="38" y2="52"/>
    <line x1="32" y1="46" x2="32" y2="52"/>
  </svg>`,

  microswitch: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="10" y="28" width="32" height="20" rx="2" fill="currentColor" fill-opacity="0.08"/>
    <path d="M10 32 L 46 18" stroke-width="2.2"/>
    <circle cx="46" cy="18" r="2.5" fill="currentColor"/>
    <line x1="16" y1="48" x2="16" y2="56"/>
    <line x1="26" y1="48" x2="26" y2="56"/>
    <line x1="36" y1="48" x2="36" y2="56"/>
  </svg>`,
};
