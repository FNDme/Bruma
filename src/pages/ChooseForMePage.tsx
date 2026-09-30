import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sample } from "@/lib/random";

interface OptionRow {
  id: number;
  value: string;
}

/** Two options are duplicates when they match ignoring case and outer spaces. */
function normalizeOption(value: string): string {
  return value.trim().toLowerCase();
}

function findDuplicates(options: OptionRow[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const option of options) {
    const key = normalizeOption(option.value);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  return duplicates;
}

/** Parses the raw input and clamps it to [1, max]; falls back to 1. */
function clampWinners(raw: string, max: number): number {
  const value = Number.parseInt(raw, 10);
  const upper = Math.max(1, max);
  if (!Number.isFinite(value)) return 1;
  return Math.min(upper, Math.max(1, value));
}

export default function ChooseForMePage() {
  const nextId = useRef(1);
  const [options, setOptions] = useState<OptionRow[]>([{ id: 0, value: "" }]);
  // Raw text so the field can be cleared while typing; clamped on blur/choose.
  const [numberOfWinnersInput, setNumberOfWinnersInput] = useState("1");
  const [winners, setWinners] = useState<string[]>([]);

  // Computed synchronously so the check can never lag behind the inputs.
  const duplicateValues = useMemo(() => findDuplicates(options), [options]);
  const validOptions = useMemo(
    () =>
      options.map((o) => o.value.trim()).filter((value) => value !== ""),
    [options]
  );
  const maxWinners = Math.max(1, validOptions.length);

  const addOption = () => {
    const id = nextId.current++;
    setOptions((prev) => [...prev, { id, value: "" }]);
  };

  const removeOption = (id: number) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const updateOption = (id: number, value: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, value } : o)));
  };

  const normalizeWinners = () => {
    const count = clampWinners(numberOfWinnersInput, validOptions.length);
    if (String(count) !== numberOfWinnersInput) {
      setNumberOfWinnersInput(String(count));
    }
    return count;
  };

  const chooseRandom = () => {
    const current = findDuplicates(options);
    if (current.size > 0) {
      toast.error("Please remove duplicate options before choosing winners.");
      return;
    }
    if (validOptions.length === 0) {
      toast.error("Add at least one option first.");
      return;
    }

    const count = normalizeWinners();
    try {
      setWinners(sample(validOptions, count));
    } catch (error) {
      console.error("Failed to choose winners:", error);
      toast.error("Could not choose winners", {
        description:
          error instanceof Error ? error.message : "Secure randomness is unavailable.",
      });
    }
  };

  const hasDuplicates = duplicateValues.size > 0;

  return (
    <PageLayout title="Choose for Me">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Options</Label>
              {hasDuplicates && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Please remove duplicate options before choosing winners.
                    Options are compared ignoring letter case and surrounding
                    spaces.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                {options.map((option, index) => {
                  const isDuplicate = duplicateValues.has(
                    normalizeOption(option.value)
                  );
                  return (
                    <div key={option.id} className="flex gap-2">
                      <Input
                        value={option.value}
                        onChange={(e) => updateOption(option.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addOption();
                          }
                        }}
                        autoFocus={index > 0 && option.value === ""}
                        placeholder={`Option ${index + 1}`}
                        aria-label={`Option ${index + 1}`}
                        aria-invalid={isDuplicate || undefined}
                        className={isDuplicate ? "border-destructive" : ""}
                      />
                      {options.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(option.id)}
                          className="shrink-0"
                          aria-label={`Remove option ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" onClick={addOption} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfWinners">Number of Winners</Label>
              <Input
                id="numberOfWinners"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxWinners}
                step={1}
                value={numberOfWinnersInput}
                onChange={(e) => setNumberOfWinnersInput(e.target.value)}
                onBlur={normalizeWinners}
                aria-describedby="numberOfWinnersHint"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p id="numberOfWinnersHint" className="text-xs text-muted-foreground">
                Between 1 and {maxWinners} (the number of filled-in options).
              </p>
            </div>

            <Button
              onClick={chooseRandom}
              className="w-full"
              disabled={hasDuplicates || validOptions.length === 0}
            >
              Choose for Me
            </Button>

            {winners.length > 0 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Winners</Label>
                <div className="space-y-3">
                  {winners.map((winner, index) => (
                    <div
                      key={`${index}-${winner}`}
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <span className="text-lg font-medium">{winner}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
