import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  estimateStrength,
  generatePassword,
  getCharSets,
  type PasswordOptions,
} from "./password";

const ALL: PasswordOptions = {
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

describe("generatePassword", () => {
  it("returns an empty string when no class is enabled", () => {
    expect(
      generatePassword(16, {
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
        excludeAmbiguous: false,
      })
    ).toBe("");
  });

  it("produces the requested length", () => {
    expect(generatePassword(16, ALL)).toHaveLength(16);
    expect(generatePassword(33, ALL)).toHaveLength(33);
  });

  it("clamps the length to the supported range", () => {
    expect(generatePassword(1, ALL)).toHaveLength(MIN_PASSWORD_LENGTH);
    expect(generatePassword(1000, ALL)).toHaveLength(MAX_PASSWORD_LENGTH);
    expect(generatePassword(Number.NaN, ALL)).toHaveLength(MIN_PASSWORD_LENGTH);
  });

  it("always includes every enabled class, even at the minimum length", () => {
    for (let i = 0; i < 500; i++) {
      const pw = generatePassword(4, ALL);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("only uses characters from enabled classes", () => {
    const opts = { ...ALL, uppercase: false, symbols: false };
    for (let i = 0; i < 200; i++) {
      expect(generatePassword(20, opts)).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("never uses look-alike characters when they are excluded", () => {
    const opts = { ...ALL, excludeAmbiguous: true };
    for (let i = 0; i < 300; i++) {
      expect(generatePassword(64, opts)).not.toMatch(/[Il1O0o|]/);
    }
  });
});

describe("getCharSets", () => {
  it("returns only enabled sets and removes ambiguous characters", () => {
    const sets = getCharSets({
      uppercase: false,
      lowercase: false,
      numbers: true,
      symbols: false,
      excludeAmbiguous: true,
    });
    expect(sets).toEqual(["23456789"]);
  });
});

describe("estimateStrength", () => {
  it("rates by length * log2(pool size)", () => {
    expect(estimateStrength(5, 26).level).toBe("weak");
    expect(estimateStrength(10, 26).level).toBe("medium"); // ~47 bits
    expect(estimateStrength(12, 62).level).toBe("strong"); // ~71 bits
    expect(estimateStrength(16, 88).level).toBe("very-strong"); // ~103 bits
  });

  it("returns 0 bits for an empty pool or length", () => {
    expect(estimateStrength(0, 62).bits).toBe(0);
    expect(estimateStrength(16, 1).bits).toBe(0);
  });
});
