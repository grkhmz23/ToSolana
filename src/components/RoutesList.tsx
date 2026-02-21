"use client";

import type { NormalizedRoute } from "@/server/schema";
import { formatDuration } from "@/lib/format";

interface RoutesListProps {
  routes: NormalizedRoute[];
  errors?: string[];
  selectedRouteId: string | null;
  onSelectRoute: (route: NormalizedRoute) => void;
}

export function RoutesList({ routes, errors, selectedRouteId, onSelectRoute }: RoutesListProps) {
  if (routes.length === 0 && (!errors || errors.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">Available Routes</h3>

      {errors && errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]"
            >
              {err}
            </div>
          ))}
        </div>
      )}

      {routes.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No routes found for this transfer.</p>
      )}

      <div className="space-y-2">
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.routeId;
          return (
            <button
              key={`${route.provider}-${route.routeId}`}
              onClick={() => onSelectRoute(route)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--primary)]/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-[var(--primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                      {route.provider.toUpperCase()}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {route.steps.length} step{route.steps.length !== 1 ? "s" : ""}
                    </span>
                    {route.etaSeconds && (
                      <span className="text-xs text-[var(--muted)]">
                        ~{formatDuration(route.etaSeconds)}
                      </span>
                    )}
                  </div>

                  <div className="mb-2 text-sm font-medium text-[var(--foreground)]">
                    Receive: {route.estimatedOutput.amount} {route.estimatedOutput.token}
                  </div>

                  {/* Steps */}
                  <div className="space-y-1">
                    {route.steps.map((step, i) => (
                      <div key={i} className="text-xs text-[var(--muted)]">
                        {i + 1}. {step.description}{" "}
                        <span className="text-[var(--accent)]">({step.chainType})</span>
                      </div>
                    ))}
                  </div>

                  {/* Fees */}
                  {route.fees.length > 0 && (
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      Fees:{" "}
                      {route.fees.map((f) => `${f.amount} ${f.token}`).join(", ")}
                    </div>
                  )}

                  {/* Warnings */}
                  {route.warnings && route.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {route.warnings.map((w, i) => (
                        <div key={i} className="text-xs text-[var(--warning)]">
                          ⚠ {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected indicator */}
                <div
                  className={`ml-3 h-5 w-5 shrink-0 rounded-full border-2 ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)]"
                      : "border-[var(--card-border)]"
                  }`}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 20 20"
                      fill="white"
                      className="h-full w-full p-0.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
