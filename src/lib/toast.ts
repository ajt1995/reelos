import { useEffect, useState } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "error";
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  for (const fn of listeners) {
    fn([...toasts]);
  }
}

export function showToast(message: string, type: "info" | "success" | "error" = "info") {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item: ToastItem = { id, message, type };
  toasts = [...toasts, item];
  notify();

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 3200);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToasts(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return items;
}
