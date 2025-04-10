import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export default function ChooseForMePage() {
  const [options, setOptions] = useState<string[]>([""]);
  const [numberOfWinners, setNumberOfWinners] = useState(1);

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
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Choose for Me</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
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

            <Button onClick={chooseRandom} className="w-full">
              Choose for Me
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
