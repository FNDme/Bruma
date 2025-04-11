import React, { createContext, useContext, useState, useEffect } from "react";
import { RoutineTask, RoutineProgress, RoutineStats } from "../types/routine";
import { toast } from "sonner";

interface RoutineContextType {
  tasks: RoutineTask[];
  progress: RoutineProgress[];
  stats: RoutineStats;
  addTask: (
    task: Omit<RoutineTask, "id" | "createdAt" | "updatedAt" | "completed">
  ) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [progress, setProgress] = useState<RoutineProgress[]>([]);
  const [stats, setStats] = useState<RoutineStats>({
    daily: { completed: 0, total: 0 },
    weekly: { completed: 0, total: 0 },
    monthly: { completed: 0, total: 0 },
  });
  const [lastReset, setLastReset] = useState({
    daily: new Date().toISOString().split("T")[0],
    weekly: getWeekStartDate(),
    monthly: new Date().getMonth(),
  });

  // Helper function to get the start of the current week
  function getWeekStartDate() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  }

  // Initial load from localStorage
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem("routineTasks");
      const savedProgress = localStorage.getItem("routineProgress");
      const savedLastReset = localStorage.getItem("routineLastReset");

      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        const tasksWithDates = parsedTasks.map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
        }));
        setTasks(tasksWithDates);
      }
      if (savedProgress) {
        setProgress(JSON.parse(savedProgress));
      }
      if (savedLastReset) {
        setLastReset(JSON.parse(savedLastReset));
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
  }, []);

  // Handle task resets
  useEffect(() => {
    if (tasks.length === 0) return;

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentWeekStart = getWeekStartDate();
    const currentMonth = now.getMonth();

    const newLastReset = {
      daily: lastReset.daily !== today ? today : lastReset.daily,
      weekly:
        lastReset.weekly !== currentWeekStart
          ? currentWeekStart
          : lastReset.weekly,
      monthly:
        lastReset.monthly !== currentMonth ? currentMonth : lastReset.monthly,
    };

    if (JSON.stringify(newLastReset) !== JSON.stringify(lastReset)) {
      setLastReset(newLastReset);

      setTasks((prev) =>
        prev.map((task) => {
          let shouldReset = false;
          switch (task.frequency) {
            case "daily":
              shouldReset = lastReset.daily !== today;
              break;
            case "weekly":
              shouldReset = lastReset.weekly !== currentWeekStart;
              break;
            case "monthly":
              shouldReset = lastReset.monthly !== currentMonth;
              break;
          }
          return shouldReset
            ? { ...task, completed: false, updatedAt: new Date() }
            : task;
        })
      );
    }
  }, [lastReset]);

  // Save to localStorage
  useEffect(() => {
    if (tasks.length === 0) return;

    try {
      const tasksToStore = tasks.map((task) => ({
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }));

      localStorage.setItem("routineTasks", JSON.stringify(tasksToStore));
      localStorage.setItem("routineProgress", JSON.stringify(progress));
      localStorage.setItem("routineLastReset", JSON.stringify(lastReset));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [tasks, progress, lastReset]);

  // Update stats
  useEffect(() => {
    const newStats: RoutineStats = {
      daily: { completed: 0, total: 0 },
      weekly: { completed: 0, total: 0 },
      monthly: { completed: 0, total: 0 },
    };

    tasks.forEach((task) => {
      newStats[task.frequency].total++;
      if (task.completed) {
        newStats[task.frequency].completed++;
      }
    });

    setStats(newStats);
  }, [tasks]);

  const addTask = (
    taskData: Omit<RoutineTask, "id" | "createdAt" | "updatedAt" | "completed">
  ) => {
    const newTask: RoutineTask = {
      ...taskData,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          const newCompleted = !task.completed;
          if (newCompleted) {
            // Check if this was the last task to complete
            const willCompleteAllTasks =
              prev.filter((t) => t.completed).length === prev.length - 1;

            if (willCompleteAllTasks) {
              toast.success(
                "🎉🎉🎉 INCREDIBLE! You've completed ALL your tasks for today! You're absolutely amazing! 🎉🎉🎉"
              );
            } else {
              const messages = [
                "🎉 Amazing job! You're crushing it!",
                "🌟 You're on fire! Keep it up!",
                "💪 That's the spirit! One step closer to your goals!",
                "✨ You're making progress! So proud of you!",
                "🔥 Nothing can stop you now!",
                "🚀 You're unstoppable!",
                "🌈 Every task completed is a step to success!",
                "⭐️ You're shining bright today!",
                "🎯 Bullseye! Perfect execution!",
                "💫 You're making it look easy!",
              ];
              const randomMessage =
                messages[Math.floor(Math.random() * messages.length)];
              toast.success(randomMessage);
            }
          }
          return { ...task, completed: newCompleted, updatedAt: new Date() };
        }
        return task;
      })
    );

    // Update progress when a task is completed
    const today = new Date().toISOString().split("T")[0];
    setProgress((prev) => {
      const todayProgress = prev.find((p) => p.date === today);
      const totalTasks = tasks.length;
      const completedTasks =
        tasks.filter((t) => t.completed).length +
        (tasks.find((t) => t.id === taskId)?.completed ? -1 : 1);

      if (todayProgress) {
        return prev.map((p) =>
          p.date === today ? { ...p, completedTasks, totalTasks } : p
        );
      } else {
        return [...prev, { date: today, completedTasks, totalTasks }];
      }
    });
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  return (
    <RoutineContext.Provider
      value={{
        tasks,
        progress,
        stats,
        addTask,
        toggleTask,
        deleteTask,
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
};

export const useRoutine = () => {
  const context = useContext(RoutineContext);
  if (context === undefined) {
    throw new Error("useRoutine must be used within a RoutineProvider");
  }
  return context;
};
