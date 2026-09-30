import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import {
  STORAGE_KEYS,
  isBoolean,
  isNumber,
  isRecord,
  isString,
  readJsonArray,
  writeJson,
} from "@/lib/storage";

import type { Todo, TodoDetails, TodoPatch } from "@/types/todo";
import {
  isDateKey,
  isPriority,
  isReminderMinutes,
  isTimeKey,
} from "@/lib/todoDates";

export type { Todo, TodoDetails, TodoPatch, TodoPriority } from "@/types/todo";

interface TodoContextType {
  todos: Todo[];
  addTodo: (text: string, details?: TodoDetails) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  /** Merges `patch` into the todo (see TodoPatch for clearing fields). */
  updateTodo: (id: string, patch: TodoPatch) => void;
  /** Removes every completed todo and returns them (for undo). */
  clearCompleted: () => Todo[];
  /** Puts previously removed todos back, keeping their original order. */
  restoreTodos: (items: Todo[]) => void;
}

function isTodo(value: unknown): value is Todo {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.text) &&
    isBoolean(value.completed) &&
    isNumber(value.createdAt)
  );
}

/**
 * Keep only valid optional fields. Invalid or orphaned values (e.g. a time or
 * reminder without a due date) are dropped instead of dropping the whole todo,
 * so todos saved before due dates existed load unchanged.
 */
function normalizeTodo(todo: Todo): Todo {
  const result: Todo = {
    id: todo.id,
    text: todo.text,
    completed: todo.completed,
    createdAt: todo.createdAt,
  };
  if (isPriority(todo.priority)) result.priority = todo.priority;
  if (isDateKey(todo.dueDate)) {
    result.dueDate = todo.dueDate;
    if (isTimeKey(todo.dueTime)) result.dueTime = todo.dueTime;
    if (isReminderMinutes(todo.reminderMinutes))
      result.reminderMinutes = todo.reminderMinutes;
  }
  return result;
}

function applyPatch(todo: Todo, patch: TodoPatch): Todo {
  const merged: Todo = { ...todo };
  (Object.keys(patch) as (keyof TodoPatch)[]).forEach((key) => {
    const value = patch[key];
    if (value === undefined) {
      if (key !== "text") delete merged[key];
    } else {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  });
  return normalizeTodo(merged);
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

export function TodoProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>(() =>
    readJsonArray(STORAGE_KEYS.todos, isTodo).map(normalizeTodo)
  );

  // Latest todos, so clearCompleted can return what it removed.
  const todosRef = useRef(todos);
  todosRef.current = todos;

  useEffect(() => {
    writeJson(STORAGE_KEYS.todos, todos);
  }, [todos]);

  const addTodo = useCallback((text: string, details?: TodoDetails) => {
    const now = Date.now();
    const base: Todo = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${now}-${Math.random().toString(36).slice(2)}`,
      text,
      completed: false,
      createdAt: now,
    };
    const newTodo = details ? applyPatch(base, details) : base;
    setTodos((prev) => [...prev, newTodo]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  const updateTodo = useCallback((id: string, patch: TodoPatch) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? applyPatch(todo, patch) : todo))
    );
  }, []);

  const clearCompleted = useCallback(() => {
    const removed = todosRef.current.filter((todo) => todo.completed);
    if (removed.length > 0) {
      setTodos((prev) => prev.filter((todo) => !todo.completed));
    }
    return removed;
  }, []);

  const restoreTodos = useCallback((items: Todo[]) => {
    setTodos((prev) => {
      const existing = new Set(prev.map((todo) => todo.id));
      const missing = items.filter((todo) => !existing.has(todo.id));
      if (missing.length === 0) return prev;
      return [...prev, ...missing].sort((a, b) => a.createdAt - b.createdAt);
    });
  }, []);

  const value = useMemo(
    () => ({
      todos,
      addTodo,
      toggleTodo,
      deleteTodo,
      updateTodo,
      clearCompleted,
      restoreTodos,
    }),
    [todos, addTodo, toggleTodo, deleteTodo, updateTodo, clearCompleted, restoreTodos]
  );

  return (
    <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
  );
}

export function useTodo() {
  const context = useContext(TodoContext);
  if (context === undefined) {
    throw new Error("useTodo must be used within a TodoProvider");
  }
  return context;
}
