import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Todo, useTodo } from "@/contexts/TodoContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Bell,
  CalendarClock,
  Flag,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  EMPTY_DETAILS,
  TodoDetailsFields,
  TodoDetailsValues,
  detailsFromTodo,
  sameDetails,
  toTodoDetails,
} from "@/components/todo/TodoDetailsFields";
import {
  readHighlightState,
  useLocationHighlight,
} from "@/hooks/useLocationHighlight";
import {
  DUE_GROUP_LABELS,
  DUE_GROUP_ORDER,
  DueGroup,
  PRIORITIES,
  PRIORITY_LABELS,
  compareByDue,
  compareByPriority,
  dueGroup,
  formatDue,
  isOverdue,
  reminderLabel,
  todoReminderAt,
} from "@/lib/todoDates";
import { STORAGE_KEYS, readString, writeString } from "@/lib/storage";
import type { TodoPriority } from "@/types/todo";

type SortMode = "due" | "priority" | "created";

const SORT_LABELS: Record<SortMode, string> = {
  due: "Group by due date",
  priority: "Group by priority",
  created: "Order added",
};

function isSortMode(value: unknown): value is SortMode {
  return value === "due" || value === "priority" || value === "created";
}

function readSortMode(): SortMode {
  const stored = readString(STORAGE_KEYS.todoSort);
  return isSortMode(stored) ? stored : "due";
}

/**
 * Current time, refreshed every minute so "Overdue"/"Today" stay correct.
 * While `paused` the value is frozen (so an open inline edit isn't moved into
 * another due-date group and remounted); it catches up when unpaused.
 */
function useNow(paused = false, intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (paused) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    const onFocus = () => setNow(new Date());
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [paused, intervalMs]);
  return now;
}

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: "text-destructive",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-sky-600 dark:text-sky-400",
};

const PRIORITY_BORDER: Record<TodoPriority, string> = {
  high: "border-l-4 border-l-destructive",
  medium: "border-l-4 border-l-amber-500",
  low: "border-l-4 border-l-sky-500",
};

function TodoMeta({ todo, now }: { todo: Todo; now: Date }) {
  const overdue = isOverdue(todo, now);
  const reminderAt = todoReminderAt(todo);
  if (!todo.dueDate && !todo.priority) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {todo.priority && (
        <span
          className={cn("inline-flex items-center gap-1", PRIORITY_STYLES[todo.priority])}
        >
          <Flag className="h-3 w-3" aria-hidden />
          {PRIORITY_LABELS[todo.priority]}
        </span>
      )}
      {todo.dueDate && (
        <span
          className={cn(
            "inline-flex items-center gap-1",
            overdue && "font-medium text-destructive"
          )}
        >
          {overdue ? (
            <AlertCircle className="h-3 w-3" aria-hidden />
          ) : (
            <CalendarClock className="h-3 w-3" aria-hidden />
          )}
          {overdue ? "Overdue · " : "Due "}
          {formatDue(todo, now)}
        </span>
      )}
      {reminderAt && todo.reminderMinutes !== undefined && !todo.completed && (
        <span
          className="inline-flex items-center gap-1"
          title={`Reminder: ${reminderAt.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}`}
        >
          <Bell className="h-3 w-3" aria-hidden />
          {todo.dueTime
            ? reminderLabel(todo.reminderMinutes)
            : reminderAt.toLocaleString(undefined, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
        </span>
      )}
    </div>
  );
}

interface TodoItemProps {
  todo: Todo;
  now: Date;
  isEditing: boolean;
  onToggle: (id: string) => void;
  onDelete: (todo: Todo) => void;
  onStartEdit: (id: string) => void;
  onSave: (todo: Todo, text: string, details: TodoDetailsValues) => void;
  onCancelEdit: () => void;
}

/** Declared at module scope so typing in the edit field never remounts it. */
function TodoItem({
  todo,
  now,
  isEditing,
  onToggle,
  onDelete,
  onStartEdit,
  onSave,
  onCancelEdit,
}: TodoItemProps) {
  const [editText, setEditText] = useState(todo.text);
  const [editDetails, setEditDetails] = useState<TodoDetailsValues>(() =>
    detailsFromTodo(todo)
  );

  const startEditing = () => {
    setEditText(todo.text);
    setEditDetails(detailsFromTodo(todo));
    onStartEdit(todo.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = editText.trim();
    if (!text) return;
    if (text === todo.text && sameDetails(editDetails, detailsFromTodo(todo)))
      onCancelEdit();
    else onSave(todo, text, editDetails);
  };

  const overdue = isOverdue(todo, now);

  return (
    <div
      id={`todo-row-${todo.id}`}
      className={cn(
        "flex items-start gap-2 p-3 bg-card rounded-lg border transition-all duration-300 ease-in-out hover:shadow-md",
        todo.completed ? "opacity-80 hover:opacity-100" : "opacity-100",
        !todo.completed && todo.priority && PRIORITY_BORDER[todo.priority],
        overdue && "bg-destructive/5 border-destructive/40"
      )}
    >
      <div className="pt-2.5 transition-all duration-300 hover:scale-110">
        <Checkbox
          checked={todo.completed}
          onCheckedChange={() => onToggle(todo.id)}
          aria-label={
            todo.completed ? `Mark "${todo.text}" as not done` : `Mark "${todo.text}" as done`
          }
        />
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-2">
          <div className="flex gap-2">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              className="flex-1"
              aria-label="Edit task"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={!editText.trim()}
              aria-label="Save"
              title="Save (Enter)"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onCancelEdit}
              aria-label="Cancel"
              title="Cancel (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <TodoDetailsFields
            idPrefix={`edit-${todo.id}`}
            values={editDetails}
            onChange={setEditDetails}
          />
        </form>
      ) : (
        <>
          <div className="flex-1 min-w-0 space-y-1 py-1.5">
            <span
              className={cn(
                "block break-words transition-all duration-300",
                todo.completed && "line-through text-muted-foreground translate-x-1"
              )}
              onDoubleClick={startEditing}
            >
              {todo.text}
            </span>
            <TodoMeta todo={todo} now={now} />
          </div>
          <div className="flex gap-1 transition-opacity duration-200 opacity-70 hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              onClick={startEditing}
              aria-label={`Edit "${todo.text}"`}
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(todo)}
              aria-label={`Delete "${todo.text}"`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface TodoGroup {
  key: string;
  label: string;
  todos: Todo[];
  tone?: "danger";
}

function groupTodos(todos: Todo[], mode: SortMode, now: Date): TodoGroup[] {
  if (mode === "created") {
    return [
      {
        key: "all",
        label: "",
        todos: [...todos].sort((a, b) => a.createdAt - b.createdAt),
      },
    ];
  }

  if (mode === "priority") {
    const keys: (TodoPriority | "none")[] = [...PRIORITIES, "none"];
    return keys
      .map((key) => ({
        key,
        label: key === "none" ? "No priority" : `${PRIORITY_LABELS[key]} priority`,
        todos: todos
          .filter((t) => (t.priority ?? "none") === key)
          .sort(compareByPriority),
      }))
      .filter((g) => g.todos.length > 0);
  }

  const buckets = new Map<DueGroup, Todo[]>();
  todos.forEach((todo) => {
    const group = dueGroup(todo, now);
    buckets.set(group, [...(buckets.get(group) ?? []), todo]);
  });
  return DUE_GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => ({
    key: g,
    label: DUE_GROUP_LABELS[g],
    // Within a day, priority matters more than a few hours' difference.
    todos: buckets
      .get(g)!
      .sort(g === "none" || g === "today" ? compareByPriority : compareByDue),
    tone: g === "overdue" ? "danger" : undefined,
  }));
}

export default function TodoPage() {
  const {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    clearCompleted,
    restoreTodos,
  } = useTodo();
  const [newTodo, setNewTodo] = useState("");
  const [newDetails, setNewDetails] = useState<TodoDetailsValues>(EMPTY_DETAILS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const now = useNow(editingId !== null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(readSortMode);
  const newTodoInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  // Opened from the command palette / Mod+Shift+N: focus the new-task input.
  const focusTarget = readHighlightState(location.state).focus;
  useEffect(() => {
    if (focusTarget === "new-todo") newTodoInputRef.current?.focus();
  }, [focusTarget, location.key]);

  // Opened from a search result: expand "Completed" if needed, then flash the row.
  const highlightId = useLocationHighlight("todo-row-");
  useEffect(() => {
    if (highlightId && todos.some((t) => t.id === highlightId && t.completed)) {
      setShowCompleted(true);
    }
  }, [highlightId, todos]);

  const activeTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => todo.completed);
  const overdueCount = activeTodos.filter((t) => isOverdue(t, now)).length;

  const groups = useMemo(
    () =>
      groupTodos(
        todos.filter((todo) => !todo.completed),
        sortMode,
        now
      ),
    [todos, sortMode, now]
  );

  const changeSort = (value: string) => {
    if (!isSortMode(value)) return;
    setSortMode(value);
    writeString(STORAGE_KEYS.todoSort, value);
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      addTodo(newTodo.trim(), toTodoDetails(newDetails));
      setNewTodo("");
      // Keep the priority for quick entry of several similar tasks.
      setNewDetails({ ...EMPTY_DETAILS, priority: newDetails.priority });
    }
  };

  const handleSave = (todo: Todo, text: string, details: TodoDetailsValues) => {
    updateTodo(todo.id, { text, ...toTodoDetails(details) });
    setEditingId(null);
  };

  const handleDelete = (todo: Todo) => {
    deleteTodo(todo.id);
    if (editingId === todo.id) setEditingId(null);
    toast("Task deleted", {
      action: { label: "Undo", onClick: () => restoreTodos([todo]) },
    });
  };

  const handleClearCompleted = () => {
    const removed = clearCompleted();
    if (removed.length === 0) return;
    toast(
      `Cleared ${removed.length} completed ${removed.length === 1 ? "task" : "tasks"}`,
      { action: { label: "Undo", onClick: () => restoreTodos(removed) } }
    );
  };

  const renderItem = (todo: Todo) => (
    <TodoItem
      key={todo.id}
      todo={todo}
      now={now}
      isEditing={editingId === todo.id}
      onToggle={toggleTodo}
      onDelete={handleDelete}
      onStartEdit={setEditingId}
      onSave={handleSave}
      onCancelEdit={() => setEditingId(null)}
    />
  );

  return (
    <PageLayout title="Todo List">
      <div className="flex flex-col h-full">
        <form onSubmit={handleAddTodo} className="mb-6 space-y-2">
          <div className="flex gap-2">
            <Input
              ref={newTodoInputRef}
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1"
              aria-label="New task"
            />
            <Button type="submit">Add</Button>
          </div>
          <TodoDetailsFields
            idPrefix="new-todo"
            values={newDetails}
            onChange={setNewDetails}
          />
        </form>

        {activeTodos.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {activeTodos.length} open
              {overdueCount > 0 && (
                <span className="text-destructive font-medium">
                  {" "}
                  · {overdueCount} overdue
                </span>
              )}
            </p>
            <Select value={sortMode} onValueChange={changeSort}>
              <SelectTrigger size="sm" className="w-[180px]" aria-label="Sort tasks">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {SORT_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2" aria-label={group.label || "Tasks"}>
              {group.label && (
                <h2
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    group.tone === "danger" && "text-destructive"
                  )}
                >
                  {group.label} ({group.todos.length})
                </h2>
              )}
              {group.todos.map(renderItem)}
            </section>
          ))}

          {completedTodos.length > 0 && (
            <Collapsible
              open={showCompleted}
              onOpenChange={setShowCompleted}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 transition-colors duration-200"
                  >
                    <span className="text-muted-foreground">
                      Completed ({completedTodos.length})
                    </span>
                    {showCompleted ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive transition-colors duration-200"
                  onClick={handleClearCompleted}
                >
                  Clear Completed
                </Button>
              </div>

              {/* Radix unmounts closed content, so hidden rows take no space
                  and cannot be clicked or focused. */}
              <CollapsibleContent className="space-y-2">
                {completedTodos.map(renderItem)}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
