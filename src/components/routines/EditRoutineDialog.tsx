import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoutine } from "@/contexts/RoutineContext";
import type { RoutineTask } from "@/types/routine";
import { RoutineFormFields, RoutineFormValues } from "./RoutineFormFields";

interface EditRoutineDialogProps {
  task: RoutineTask | null;
  onOpenChange: (open: boolean) => void;
}

export function EditRoutineDialog({ task, onOpenChange }: EditRoutineDialogProps) {
  const { updateTask } = useRoutine();
  const [values, setValues] = useState<RoutineFormValues>({
    title: "",
    description: "",
    frequency: "daily",
    reminderTime: "",
  });

  useEffect(() => {
    if (task) {
      setValues({
        title: task.title,
        description: task.description ?? "",
        frequency: task.frequency,
        reminderTime: task.reminderTime ?? "",
        reminderDay: task.reminderDay,
      });
    }
  }, [task]);

  const frequencyChanged = !!task && values.frequency !== task.frequency;
  const losesHistory = frequencyChanged && (task?.completions.length ?? 0) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!values.title.trim()) {
      toast.error("Title is required");
      return;
    }
    updateTask(task.id, values);
    toast.success("Routine updated");
    onOpenChange(false);
  };

  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit routine</DialogTitle>
            <DialogDescription>
              Change the title, description, how often it repeats or its reminder.
            </DialogDescription>
          </DialogHeader>
          <RoutineFormFields
            idPrefix="edit-routine"
            values={values}
            onChange={setValues}
            autoFocus
          />
          {losesHistory && (
            <p className="text-sm text-destructive" role="alert">
              Changing the frequency clears this routine's streak and history.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
