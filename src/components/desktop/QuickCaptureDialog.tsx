import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ListPlus, NotebookPen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTodo } from "@/contexts/TodoContext";
import { useJournal } from "@/contexts/JournalContext";
import { errorMessage } from "@/lib/utils";
import { Kbd } from "@/components/command/ShortcutsList";

export type QuickCaptureKind = "todo" | "note";

interface QuickCaptureDialogProps {
  open: boolean;
  kind: QuickCaptureKind;
  onKindChange: (kind: QuickCaptureKind) => void;
  /** `saved` is true when something was captured */
  onClose: (saved: boolean) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text to the editor's HTML: one paragraph per line. */
export function plainTextToNoteHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return lines
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p></p>"))
    .join("");
}

/**
 * Small capture form opened from the tray menu or the global shortcut.
 * Todos go to the list, notes are saved unfiled at the top of the collection.
 */
export function QuickCaptureDialog({
  open,
  kind,
  onKindChange,
  onClose,
}: QuickCaptureDialogProps) {
  const { addTodo } = useTodo();
  const { saveNote } = useJournal();
  const navigate = useNavigate();
  const [todoText, setTodoText] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const todoInput = useRef<HTMLInputElement>(null);
  const noteTitleInput = useRef<HTMLInputElement>(null);

  // Focus the first field whenever the dialog opens or the kind changes
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      (kind === "todo" ? todoInput : noteTitleInput).current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, kind]);

  const reset = () => {
    setTodoText("");
    setNoteTitle("");
    setNoteBody("");
  };

  const close = (saved: boolean) => {
    if (saved) reset();
    onClose(saved);
  };

  const saveTodo = () => {
    const text = todoText.trim();
    if (!text) {
      toast.error("Type the task first");
      return;
    }
    addTodo(text);
    toast.success("Todo added", {
      description: text,
      action: { label: "View", onClick: () => navigate("/todo") },
    });
    close(true);
  };

  const saveQuickNote = async () => {
    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!title && !body) {
      toast.error("Write something first");
      return;
    }
    setSaving(true);
    try {
      const note = await saveNote(
        title || "Quick note",
        "",
        body ? plainTextToNoteHtml(body) : "<p></p>"
      );
      toast.success("Note saved", {
        description: note.title,
        action: {
          label: "Open",
          onClick: () => navigate(`/collection/${note.id}`),
        },
      });
      close(true);
    } catch (error) {
      // Keep the text in the form so nothing is lost
      toast.error(errorMessage(error, "Could not save the note"));
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (kind === "todo") saveTodo();
    else void saveQuickNote();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close(false)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Quick capture</DialogTitle>
            <DialogDescription>
              Jot something down without leaving what you are doing.
            </DialogDescription>
          </DialogHeader>

          <ToggleGroup
            type="single"
            variant="outline"
            value={kind}
            onValueChange={(value) => {
              if (value === "todo" || value === "note") onKindChange(value);
            }}
            aria-label="What to capture"
          >
            <ToggleGroupItem value="todo" className="px-4">
              <ListPlus className="h-4 w-4" />
              Todo
            </ToggleGroupItem>
            <ToggleGroupItem value="note" className="px-4">
              <NotebookPen className="h-4 w-4" />
              Note
            </ToggleGroupItem>
          </ToggleGroup>

          {kind === "todo" ? (
            <div className="space-y-2">
              <Label htmlFor="quick-todo">Task</Label>
              <Input
                id="quick-todo"
                ref={todoInput}
                value={todoText}
                onChange={(e) => setTodoText(e.target.value)}
                placeholder="What needs doing?"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Add a due date or reminder later from the Todo list.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="quick-note-title">Title</Label>
                <Input
                  id="quick-note-title"
                  ref={noteTitleInput}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Quick note"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-note-body">Note</Label>
                <Textarea
                  id="quick-note-body"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void saveQuickNote();
                    }
                  }}
                  rows={6}
                  placeholder="Write your thoughts…"
                />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Saved to Unfiled notes. Press <Kbd combo="mod+enter" /> to
                  save.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {kind === "todo" ? "Add todo" : "Save note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
