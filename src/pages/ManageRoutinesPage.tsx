import React, { useState } from "react";
import { toast } from "sonner";
import { useRoutine } from "../contexts/RoutineContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Trash2, ArrowLeft, Pencil, Bell } from "lucide-react";
import { describeRoutineReminder } from "@/lib/reminders";
import { RoutineTask } from "../types/routine";
import { PageLayout } from "@/components/layout/PageLayout";
import { Link } from "react-router-dom";
import {
  RoutineFormFields,
  RoutineFormValues,
} from "@/components/routines/RoutineFormFields";
import { EditRoutineDialog } from "@/components/routines/EditRoutineDialog";
import { StreakBadge } from "@/components/routines/StreakBadge";

const EMPTY_FORM: RoutineFormValues = {
  title: "",
  description: "",
  frequency: "daily",
  reminderTime: "",
};

const ManageRoutinesPage: React.FC = () => {
  const { tasks, addTask, deleteTask, restoreTask } = useRoutine();
  const [newTask, setNewTask] = useState<RoutineFormValues>(EMPTY_FORM);
  const [editing, setEditing] = useState<RoutineTask | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.title.trim()) {
      addTask(newTask);
      setNewTask(EMPTY_FORM);
    }
  };

  const handleDelete = (task: RoutineTask) => {
    const deleted = deleteTask(task.id);
    if (!deleted) return;
    toast(`Deleted "${task.title}"`, {
      action: { label: "Undo", onClick: () => restoreTask(deleted) },
    });
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
              <RoutineFormFields
                idPrefix="new-routine"
                values={newTask}
                onChange={setNewTask}
              />
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
                  className="flex items-center justify-between gap-2 p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="font-medium truncate">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-muted-foreground">
                        {task.frequency.charAt(0).toUpperCase() +
                          task.frequency.slice(1)}
                      </span>
                      <StreakBadge task={task} />
                      {describeRoutineReminder(task) && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Bell className="h-3 w-3" aria-hidden />
                          {describeRoutineReminder(task)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(task)}
                    className="flex-shrink-0"
                    aria-label={`Edit ${task.title}`}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(task)}
                    className="flex-shrink-0"
                    aria-label={`Delete ${task.title}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No routines set</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EditRoutineDialog
        task={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </PageLayout>
  );
};

export default ManageRoutinesPage;
