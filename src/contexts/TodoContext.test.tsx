import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodoProvider, useTodo } from "./TodoContext";
import { STORAGE_KEYS } from "@/lib/storage";

const wrapper = ({ children }: { children: ReactNode }) => (
  <TodoProvider>{children}</TodoProvider>
);
const render = () => renderHook(() => useTodo(), { wrapper });
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.todos)!);

describe("TodoContext", () => {
  it("adds, toggles and deletes todos and persists them", () => {
    const { result } = render();
    act(() => result.current.addTodo("Buy milk"));
    expect(result.current.todos).toHaveLength(1);
    const todo = result.current.todos[0];
    expect(todo).toMatchObject({ text: "Buy milk", completed: false });
    expect(typeof todo.id).toBe("string");
    expect(stored()).toHaveLength(1);

    act(() => result.current.toggleTodo(todo.id));
    expect(result.current.todos[0].completed).toBe(true);
    expect(stored()[0].completed).toBe(true);

    act(() => result.current.deleteTodo(todo.id));
    expect(result.current.todos).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("gives every todo a unique id", () => {
    const { result } = render();
    act(() => {
      result.current.addTodo("a");
      result.current.addTodo("b");
      result.current.addTodo("c");
    });
    const ids = new Set(result.current.todos.map((t) => t.id));
    expect(ids.size).toBe(3);
  });

  it("stores details and clears fields patched to undefined", () => {
    const { result } = render();
    act(() =>
      result.current.addTodo("Report", {
        dueDate: "2024-05-01",
        dueTime: "09:30",
        priority: "high",
        reminderMinutes: 15,
      })
    );
    const id = result.current.todos[0].id;
    expect(result.current.todos[0]).toMatchObject({
      dueDate: "2024-05-01",
      dueTime: "09:30",
      priority: "high",
      reminderMinutes: 15,
    });

    act(() => result.current.updateTodo(id, { text: "Final report", priority: undefined }));
    expect(result.current.todos[0].text).toBe("Final report");
    expect(result.current.todos[0].priority).toBeUndefined();
    expect(result.current.todos[0].dueDate).toBe("2024-05-01");

    // Clearing the date also drops the time and reminder that depend on it.
    act(() => result.current.updateTodo(id, { dueDate: undefined }));
    const t = result.current.todos[0];
    expect(t.dueDate).toBeUndefined();
    expect(t.dueTime).toBeUndefined();
    expect(t.reminderMinutes).toBeUndefined();
  });

  it("clearCompleted returns what it removed and restoreTodos puts it back in order", () => {
    const { result } = render();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3);
    act(() => {
      result.current.addTodo("one");
      result.current.addTodo("two");
      result.current.addTodo("three");
    });
    const [one, two] = result.current.todos;
    act(() => {
      result.current.toggleTodo(one.id);
      result.current.toggleTodo(two.id);
    });

    let removed: ReturnType<typeof result.current.clearCompleted> = [];
    act(() => {
      removed = result.current.clearCompleted();
    });
    expect(removed.map((t) => t.text)).toEqual(["one", "two"]);
    expect(result.current.todos.map((t) => t.text)).toEqual(["three"]);

    act(() => result.current.restoreTodos(removed));
    expect(result.current.todos.map((t) => t.text)).toEqual([
      "one",
      "two",
      "three",
    ]);
    // Restoring twice does not duplicate.
    act(() => result.current.restoreTodos(removed));
    expect(result.current.todos).toHaveLength(3);
  });

  it("loads old todos unchanged and drops invalid ones after backing them up", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = JSON.stringify([
      { id: "1", text: "old", completed: false, createdAt: 10 },
      { id: "2", text: "bad", completed: "yes", createdAt: 11 },
      {
        id: "3",
        text: "orphan time",
        completed: false,
        createdAt: 12,
        dueTime: "10:00",
        priority: "urgent",
      },
    ]);
    localStorage.setItem(STORAGE_KEYS.todos, raw);
    const { result } = render();
    expect(result.current.todos).toEqual([
      { id: "1", text: "old", completed: false, createdAt: 10 },
      { id: "3", text: "orphan time", completed: false, createdAt: 12 },
    ]);
    const backup = Object.keys(localStorage).find((k) =>
      k.startsWith(`${STORAGE_KEYS.todos}.corrupt-`)
    );
    expect(backup && localStorage.getItem(backup)).toBe(raw);
  });
});
