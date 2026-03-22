import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[--o-radius-md] border border-[--g300] bg-white px-3 py-2 text-[13px] text-[--g900] placeholder:text-[--g500] transition-[border-color,box-shadow] duration-[--duration-fast] focus-visible:outline-none focus-visible:border-[--p500] focus-visible:ring-[3px] focus-visible:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
