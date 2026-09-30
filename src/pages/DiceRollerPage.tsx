import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageLayout } from "@/components/layout/PageLayout";
import { toast } from "sonner";
import { randomIntInclusive } from "@/lib/random";

const MIN_DICE = 1;
const MAX_DICE = 100;
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

/** Parses the raw input and clamps it to [MIN_DICE, MAX_DICE]; falls back to 1. */
function clampDiceCount(raw: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return MIN_DICE;
  return Math.min(MAX_DICE, Math.max(MIN_DICE, value));
}

export default function DiceRollerPage() {
  const [diceType, setDiceType] = useState("d20");
  // Keep the raw text so the field can be cleared while typing; it is
  // validated and clamped on blur and when rolling.
  const [numberOfDiceInput, setNumberOfDiceInput] = useState("1");
  const [results, setResults] = useState<number[]>([]);
  const [rolledType, setRolledType] = useState("d20");

  const total = results.reduce((a, b) => a + b, 0);

  const normalizeCount = () => {
    const count = clampDiceCount(numberOfDiceInput);
    if (String(count) !== numberOfDiceInput) {
      setNumberOfDiceInput(String(count));
    }
    return count;
  };

  const rollDice = () => {
    const count = normalizeCount();
    const sides = Number.parseInt(diceType.substring(1), 10);
    if (!DICE_SIDES.includes(sides as (typeof DICE_SIDES)[number])) {
      toast.error("Pick a die to roll");
      return;
    }
    try {
      const newResults = Array.from({ length: count }, () =>
        randomIntInclusive(1, sides)
      );
      setResults(newResults);
      setRolledType(diceType);
    } catch (error) {
      console.error("Failed to roll dice:", error);
      toast.error("Could not roll the dice", {
        description:
          error instanceof Error ? error.message : "Secure randomness is unavailable.",
      });
    }
  };

  return (
    <PageLayout title="Dice Roller">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Faces</Label>
              <ToggleGroup
                type="single"
                value={diceType}
                onValueChange={(value: string) => value && setDiceType(value)}
                variant="outline"
              >
                <ToggleGroupItem value="d4" aria-label="d4">
                  4
                </ToggleGroupItem>
                <ToggleGroupItem value="d6" aria-label="d6">
                  6
                </ToggleGroupItem>
                <ToggleGroupItem value="d8" aria-label="d8">
                  8
                </ToggleGroupItem>
                <ToggleGroupItem value="d10" aria-label="d10">
                  10
                </ToggleGroupItem>
                <ToggleGroupItem value="d12" aria-label="d12">
                  12
                </ToggleGroupItem>
                <ToggleGroupItem value="d20" aria-label="d20">
                  20
                </ToggleGroupItem>
                <ToggleGroupItem value="d100" aria-label="d100">
                  100
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfDice">Number of dice</Label>
              <Input
                type="number"
                id="numberOfDice"
                inputMode="numeric"
                min={MIN_DICE}
                max={MAX_DICE}
                step={1}
                value={numberOfDiceInput}
                onChange={(e) => setNumberOfDiceInput(e.target.value)}
                onBlur={normalizeCount}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rollDice();
                }}
                aria-describedby="numberOfDiceHint"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p id="numberOfDiceHint" className="text-xs text-muted-foreground">
                Between {MIN_DICE} and {MAX_DICE}.
              </p>
            </div>

            <Button onClick={rollDice} className="w-full">
              Roll Dice
            </Button>

            {results.length > 0 && (
              <div className="space-y-2">
                <div className="text-lg font-semibold">
                  Results ({results.length}
                  {rolledType}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className="p-2 bg-primary/10 rounded-lg text-center min-w-[2.5rem]"
                    >
                      {result}
                    </div>
                  ))}
                </div>
                <div className="text-lg font-semibold">Total: {total}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
