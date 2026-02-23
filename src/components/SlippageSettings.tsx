"use client";

import { useState, useCallback } from "react";

interface SlippageSettingsProps {
  value: number;
  onChange: (value: number) => void;
}

const PRESET_VALUES = [0.5, 1, 3, 5];

export function SlippageSettings({ value, onChange }: SlippageSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState<string>("");
  const [isCustom, setIsCustom] = useState(!PRESET_VALUES.includes(value));

  const handlePresetClick = useCallback((preset: number) => {
    onChange(preset);
    setIsCustom(false);
    setCustomValue("");
  }, [onChange]);

  const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setCustomValue(val);
      setIsCustom(true);
      const numVal = parseFloat(val);
      if (!isNaN(numVal) && numVal >= 0.1 && numVal <= 50) {
        onChange(numVal);
      }
    }
  }, [onChange]);

  const getSlippageColor = (slippage: number): string => {
    if (slippage <= 1) return "var(--accent)"; // Low - green
    if (slippage <= 3) return "var(--warning)"; // Normal - yellow
    return "var(--danger)"; // High - red
  };

  const getSlippageLabel = (slippage: number): string => {
    if (slippage <= 1) return "Low";
    if (slippage <= 3) return "Normal";
    if (slippage <= 5) return "High";
    return "Very High";
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm transition-colors hover:border-[var(--primary)]/50"
      >
        <svg
          className="h-4 w-4 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        <span className="text-[var(--foreground)]">Slippage:</span>
        <span
          className="font-medium"
          style={{ color: getSlippageColor(value) }}
        >
          {value}%
        </span>
        <span className="text-xs text-[var(--muted)]">
          ({getSlippageLabel(value)})
        </span>
        <svg
          className={`h-4 w-4 text-[var(--muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown content */}
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-lg">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">
                Slippage Tolerance
              </h4>
              <p className="text-xs text-[var(--muted)]">
                Maximum price change you&apos;re willing to accept
              </p>
            </div>

            {/* Preset buttons */}
            <div className="mb-3 grid grid-cols-4 gap-2">
              {PRESET_VALUES.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    value === preset && !isCustom
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)]"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="mb-3">
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Custom (%)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.5"
                  value={customValue}
                  onChange={handleCustomChange}
                  className={`w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ${
                    isCustom
                      ? "border-[var(--primary)]"
                      : "border-[var(--card-border)]"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
                  %
                </span>
              </div>
              {customValue && (parseFloat(customValue) < 0.1 || parseFloat(customValue) > 50) && (
                <p className="mt-1 text-xs text-[var(--danger)]">
                  Must be between 0.1% and 50%
                </p>
              )}
            </div>

            {/* Risk warning */}
            <div
              className={`rounded-lg p-2 text-xs ${
                value > 5
                  ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                  : value > 3
                    ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                    : "bg-[var(--accent)]/10 text-[var(--accent)]"
              }`}
            >
              {value <= 1 ? (
                <>
                  <span className="font-medium">Low slippage</span>
                  <p className="mt-0.5">Transactions may fail due to price movement.</p>
                </>
              ) : value <= 3 ? (
                <>
                  <span className="font-medium">Normal slippage</span>
                  <p className="mt-0.5">Recommended for most transactions.</p>
                </>
              ) : value <= 5 ? (
                <>
                  <span className="font-medium">High slippage</span>
                  <p className="mt-0.5">You may receive less than expected.</p>
                </>
              ) : (
                <>
                  <span className="font-medium">⚠️ Very high slippage</span>
                  <p className="mt-0.5">Significant slippage - use with caution!</p>
                </>
              )}
            </div>

            {/* Current selection */}
            <div className="mt-3 flex items-center justify-between border-t border-[var(--card-border)] pt-3">
              <span className="text-xs text-[var(--muted)]">Current:</span>
              <span
                className="text-sm font-medium"
                style={{ color: getSlippageColor(value) }}
              >
                {value}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
