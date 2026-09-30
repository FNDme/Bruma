/**
 * Keyboard shortcut definitions and formatting.
 *
 * Combos are written as "mod+shift+k": `mod` is ⌘ on macOS and Ctrl elsewhere.
 * Global combos were picked to avoid the editor's own bindings (TipTap uses
 * Mod+B/I/U/E/Z/Y, Mod+Shift+X/7/8/B, Mod+Alt+0-6/C, and Mod+S saves a note).
 */

export const isMac =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(
    // userAgentData isn't in every webview (e.g. WKWebView), fall back to platform.
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent
  );

export type ShortcutId =
  | "palette"
  | "newNote"
  | "newTodo"
  | "settings"
  | "toggleSidebar"
  | "toggleTheme"
  | "shortcutsHelp"
  | "goCollection"
  | "goTodo"
  | "goRoutines"
  | "goSystemChecks"
  | "goPasswordGenerator"
  | "goDiceRoller"
  | "goChooseForMe";

export interface ShortcutDef {
  id: ShortcutId;
  combo: string;
  label: string;
  group: "General" | "Create" | "Go to";
}

export const GLOBAL_SHORTCUTS: ShortcutDef[] = [
  { id: "palette", combo: "mod+k", label: "Search and commands", group: "General" },
  { id: "shortcutsHelp", combo: "mod+/", label: "Show keyboard shortcuts", group: "General" },
  { id: "toggleSidebar", combo: "mod+\\", label: "Collapse or expand sidebar", group: "General" },
  { id: "toggleTheme", combo: "mod+shift+l", label: "Switch light / dark theme", group: "General" },
  { id: "settings", combo: "mod+,", label: "Open Settings", group: "General" },
  { id: "newNote", combo: "mod+n", label: "New note", group: "Create" },
  { id: "newTodo", combo: "mod+shift+n", label: "New todo", group: "Create" },
  { id: "goCollection", combo: "mod+1", label: "Collection", group: "Go to" },
  { id: "goTodo", combo: "mod+2", label: "Todo List", group: "Go to" },
  { id: "goRoutines", combo: "mod+3", label: "Routines", group: "Go to" },
  { id: "goSystemChecks", combo: "mod+4", label: "System Checks", group: "Go to" },
  { id: "goPasswordGenerator", combo: "mod+5", label: "Password Generator", group: "Go to" },
  { id: "goDiceRoller", combo: "mod+6", label: "Dice Roller", group: "Go to" },
  { id: "goChooseForMe", combo: "mod+7", label: "Choose For Me", group: "Go to" },
];

/** Shortcuts that only apply in the note editor (shown for reference). */
export const EDITOR_SHORTCUTS: { combo: string; label: string }[] = [
  { combo: "mod+s", label: "Save note and keep editing" },
  { combo: "mod+b", label: "Bold" },
  { combo: "mod+i", label: "Italic" },
  { combo: "mod+u", label: "Underline" },
  { combo: "mod+e", label: "Inline code" },
  { combo: "mod+alt+c", label: "Code block" },
  { combo: "mod+shift+b", label: "Blockquote" },
  { combo: "mod+shift+8", label: "Bullet list" },
  { combo: "mod+shift+7", label: "Numbered list" },
  { combo: "mod+alt+1", label: "Heading 1 (2, 3 for smaller)" },
  { combo: "mod+z", label: "Undo" },
  { combo: isMac ? "mod+shift+z" : "mod+y", label: "Redo" },
];

/**
 * System-wide shortcuts registered by the desktop app (src-tauri/src/desktop.rs,
 * QUICK_CAPTURE_SHORTCUT). They work even when Bruma is in the background.
 */
export const DESKTOP_SHORTCUTS: { combo: string; label: string }[] = [
  { combo: "mod+shift+space", label: "Quick capture a todo or note (from any app)" },
];

/** Shortcuts inside the command palette. */
export const PALETTE_SHORTCUTS: { combo: string; label: string }[] = [
  { combo: "up", label: "Previous result" },
  { combo: "down", label: "Next result" },
  { combo: "enter", label: "Open / run" },
  { combo: "escape", label: "Close" },
];

export function shortcutFor(id: ShortcutId): ShortcutDef {
  return GLOBAL_SHORTCUTS.find((s) => s.id === id)!;
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  ctrl: "⌃",
  enter: "↵",
  escape: "Esc",
  up: "↑",
  down: "↓",
  space: "Space",
};

const PC_NAMES: Record<string, string> = {
  mod: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  ctrl: "Ctrl",
  enter: "Enter",
  escape: "Esc",
  up: "↑",
  down: "↓",
  space: "Space",
};

/** Individual key labels for a combo, e.g. ["⌘", "⇧", "N"] or ["Ctrl", "Shift", "N"]. */
export function comboKeys(combo: string): string[] {
  const names = isMac ? MAC_SYMBOLS : PC_NAMES;
  return splitCombo(combo).map((part) => names[part] ?? part.toUpperCase());
}

/** A combo as one string: "⌘⇧N" on macOS, "Ctrl+Shift+N" elsewhere. */
export function formatCombo(combo: string): string {
  return comboKeys(combo).join(isMac ? "" : "+");
}

/** Split "mod+shift++" style combos; a literal "+" key is allowed as the last part. */
export function splitCombo(combo: string): string[] {
  const parts = combo.toLowerCase().split("+");
  if (combo.endsWith("++")) {
    parts.splice(parts.length - 2, 2, "+");
  }
  return parts.filter(Boolean);
}

interface ParsedCombo {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export function parseCombo(combo: string): ParsedCombo {
  const parts = splitCombo(combo);
  return {
    key: parts[parts.length - 1],
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  };
}

/**
 * The key an event produced, normalized. Uses the typed character when it is a
 * plain letter/digit (respects Dvorak etc.), and falls back to the physical key
 * when a modifier or a non-Latin layout changed it (e.g. ⌥ on macOS, Cyrillic).
 */
function eventKey(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (/^[a-z0-9]$/.test(key)) return key;
  const code = event.code;
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  return key;
}

export function matchesCombo(event: KeyboardEvent, combo: ParsedCombo): boolean {
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  // The "other" modifier (Ctrl on mac, ⌘/Win elsewhere) must not be held.
  const otherPressed = isMac ? event.ctrlKey : event.metaKey;
  if (modPressed !== combo.mod || otherPressed) return false;
  if (event.altKey !== combo.alt) return false;
  const key = eventKey(event);
  const isLetterOrDigit = /^[a-z0-9]$/.test(combo.key);
  // For punctuation ("/", ",", "\") Shift changes the produced character on
  // many layouts, so only compare Shift for letters and digits.
  if (isLetterOrDigit && event.shiftKey !== combo.shift) return false;
  if (!isLetterOrDigit && combo.shift && !event.shiftKey) return false;
  return key === combo.key;
}
