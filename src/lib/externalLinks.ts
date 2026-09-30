import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

/** Schemes we hand to the OS. Matches the opener plugin's default scope. */
const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns the absolute URL if `href` points outside the app (another origin
 * over http/https, or mailto:/tel:), otherwise null.
 */
export function externalUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (!EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
  if (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.origin === window.location.origin
  ) {
    return null;
  }
  return url.href;
}

/** Opens a URL in the user's default browser / mail client. */
export async function openExternal(href: string): Promise<void> {
  try {
    await openUrl(href);
  } catch (err) {
    // Not running inside Tauri (plain browser dev) — fall back to a new tab.
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    toast.error("Couldn't open link", {
      description: errorMessage(err, href),
    });
  }
}

/**
 * Document-level click handler: any click on an <a> pointing outside the app
 * is opened with the system opener instead of navigating the webview (which
 * would replace the app) or silently doing nothing (target=_blank).
 * Links inside an editable area (the note editor) are left alone so they can
 * be edited; they don't navigate because TipTap's openOnClick is off.
 */
export function handleExternalLinkClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button > 1) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.closest("[contenteditable='true']")) {
    // Keep the editor from navigating on a plain or middle click.
    event.preventDefault();
    return;
  }
  const url = externalUrl(anchor.getAttribute("href"));
  if (!url) return;
  event.preventDefault();
  void openExternal(url);
}
