export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  /** Local calendar date the task is due, "YYYY-MM-DD". Optional. */
  dueDate?: string;
  /** Local time of day it is due, "HH:MM". Only meaningful with dueDate. */
  dueTime?: string;
  /** Missing means "no priority". */
  priority?: TodoPriority;
  /**
   * Minutes before the due moment to send a reminder (0 = at the due time).
   * Missing means no reminder. Only meaningful with dueDate; a date without a
   * time is treated as due at DEFAULT_DUE_TIME for reminders.
   */
  reminderMinutes?: number;
}

/** Fields that can be set when creating or editing a todo. */
export type TodoDetails = Pick<
  Todo,
  "dueDate" | "dueTime" | "priority" | "reminderMinutes"
>;

/**
 * Patch for updateTodo. A key that is present replaces the value; a key set
 * to undefined clears it; a missing key leaves the value unchanged.
 */
export type TodoPatch = Partial<Pick<Todo, "text"> & TodoDetails>;
