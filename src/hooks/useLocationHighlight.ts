import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Router state used to point a page at one item (e.g. from the command palette). */
export interface HighlightState {
  highlight?: string;
  focus?: string;
}

export function readHighlightState(state: unknown): HighlightState {
  if (!state || typeof state !== "object") return {};
  const s = state as Record<string, unknown>;
  return {
    highlight: typeof s.highlight === "string" ? s.highlight : undefined,
    focus: typeof s.focus === "string" ? s.focus : undefined,
  };
}

const FLASH_CLASSES = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-md"];

/**
 * When the current location carries `{ highlight: id }`, scroll the element
 * `#${prefix}${id}` into view and flash a ring around it. The state is then
 * cleared (replace) so a reload or back navigation doesn't flash again.
 * Returns the id being highlighted (so the page can e.g. expand a section).
 */
export function useLocationHighlight(prefix: string): string | undefined {
  const location = useLocation();
  const navigate = useNavigate();
  const { highlight } = readHighlightState(location.state);
  const handledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!highlight || handledKey.current === location.key) return;
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      const el = document.getElementById(`${prefix}${highlight}`);
      if (!el) {
        // The element may appear a frame later (e.g. a section expanding).
        if (++tries < 20) frame = requestAnimationFrame(attempt);
        return;
      }
      handledKey.current = location.key;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add(...FLASH_CLASSES);
      window.setTimeout(() => el.classList.remove(...FLASH_CLASSES), 2000);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [highlight, prefix, location.key, location.pathname, location.search, navigate]);

  return highlight;
}
