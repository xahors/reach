/**
 * Sanitizes custom CSS to prevent XSS, tracking, and other malicious injections.
 */
export const sanitizeCSS = (css: string): string => {
  if (!css) return '';

  let sanitized = css;

  // 1. Remove @import to prevent loading external CSS
  sanitized = sanitized.replace(/@import/gi, '/* prohibited-import */');

  // 2. Remove url() to prevent external assets (tracking/XSS)
  // We block all urls including data: for maximum safety in a chat app
  sanitized = sanitized.replace(/url\s*\(/gi, 'prohibited-url(');

  // 3. Remove expressions and behaviors (legacy IE exploits)
  sanitized = sanitized.replace(/expression\s*\(/gi, 'prohibited-expr(');
  sanitized = sanitized.replace(/behavior\s*:/gi, 'prohibited-behavior:');

  // 4. Remove -moz-binding (legacy Firefox exploit)
  sanitized = sanitized.replace(/-moz-binding/gi, 'prohibited-binding');

  // 5. Remove @font-face (prevents font-based tracking)
  sanitized = sanitized.replace(/@font-face/gi, '/* prohibited-font-face */');

  // 6. Character limit to prevent performance degradation (10KB)
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + '\n/* CSS truncated: too long */';
  }

  return sanitized;
};
