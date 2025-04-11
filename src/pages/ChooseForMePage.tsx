import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ChooseForMePage() {
  const [options, setOptions] = useState<string[]>([""]);
  const [numberOfWinners, setNumberOfWinners] = useState(1);
  const [winners, setWinners] = useState<string[]>([]);
  const [duplicateValues, setDuplicateValues] = useState<Set<string>>(
    new Set()
  );

  const debouncedOptions = useDebounce(options, 300);

  const findDuplicates = useCallback((optionsToCheck: string[]) => {
    const nonEmptyOptions = optionsToCheck.filter((opt) => opt.trim() !== "");
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    nonEmptyOptions.forEach((option) => {
      if (seen.has(option)) {
        duplicates.add(option);
      } else {
        seen.add(option);
      }
    });

    return duplicates;
  }, []);

  useEffect(() => {
    const duplicates = findDuplicates(debouncedOptions);
    setDuplicateValues(duplicates);
  }, [debouncedOptions, findDuplicates]);

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const chooseRandom = () => {
    if (duplicateValues.size > 0) return;

    const validOptions = options.filter((option) => option.trim() !== "");
    if (validOptions.length === 0) return;

    const numWinners = Math.min(numberOfWinners, validOptions.length);

    const remainingOptions = [...validOptions];
    const winners: string[] = [];

    for (let i = 0; i < numWinners; i++) {
      const randomIndex = Math.floor(Math.random() * remainingOptions.length);
      winners.push(remainingOptions[randomIndex]);
      remainingOptions.splice(randomIndex, 1);
    }

    setWinners(winners);
  };

  return (
    <PageLayout title="Choose for Me">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Options</Label>
              {duplicateValues.size > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Please remove duplicate options before choosing winners.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className={
                        duplicateValues.has(option) ? "border-destructive" : ""
                      }
                    />
                    {options.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addOption} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Number of Winners</Label>
              <Input
                type="number"
                min="1"
                max={options.length}
                value={numberOfWinners}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value > options.length) {
                    setNumberOfWinners(options.length);
                  } else {
                    setNumberOfWinners(value);
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    setNumberOfWinners(1);
                  }
                }}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <Button onClick={chooseRandom} className="w-full">
              Choose for Me
            </Button>

            {winners.length > 0 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Winners</Label>
                <div className="space-y-3">
                  {winners.map((winner, index) => (
                    <div
                      key={index}
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
