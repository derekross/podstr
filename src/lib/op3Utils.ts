/**
 * OP3 (Open Podcast Prefix Project) utilities
 * https://op3.dev
 */

const OP3_PREFIX = 'https://op3.dev/e/';

/**
 * Prefixes a URL with OP3 analytics prefix if not already prefixed
 * @param url - The original URL to prefix
 * @returns The OP3-prefixed URL
 */
export function addOP3Prefix(url: string): string {
  if (!url) return url;

  // Don't prefix if already has OP3 prefix
  if (url.startsWith(OP3_PREFIX)) {
    return url;
  }

  // Remove protocol (http:// or https://) from the URL before prefixing
  // OP3 expects URLs without protocol
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '');

  return `${OP3_PREFIX}${urlWithoutProtocol}`;
}

/**
 * Removes OP3 prefix from a URL if present
 * @param url - The OP3-prefixed URL
 * @returns The original URL without OP3 prefix
 */
export function removeOP3Prefix(url: string): string {
  if (!url) return url;

  if (url.startsWith(OP3_PREFIX)) {
    // Remove the OP3 prefix and add back https://
    const urlWithoutPrefix = url.substring(OP3_PREFIX.length);
    return `https://${urlWithoutPrefix}`;
  }

  return url;
}

/**
 * Checks if a URL has an OP3 prefix
 * @param url - The URL to check
 * @returns True if the URL is prefixed with OP3
 */
export function hasOP3Prefix(url: string): boolean {
  return url?.startsWith(OP3_PREFIX) || false;
}
