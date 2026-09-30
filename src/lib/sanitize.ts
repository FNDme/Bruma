import DOMPurify from "dompurify";

let hooked = false;

function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node instanceof HTMLAnchorElement && node.hasAttribute("href")) {
      // External links are opened through the OS by handleExternalLinkClick;
      // never let a stored target open a new webview window.
      node.removeAttribute("target");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

/**
 * Sanitizes stored note HTML before it is rendered. Notes written in the
 * editor are already constrained by the TipTap schema, but localStorage can be
 * edited or imported, so rendering must never trust it.
 */
export function sanitizeNoteHtml(html: string | null | undefined): string {
  if (!html) return "";
  ensureHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style"],
  });
}
