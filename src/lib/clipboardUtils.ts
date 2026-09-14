/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Safely copies text to the system clipboard across all environments.
 * Handles secure contexts (HTTPS/localhost via navigator.clipboard) as well
 * as non-secure contexts (HTTP/local LAN IP, iframes, older browsers) via
 * document.execCommand('copy') fallback without throwing Uncaught TypeErrors.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Try modern Async Clipboard API if supported
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Permission denied or transient failure - fall through to fallback
      console.warn('navigator.clipboard.writeText failed, attempting fallback copy...', err);
    }
  }

  // 2. Robust fallback using offscreen textarea and document.execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('ReqForge clipboard copy fallback failed:', fallbackErr);
    return false;
  }
}
