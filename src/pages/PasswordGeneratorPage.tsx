import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { cn } from "@/lib/utils";
import {
  CHAR_CLASS_ORDER,
  CharClass,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PasswordOptions,
  StrengthLevel,
  estimateStrength,
  generatePassword,
  getCharSets,
} from "@/lib/password";

const CLASS_LABELS: Record<CharClass, string> = {
  uppercase: "Uppercase letters (A-Z)",
  lowercase: "Lowercase letters (a-z)",
  numbers: "Numbers (0-9)",
  symbols: "Symbols (!@#$…)",
};

const STRENGTH_STYLES: Record<
  StrengthLevel,
  { bar: string; text: string; percent: number }
> = {
  weak: { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", percent: 25 },
  medium: {
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    percent: 50,
  },
  strong: {
    bar: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
    percent: 75,
  },
  "very-strong": {
    bar: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-400",
    percent: 100,
  },
};

async function writeClipboard(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available.");
  }
  await navigator.clipboard.writeText(text);
}

const PasswordGeneratorPage: React.FC = () => {
  const [length, setLength] = useState<number>(16);
  const [options, setOptions] = useState<PasswordOptions>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [password, setPassword] = useState<string>("");
  const [isCopying, setIsCopying] = useState(false);

  const enabledCount = CHAR_CLASS_ORDER.filter((c) => options[c]).length;
  const poolSize = useMemo(
    () => getCharSets(options).reduce((sum, set) => sum + set.length, 0),
    [options]
  );

  const regenerate = useCallback(() => {
    try {
      const next = generatePassword(length, options);
      if (!next) {
        toast.error("Please select at least one character type");
      }
      setPassword(next);
    } catch (error) {
      console.error("Failed to generate password:", error);
      setPassword("");
      toast.error("Could not generate a secure password", {
        description:
          error instanceof Error ? error.message : "Secure randomness is unavailable.",
      });
    }
  }, [length, options]);

  // Generate on mount and whenever the settings change, so the shown password
  // always matches the selected length and character types.
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const toggleClass = (charClass: CharClass, checked: boolean) => {
    // Keep at least one character class selected.
    if (!checked && enabledCount <= 1 && options[charClass]) return;
    setOptions((prev) => ({ ...prev, [charClass]: checked }));
  };

  const copyToClipboard = async () => {
    if (!password || isCopying) return;
    setIsCopying(true);
    try {
      await writeClipboard(password);
      toast.success("Password copied to clipboard");
    } catch (error) {
      console.error("Failed to copy password:", error);
      toast.error("Could not copy the password", {
        description: "Select the password and copy it manually.",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const strength = password ? estimateStrength(password.length, poolSize) : null;
  const strengthStyle = strength ? STRENGTH_STYLES[strength.level] : null;

  return (
    <PageLayout
      title="Password Generator"
      headerActions={
        <div className="space-x-2">
          <Button onClick={regenerate} disabled={enabledCount === 0}>
            Generate
            <RefreshCw className="h-4 w-4 ml-2" />
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                value={password}
                readOnly
                aria-label="Generated password"
                spellCheck={false}
                autoComplete="off"
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                disabled={!password || isCopying}
                aria-label="Copy password"
                title="Copy password"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {strength && strengthStyle && (
              <div className="space-y-1">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-label="Password strength"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={strengthStyle.percent}
                  aria-valuetext={`${strength.label}, about ${Math.round(strength.bits)} bits`}
                >
                  <div
                    className={cn("h-full transition-all", strengthStyle.bar)}
                    style={{ width: `${strengthStyle.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={cn("font-medium", strengthStyle.text)}>
                    Strength: {strength.label}
                  </span>
                  <span className="text-muted-foreground">
                    ~{Math.round(strength.bits)} bits of entropy
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium" id="password-length-label">
                Password Length: {length}
              </label>
            </div>
            <Slider
              value={[length]}
              onValueChange={(value: number[]) => setLength(value[0])}
              min={MIN_PASSWORD_LENGTH}
              max={MAX_PASSWORD_LENGTH}
              step={1}
              aria-labelledby="password-length-label"
            />
          </div>

          <div className="space-y-2">
            <p id="character-types-label" className="text-sm font-medium">
              Character Types
            </p>
            <div
              role="group"
              aria-labelledby="character-types-label"
              className="grid grid-cols-2 gap-2"
            >
              {CHAR_CLASS_ORDER.map((charClass) => {
                const isLastEnabled = options[charClass] && enabledCount <= 1;
                return (
                  <div key={charClass} className="flex items-center space-x-2">
                    <Checkbox
                      id={charClass}
                      checked={options[charClass]}
                      disabled={isLastEnabled}
                      title={
                        isLastEnabled
                          ? "At least one character type is required"
                          : undefined
                      }
                      onCheckedChange={(checked) =>
                        toggleClass(charClass, checked === true)
                      }
                    />
                    <label htmlFor={charClass}>{CLASS_LABELS[charClass]}</label>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Each selected type is guaranteed to appear at least once.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="excludeAmbiguous"
              checked={options.excludeAmbiguous}
              onCheckedChange={(checked) =>
                setOptions((prev) => ({
                  ...prev,
                  excludeAmbiguous: checked === true,
                }))
              }
            />
            <label htmlFor="excludeAmbiguous">
              Exclude look-alike characters (I, l, 1, O, 0, o, |)
            </label>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default PasswordGeneratorPage;
