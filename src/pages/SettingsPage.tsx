import { useTheme } from "../contexts/ThemeProvider";
import { Switch } from "../components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Customize your application settings and preferences.
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Dark Mode</label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark mode.
              </p>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Bruma</CardTitle>
          <CardDescription>Your personal writing companion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Version</h3>
            <p className="text-sm text-muted-foreground">1.0.0</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Your Writing Partner</h3>
            <div className="text-sm text-muted-foreground">
              <p>
                Bruma is more than just a writing app - it's your creative
                companion. Whether you're crafting stories, organizing thoughts,
                or building your collection of ideas, Bruma is here to support
                your creative journey. <br />
                With a focus on simplicity and elegance, it provides the perfect
                environment for your words to flourish, helping you bring your
                ideas to life while keeping them beautifully organized.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
