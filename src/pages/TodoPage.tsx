import { useState } from "react";
import { useTodo } from "@/contexts/TodoContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/layout/PageLayout";

export default function TodoPage() {
  const { todos, addTodo, toggleTodo, deleteTodo, updateTodo } = useTodo();
  const [newTodo, setNewTodo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const activeTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => todo.completed);

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      addTodo(newTodo.trim());
      setNewTodo("");
    }
  };

  const startEditing = (todo: { id: string; text: string }) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const handleUpdateTodo = (id: string) => {
    if (editText.trim()) {
      updateTodo(id, editText.trim());
      setEditingId(null);
    }
  };

  const clearCompleted = () => {
    completedTodos.forEach((todo) => deleteTodo(todo.id));
  };

  const TodoItem = ({ todo }: { todo: (typeof todos)[0] }) => {
    return (
      <div
        key={todo.id}
        className={cn(
          "flex items-center gap-2 p-3 bg-card rounded-lg border transition-all duration-300 ease-in-out hover:shadow-md",
          todo.completed ? "opacity-80 hover:opacity-100" : "opacity-100"
        )}
      >
        <div className="transition-all duration-300 hover:scale-110">
          <Checkbox
            checked={todo.completed}
            onCheckedChange={() => toggleTodo(todo.id)}
          />
        </div>

        {editingId === todo.id ? (
          <div className="flex-1 flex gap-2">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleUpdateTodo(todo.id)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditingId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <span
              className={`flex-1 transition-all duration-300 ${
                todo.completed
                  ? "line-through text-muted-foreground translate-x-1"
                  : ""
              }`}
            >
              {todo.text}
            </span>
            <div className="flex gap-1 transition-opacity duration-200 opacity-70 hover:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => startEditing(todo)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteTodo(todo.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <PageLayout title="Todo List">
      <div className="flex flex-col h-full">
        <form onSubmit={handleAddTodo} className="mb-6 flex gap-2">
          <Input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1"
          />
          <Button type="submit">Add</Button>
        </form>

        <div className="space-y-4">
          <div className="space-y-2">
            {activeTodos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </div>

          {completedTodos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 transition-colors duration-200"
                  onClick={() => setShowCompleted(!showCompleted)}
                >
                  <span className="text-muted-foreground">
                    Completed ({completedTodos.length})
                  </span>
                  <div className="transition-transform duration-200">
                    {showCompleted ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive transition-colors duration-200"
                  onClick={clearCompleted}
                >
                  Clear Completed
                </Button>
              </div>

              <div
                className={`space-y-2 transition-all duration-300 ease-in-out ${
                  showCompleted
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-2"
                }`}
              >
                {completedTodos.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
