import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  DayHistory,
  addLocalDays,
  dailyHistory,
  localDateKey,
  startOfIsoWeek,
} from "@/lib/routineDates";
import type { RoutineTask } from "@/types/routine";

const CHART_DAYS = 30;
const HEATMAP_WEEKS = 12;

const chartConfig = {
  rate: { label: "Daily routines done", color: "var(--chart-2)" },
} satisfies ChartConfig;

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function describeDay(day: DayHistory): string {
  const date = longDate.format(day.date);
  if (day.isFuture) return date;
  if (day.total === 0) return `${date}: no daily routines`;
  return `${date}: ${day.completed} of ${day.total} done (${day.rate}%)`;
}

/** Sequential single-hue step for a completion rate (0 = empty cell). */
function heatLevel(rate: number | null): number {
  if (rate === null || rate === 0) return 0;
  if (rate < 34) return 1;
  if (rate < 67) return 2;
  if (rate < 100) return 3;
  return 4;
}

const LEVEL_MIX = [0, 30, 55, 80, 100];

function heatStyle(level: number): React.CSSProperties | undefined {
  if (level === 0) return undefined;
  return {
    backgroundColor: `color-mix(in oklch, var(--chart-2) ${LEVEL_MIX[level]}%, var(--muted))`,
  };
}

interface HistoryTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: DayHistory }>;
}

function HistoryTooltip({ active, payload }: HistoryTooltipProps) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{longDate.format(day.date)}</div>
      <div className="text-muted-foreground">
        {day.total === 0
          ? "No daily routines"
          : `${day.completed} of ${day.total} done · ${day.rate}%`}
      </div>
    </div>
  );
}

interface RoutineHistoryCardProps {
  tasks: RoutineTask[];
}

export function RoutineHistoryCard({ tasks }: RoutineHistoryCardProps) {
  // Recomputed whenever tasks change (resets and toggles replace the array).
  const { recent, heatmap, summary } = useMemo(() => {
    const now = new Date();
    const recent = dailyHistory(
      tasks,
      addLocalDays(now, -(CHART_DAYS - 1)),
      now,
      now
    ).map((d) => ({ ...d, label: shortDate.format(d.date) }));

    const heatStart = addLocalDays(startOfIsoWeek(now), -(HEATMAP_WEEKS - 1) * 7);
    const heatmap = dailyHistory(
      tasks,
      heatStart,
      addLocalDays(heatStart, HEATMAP_WEEKS * 7 - 1),
      now
    );

    const tracked = recent.filter((d) => d.total > 0);
    const done = tracked.reduce((n, d) => n + d.completed, 0);
    const possible = tracked.reduce((n, d) => n + d.total, 0);
    const perfectDays = tracked.filter((d) => d.rate === 100).length;

    // Consecutive perfect days ending today (or yesterday if today is not done yet).
    const todayKey = localDateKey(now);
    let perfectStreak = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      const d = recent[i];
      if (d.rate === 100) perfectStreak++;
      else if (d.key === todayKey) continue;
      else break;
    }

    return {
      recent,
      heatmap,
      summary: {
        rate: possible === 0 ? null : Math.round((done / possible) * 100),
        perfectDays,
        perfectStreak,
        hasData: tracked.length > 0,
      },
    };
  }, [tasks]);

  const hasDaily = tasks.some((t) => t.frequency === "daily");

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>
          How many of your daily routines you completed each day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasDaily || !summary.hasData ? (
          <p className="text-sm text-muted-foreground">
            Add a daily routine and check it off to start building history.
          </p>
        ) : (
          <div className="space-y-6">
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Last {CHART_DAYS} days
                </dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {summary.rate ?? 0}%
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Perfect days</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {summary.perfectDays}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Perfect-day streak
                </dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {summary.perfectStreak}
                </dd>
              </div>
            </dl>

            <section aria-label={`Daily completion, last ${CHART_DAYS} days`}>
              <h3 className="text-sm font-medium mb-2">
                Daily completion, last {CHART_DAYS} days
              </h3>
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-48 w-full"
              >
                <BarChart data={recent} margin={{ left: -16, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <ChartTooltip cursor content={<HistoryTooltip />} />
                  <Bar
                    dataKey="rate"
                    fill="var(--color-rate)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={16}
                  />
                </BarChart>
              </ChartContainer>
            </section>

            <section aria-label={`Last ${HEATMAP_WEEKS} weeks`}>
              <h3 className="text-sm font-medium mb-2">
                Last {HEATMAP_WEEKS} weeks
              </h3>
              <div className="flex gap-2 overflow-x-auto">
                <div
                  className="grid grid-rows-7 gap-1 text-[10px] leading-3 text-muted-foreground"
                  aria-hidden
                >
                  {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
                    <span key={i} className="h-3">
                      {d}
                    </span>
                  ))}
                </div>
                <div
                  className="grid grid-flow-col grid-rows-7 gap-1"
                  role="list"
                >
                  {heatmap.map((day) => {
                    const level = heatLevel(day.rate);
                    return (
                      <div
                        key={day.key}
                        role="listitem"
                        title={describeDay(day)}
                        aria-label={describeDay(day)}
                        className={cn(
                          "h-3 w-3 rounded-[3px]",
                          day.isFuture
                            ? "border border-dashed border-border"
                            : level === 0 && "bg-muted",
                          day.key === localDateKey() &&
                            "ring-1 ring-foreground/60"
                        )}
                        style={heatStyle(level)}
                      />
                    );
                  })}
                </div>
              </div>
              <div
                className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"
                aria-hidden
              >
                <span className="mr-1">Less</span>
                {LEVEL_MIX.map((_, level) => (
                  <span
                    key={level}
                    className={cn(
                      "h-3 w-3 rounded-[3px]",
                      level === 0 && "bg-muted"
                    )}
                    style={heatStyle(level)}
                  />
                ))}
                <span className="ml-1">More</span>
              </div>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
