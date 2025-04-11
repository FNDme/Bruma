import React, { useState } from "react";
import { useRoutine } from "../contexts/RoutineContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Trash2,
  ArrowLeft,
  Calendar,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { RoutineFrequency } from "../types/routine";
import { PageLayout } from "@/components/layout/PageLayout";
import { Link } from "react-router-dom";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";

const ManageRoutinesPage: React.FC = () => {
  const { tasks, addTask, deleteTask } = useRoutine();
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    frequency: "daily" as RoutineFrequency,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.title.trim()) {
      addTask(newTask);
      setNewTask({
        title: "",
        description: "",
        frequency: "daily",
      });
    }
  };

  return (
    <PageLayout
      title="Manage Routines"
      headerActions={
        <Link to="/routines">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Routines
          </Button>
        </Link>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Add New Routine</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium mb-1"
                >
                  Title
                </label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  placeholder="Enter task title"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium mb-1"
                >
                  Description (Optional)
                </label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  placeholder="Enter task description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Frequency
                </label>
                <ToggleGroup
                  type="single"
                  value={newTask.frequency}
                  onValueChange={(value) =>
                    setNewTask({
                      ...newTask,
                      frequency: value as RoutineFrequency,
                    })
                  }
                >
                  <ToggleGroupItem value="daily" aria-label="Daily">
                    <Calendar className="mr-2 h-4 w-4" />
                    Daily
                  </ToggleGroupItem>
                  <ToggleGroupItem value="weekly" aria-label="Weekly">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Weekly
                  </ToggleGroupItem>
                  <ToggleGroupItem value="monthly" aria-label="Monthly">
                    <CalendarRange className="mr-2 h-4 w-4" />
                    Monthly
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button type="submit">Add Routine</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Routines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pr-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate">
                        {task.description}
                      </p>
                    )}
                    <span className="text-xs text-gray-400">
                      {task.frequency.charAt(0).toUpperCase() +
                        task.frequency.slice(1)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTask(task.id)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-gray-500">No routines set</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default ManageRoutinesPage;
