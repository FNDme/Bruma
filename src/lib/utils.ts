import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Human-readable message for anything thrown or rejected. Tauri's `invoke`
 * rejects with the command's error string, not an Error instance.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string") return err.trim() || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  if (err === null || err === undefined) return fallback;
  const text = String(err);
  return text && text !== "[object Object]" ? text : fallback;
}
