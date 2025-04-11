import React from "react";
import { useRoutine } from "../contexts/RoutineContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Progress } from "../components/ui/progress";

const RoutinePage: React.FC = () => {
  const { tasks, toggleTask, stats } = useRoutine();

  const dailyTasks = tasks.filter((task) => task.frequency === "daily");
  const weeklyTasks = tasks.filter((task) => task.frequency === "weekly");
  const monthlyTasks = tasks.filter((task) => task.frequency === "monthly");

  const calculatePercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

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
          <Card
            className={
              stats.daily.completed === stats.daily.total &&
              stats.daily.total > 0
                ? "border-green-500 shadow-lg transition-all duration-300"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Daily Progress
                {stats.daily.completed === stats.daily.total &&
                  stats.daily.total > 0 && (
                    <span className="text-green-500">🎉</span>
                  )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {stats.daily.completed} of {stats.daily.total} tasks
                    completed
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      stats.daily.completed === stats.daily.total &&
                      stats.daily.total > 0
                        ? "text-green-500"
                        : ""
                    }`}
                  >
                    {calculatePercentage(
                      stats.daily.completed,
                      stats.daily.total
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={calculatePercentage(
                    stats.daily.completed,
                    stats.daily.total
                  )}
                  className={`h-2 ${
                    stats.daily.completed === stats.daily.total &&
                    stats.daily.total > 0
                      ? "bg-green-500/20 [&>div]:bg-green-500"
                      : ""
                  }`}
                />
              </div>
            </CardContent>
          </Card>

          <Card
            className={
              stats.weekly.completed === stats.weekly.total &&
              stats.weekly.total > 0
                ? "border-green-500 shadow-lg transition-all duration-300"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Weekly Progress
                {stats.weekly.completed === stats.weekly.total &&
                  stats.weekly.total > 0 && (
                    <span className="text-green-500">🌟</span>
                  )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {stats.weekly.completed} of {stats.weekly.total} tasks
                    completed
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      stats.weekly.completed === stats.weekly.total &&
                      stats.weekly.total > 0
                        ? "text-green-500"
                        : ""
                    }`}
                  >
                    {calculatePercentage(
                      stats.weekly.completed,
                      stats.weekly.total
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={calculatePercentage(
                    stats.weekly.completed,
                    stats.weekly.total
                  )}
                  className={`h-2 ${
                    stats.weekly.completed === stats.weekly.total &&
                    stats.weekly.total > 0
                      ? "bg-green-500/20 [&>div]:bg-green-500"
                      : ""
                  }`}
                />
              </div>
            </CardContent>
          </Card>

          <Card
            className={
              stats.monthly.completed === stats.monthly.total &&
              stats.monthly.total > 0
                ? "border-green-500 shadow-lg transition-all duration-300"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Monthly Progress
                {stats.monthly.completed === stats.monthly.total &&
                  stats.monthly.total > 0 && (
                    <span className="text-green-500">🏆</span>
                  )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {stats.monthly.completed} of {stats.monthly.total} tasks
                    completed
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      stats.monthly.completed === stats.monthly.total &&
                      stats.monthly.total > 0
                        ? "text-green-500"
                        : ""
                    }`}
                  >
                    {calculatePercentage(
                      stats.monthly.completed,
                      stats.monthly.total
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={calculatePercentage(
                    stats.monthly.completed,
                    stats.monthly.total
                  )}
                  className={`h-2 ${
                    stats.monthly.completed === stats.monthly.total &&
                    stats.monthly.total > 0
                      ? "bg-green-500/20 [&>div]:bg-green-500"
                      : ""
                  }`}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Lists */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dailyTasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={task.id}
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    <label
                      htmlFor={task.id}
                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        task.completed ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {task.title}
                    </label>
                  </div>
                ))}
                {dailyTasks.length === 0 && (
                  <p className="text-sm text-gray-500">No daily tasks set</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weeklyTasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={task.id}
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    <label
                      htmlFor={task.id}
                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        task.completed ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {task.title}
                    </label>
                  </div>
                ))}
                {weeklyTasks.length === 0 && (
                  <p className="text-sm text-gray-500">No weekly tasks set</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyTasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={task.id}
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    <label
                      htmlFor={task.id}
                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        task.completed ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {task.title}
                    </label>
                  </div>
                ))}
                {monthlyTasks.length === 0 && (
                  <p className="text-sm text-gray-500">No monthly tasks set</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default RoutinePage;
