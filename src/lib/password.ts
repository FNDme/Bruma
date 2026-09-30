import { randomChoice, shuffle } from "@/lib/random";

export type CharClass = "uppercase" | "lowercase" | "numbers" | "symbols";

export type PasswordOptions = Record<CharClass, boolean> & {
  /** Leave out look-alike characters such as I, l, 1, O and 0. */
  excludeAmbiguous: boolean;
};

export const CHAR_CLASS_ORDER: CharClass[] = [
  "uppercase",
  "lowercase",
  "numbers",
  "symbols",
];

const CHAR_SETS: Record<CharClass, string> = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

const AMBIGUOUS = new Set("Il1O0o|".split(""));

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 64;

/** The characters available for each enabled class, after exclusions. */
export function getCharSets(options: PasswordOptions): string[] {
  return CHAR_CLASS_ORDER.filter((c) => options[c])
    .map((c) =>
      options.excludeAmbiguous
        ? CHAR_SETS[c]
            .split("")
            .filter((ch) => !AMBIGUOUS.has(ch))
            .join("")
        : CHAR_SETS[c]
    )
    .filter((set) => set.length > 0);
}

/**
 * Generates a password using a CSPRNG. Every enabled character class is
 * guaranteed to appear at least once (when length allows), the remaining
 * characters are drawn uniformly from the combined pool, and the result is
 * shuffled so the guaranteed characters are not in predictable positions.
 * Returns "" when no character class is enabled.
 */
export function generatePassword(length: number, options: PasswordOptions): string {
  const sets = getCharSets(options);
  if (sets.length === 0) return "";

  const len = Math.max(
    MIN_PASSWORD_LENGTH,
    Math.min(MAX_PASSWORD_LENGTH, Math.floor(length) || MIN_PASSWORD_LENGTH)
  );
  const pool = sets.join("");

  const chars: string[] = sets.slice(0, len).map((set) => randomChoice(set));
  while (chars.length < len) chars.push(randomChoice(pool));
  return shuffle(chars).join("");
}

export type StrengthLevel = "weak" | "medium" | "strong" | "very-strong";

export interface PasswordStrength {
  bits: number;
  level: StrengthLevel;
  label: string;
}

/**
 * Estimates strength from the generator's search space:
 * bits = length * log2(poolSize). Bands: <40 weak, <60 medium, <80 strong,
 * >=80 very strong.
 */
export function estimateStrength(length: number, poolSize: number): PasswordStrength {
  const bits = length > 0 && poolSize > 1 ? length * Math.log2(poolSize) : 0;
  if (bits < 40) return { bits, level: "weak", label: "Weak" };
  if (bits < 60) return { bits, level: "medium", label: "Medium" };
  if (bits < 80) return { bits, level: "strong", label: "Strong" };
  return { bits, level: "very-strong", label: "Very strong" };
}
