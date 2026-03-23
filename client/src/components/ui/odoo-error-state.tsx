/**
 * @file: odoo-error-state.tsx
 * @description: Error state component: warning icon + message + retry button.
 * @dependencies: lucide-react, @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OdooErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function OdooErrorState({
  message = "Не удалось загрузить данные",
  onRetry,
  retryLabel = "Повторить",
  className,
  ...props
}: OdooErrorStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-10 px-4 text-center", className)}
      {...props}
    >
      <TriangleAlert className="h-10 w-10 text-[--warning] mb-3 stroke-[1.5]" />
      <p className="text-[14px] font-medium text-[--g700] mb-3">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[--p500] hover:text-[--p700] transition-colors duration-[--duration-fast]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
