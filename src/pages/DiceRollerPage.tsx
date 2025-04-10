import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function DiceRollerPage() {
  const [diceType, setDiceType] = useState("d20");
  const [numberOfDice, setNumberOfDice] = useState(1);
  const [results, setResults] = useState<number[]>([]);
  const [total, setTotal] = useState(0);

  const rollDice = () => {
    const sides = parseInt(diceType.substring(1));
    const newResults = Array.from(
      { length: numberOfDice },
      () => Math.floor(Math.random() * sides) + 1
    );
    setResults(newResults);
    setTotal(newResults.reduce((a, b) => a + b, 0));
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Dice Roller</CardTitle>
        </CardHeader>
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
              <Label htmlFor="numberOfDice">Number of Dices</Label>
              <Input
                type="number"
                id="numberOfDice"
                min="1"
                max="10"
                value={numberOfDice}
                onChange={(e) => setNumberOfDice(parseInt(e.target.value))}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <Button onClick={rollDice} className="w-full">
              Roll Dice
            </Button>

            {results.length > 0 && (
              <div className="space-y-2">
                <div className="text-lg font-semibold">Results:</div>
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
    </div>
  );
}
