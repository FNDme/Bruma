import { useTheme } from "../contexts/ThemeProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <PageLayout
      title="Settings"
      subtitle="Customize your application settings and preferences."
    >
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Theme</label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme.
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Bruma</CardTitle>
          <CardDescription>Your personal companion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Version</h3>
            <p className="text-sm text-muted-foreground">1.0.0</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Your Toolbox for life</h3>
            <div className="text-sm text-muted-foreground">
              <p>
                Bruma is your digital Swiss Army knife, ready to tackle life's
                challenges head-on. Whether you're pouring your thoughts into a
                private journal, running security checks to keep your digital
                life safe, or preparing for future adventures, Bruma has your
                back. It's not just an app – it's your personal companion in the
                digital wilderness, growing and evolving with you every step of
                the way. Stay tuned for more powerful features coming your way!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
