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

