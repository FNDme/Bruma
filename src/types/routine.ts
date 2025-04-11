export type RoutineFrequency = "daily" | "weekly" | "monthly";

export interface RoutineTask {
  id: string;
  title: string;
  description?: string;
  frequency: RoutineFrequency;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineProgress {
  date: string;
  completedTasks: number;
  totalTasks: number;
}

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
