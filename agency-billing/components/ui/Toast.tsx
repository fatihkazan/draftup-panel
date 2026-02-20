"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let toastId = 0;
const listeners: Set<(toasts: ToastItem[]) => void> = new Set();
let toasts: ToastItem[] = [];

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function toast(message: string, type: ToastType = "info") {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const fn = (t: ToastItem[]) => setItems(t);
    listeners.add(fn);
    setItems([...toasts]);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${
            item.type === "success"
              ? "border-accent/30 bg-accent/10 text-accent"
              : item.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-card text-foreground"
          }`}
          role="alert"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
