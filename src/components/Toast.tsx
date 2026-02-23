"use client";

import { useToast, type ToastType } from "@/hooks/useToast";

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/20">
          <svg
            className="h-5 w-5 text-[var(--accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      );
    case "error":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--danger)]/20">
          <svg
            className="h-5 w-5 text-[var(--danger)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      );
    case "warning":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--warning)]/20">
          <svg
            className="h-5 w-5 text-[var(--warning)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/20">
          <svg
            className="h-5 w-5 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      );
  }
}

function ToastItem({ id, type, title, message }: ToastProps) {
  const { removeToast } = useToast();

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-[var(--card)] p-4 shadow-lg transition-all animate-in slide-in-from-right-full ${
        type === "success"
          ? "border-[var(--accent)]/30"
          : type === "error"
            ? "border-[var(--danger)]/30"
            : type === "warning"
              ? "border-[var(--warning)]/30"
              : "border-[var(--primary)]/30"
      }`}
      role="alert"
    >
      <ToastIcon type={type} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        {message && (
          <p className="mt-1 text-xs text-[var(--muted)]">{message}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(id)}
        className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        aria-label="Close notification"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
        />
      ))}
    </div>
  );
}
