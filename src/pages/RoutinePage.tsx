import React, { Suspense, lazy } from "react";
import { useRoutine } from "../contexts/RoutineContext";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProgressCard } from "@/components/routines/ProgressCard";
import { FrequencySection } from "@/components/routines/FrequencySection";
import { useLocationHighlight } from "@/hooks/useLocationHighlight";

// recharts is large; load the history view (and the chart library) on demand.
const RoutineHistoryCard = lazy(() =>
  import("@/components/routines/RoutineHistoryCard").then((m) => ({
    default: m.RoutineHistoryCard,
  }))
);

const RoutinePage: React.FC = () => {
  const { tasks, toggleTask, stats } = useRoutine();
  // Opened from a search result: scroll to and flash that routine.
  useLocationHighlight("routine-row-");

  const dailyTasks = tasks.filter((task) => task.frequency === "daily");
  const weeklyTasks = tasks.filter((task) => task.frequency === "weekly");
  const monthlyTasks = tasks.filter((task) => task.frequency === "monthly");

  return (
    <PageLayout
      title="My Routines"
      headerActions={
        <Link to="/routines/manage">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Manage Routines
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6">
        {/* Progress Dashboard */}
        <div className="grid gap-4 md:grid-cols-3">
          <ProgressCard title="Daily Progress" emoji="🎉" {...stats.daily} />
          <ProgressCard title="Weekly Progress" emoji="🌟" {...stats.weekly} />
          <ProgressCard title="Monthly Progress" emoji="🏆" {...stats.monthly} />
        </div>

        {/* Task Lists */}
        <div className="grid gap-6">
          <FrequencySection
            frequency="daily"
            tasks={dailyTasks}
            onToggle={toggleTask}
          />
          <FrequencySection
            frequency="weekly"
            tasks={weeklyTasks}
            onToggle={toggleTask}
          />
          <FrequencySection
            frequency="monthly"
            tasks={monthlyTasks}
            onToggle={toggleTask}
          />
        </div>

        <Suspense
          fallback={<div className="h-64 rounded-xl border bg-card animate-pulse" />}
        >
          <RoutineHistoryCard tasks={tasks} />
        </Suspense>
      </div>
    </PageLayout>
  );
};

export default RoutinePage;
