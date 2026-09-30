export type RoutineFrequency = "daily" | "weekly" | "monthly";

export interface RoutineTask {
  id: string;
  title: string;
  description?: string;
  frequency: RoutineFrequency;
  /** Whether the task is done for the CURRENT period (reset each period). */
  completed: boolean;
  /**
   * Local period keys (see src/lib/routineDates.ts) of every period in which
   * the task was completed: "YYYY-MM-DD" (daily), "YYYY-Www" (weekly) or
   * "YYYY-MM" (monthly). Sorted ascending. Optional in storage for data saved
   * before history existed.
   */
  completions: string[];
  /**
   * Local time of day ("HH:MM") to send a reminder while the task is not done
   * for the current period. Missing means no reminder.
   */
  reminderTime?: string;
  /**
   * Which day of the period the reminder is for: weekday 0-6 (0 = Sunday) for
   * weekly routines, day of month 1-31 (clamped to the month length) for
   * monthly ones. Ignored for daily routines. Defaults: Monday / the 1st.
   */
  reminderDay?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RoutineTaskInput = Pick<
  RoutineTask,
  "title" | "description" | "frequency" | "reminderTime" | "reminderDay"
>;

/**
 * Missing keys leave a value unchanged. `reminderTime: ""` clears the
 * reminder.
 */
export type RoutineTaskPatch = Partial<RoutineTaskInput>;

export interface RoutineStats {
  daily: {
    completed: number;
    total: number;
  };
  weekly: {
    completed: number;
    total: number;
  };
  monthly: {
    completed: number;
    total: number;
  };
}
