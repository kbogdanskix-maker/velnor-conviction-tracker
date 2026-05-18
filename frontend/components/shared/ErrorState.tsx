"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="vela-card flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-loss/10 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-loss" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
        <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary text-sm flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}
