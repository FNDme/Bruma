import React, { useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PasswordOptions {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

const PasswordGeneratorPage: React.FC = () => {
  const [password, setPassword] = useState<string>("");
  const [length, setLength] = useState<number>(12);
  const [options, setOptions] = useState<PasswordOptions>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const generatePassword = useCallback(() => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    let characters = "";
    if (options.uppercase) characters += uppercase;
    if (options.lowercase) characters += lowercase;
    if (options.numbers) characters += numbers;
    if (options.symbols) characters += symbols;

    if (characters.length === 0) {
      toast.error("Please select at least one character type");
      return;
    }

    let newPassword = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      newPassword += characters[randomIndex];
    }

    setPassword(newPassword);
  }, [length, options]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    toast.success("Password copied to clipboard!");
  };

  const getPasswordStrength = () => {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (password.length >= 16) strength++;
    if (password.length >= 20) strength++;
    if (password.length >= 24) strength++;
    if (password.length >= 28) strength++;
    if (password.length >= 32) strength++;

    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    switch (strength) {
      case 0:
        return "Empty";
      case 1:
      case 2:
      case 3:
        return "Weak";
      case 4:
        return "Medium";
      case 5:
        return "Strong";
      default:
        return "Very Strong";
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Password Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">
                Password Length: {length}
              </label>
              <span className="text-sm text-muted-foreground">
                {getPasswordStrength()}
              </span>
            </div>
            <Slider
              value={[length]}
              onValueChange={(value: number[]) => setLength(value[0])}
              min={4}
              max={32}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Character Types</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="uppercase"
                  checked={options.uppercase}
                  onCheckedChange={(checked: boolean) =>
                    setOptions({ ...options, uppercase: checked })
                  }
                />
                <label htmlFor="uppercase">Uppercase Letters</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lowercase"
                  checked={options.lowercase}
                  onCheckedChange={(checked: boolean) =>
                    setOptions({ ...options, lowercase: checked })
                  }
                />
                <label htmlFor="lowercase">Lowercase Letters</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="numbers"
                  checked={options.numbers}
                  onCheckedChange={(checked: boolean) =>
                    setOptions({ ...options, numbers: checked })
                  }
                />
                <label htmlFor="numbers">Numbers</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="symbols"
                  checked={options.symbols}
                  onCheckedChange={(checked: boolean) =>
                    setOptions({ ...options, symbols: checked })
                  }
                />
                <label htmlFor="symbols">Symbols</label>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Input type="text" value={password} readOnly className="flex-1" />
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              disabled={!password}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" onClick={generatePassword}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordGeneratorPage;
