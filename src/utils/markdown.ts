import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Converts markdown text to Matrix-compatible HTML.
 * Matrix expects a specific subset of HTML in formatted_body.
 */
export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  // Configure marked for safe output and GFM
  const html = marked.parse(markdown, {
    gfm: true,
    breaks: true,
  });

  // Sanitize the resulting HTML
  return DOMPurify.sanitize(html as string);
};

/**
 * Checks if a string contains markdown formatting characters.
 */
export const containsMarkdown = (text: string): boolean => {
  const markdownRegex = /[*_`~[\]#]/;
  return markdownRegex.test(text);
};
