import { useEffect, useRef } from "react";
import { matchesCombo, parseCombo } from "@/lib/shortcuts";

export interface HotkeyBinding {
  /** e.g. "mod+k", "mod+shift+n", "mod+,". */
  combo: string;
  handler: (event: KeyboardEvent) => void;
  /**
   * Fire even when focus is in an input, textarea or the rich-text editor.
   * Defaults to true for combos with mod (they don't type text) and false otherwise.
   */
  allowInInputs?: boolean;
  /** Skip the binding without re-subscribing. */
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Global keyboard shortcuts on window (bubble phase).
 *
 * Handlers are kept in a ref, so callers can pass a fresh array each render.
 * Events that something else already handled (defaultPrevented, e.g. by the
 * TipTap editor), IME composition and auto-repeat are ignored.
 */
export function useHotkeys(bindings: HotkeyBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      const editable = isEditableTarget(event.target);
      for (const binding of bindingsRef.current) {
        if (binding.enabled === false) continue;
        const parsed = parseCombo(binding.combo);
        const allowInInputs = binding.allowInInputs ?? parsed.mod;
        if (editable && !allowInInputs) continue;
        if (!matchesCombo(event, parsed)) continue;
        event.preventDefault();
        binding.handler(event);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
