/**
 * Utility functions for image handling
 */

/**
 * Returns a data URI for a placeholder image
 * This is a simple gray square SVG that works offline and doesn't require network access
 */
export function getPlaceholderImage(size: number = 100): string {
  // Create a simple gray square SVG as a data URI
  // Using URL encoding instead of base64 for better React Native compatibility
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#333333"/><text x="50%" y="50%" font-family="Arial" font-size="${Math.max(12, size / 8)}" fill="#999999" text-anchor="middle" dy=".3em">No Image</text></svg>`;
  // URL encode the SVG for compatibility across platforms
  const encodedSvg = encodeURIComponent(svg);
  return `data:image/svg+xml,${encodedSvg}`;
}

/**
 * Gets a thumbnail URL with fallback to placeholder
 */
export function getThumbnailUrl(thumbnail: string | null | undefined, size: number = 100): string {
  return thumbnail || getPlaceholderImage(size);
}

/**
 * Generates a simple hash from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Converts HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

/**
 * Generates gradient colors from an image URL
 * Uses a deterministic approach based on the URL hash
 */
export function generateGradientFromImage(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) {
    // Default gradient: purple to blue
    return ['#667eea', '#764ba2'];
  }

  const hash = hashString(imageUrl);
  
  // Generate two colors based on hash
  const hue1 = hash % 360;
  const hue2 = (hash + 60) % 360; // Offset by 60 degrees for complementary feel
  
  // Use vibrant but not too bright colors (saturation 60-80%, lightness 40-60%)
  const sat1 = 60 + (hash % 20);
  const sat2 = 60 + ((hash * 2) % 20);
  const light1 = 40 + (hash % 20);
  const light2 = 40 + ((hash * 3) % 20);

  const [r1, g1, b1] = hslToRgb(hue1, sat1, light1);
  const [r2, g2, b2] = hslToRgb(hue2, sat2, light2);

  return [rgbToHex(r1, g1, b1), rgbToHex(r2, g2, b2)];
}

/**
 * Darkens a hex color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) - Math.round(255 * percent)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) - Math.round(255 * percent)));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) - Math.round(255 * percent)));
  return rgbToHex(r, g, b);
}

