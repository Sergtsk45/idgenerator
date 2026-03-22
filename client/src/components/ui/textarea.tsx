import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[--o-radius-md] border border-[--g300] bg-white px-3 py-2 text-[13px] text-[--g900] placeholder:text-[--g500] transition-[border-color,box-shadow] duration-[--duration-fast] focus-visible:outline-none focus-visible:border-[--p500] focus-visible:ring-[3px] focus-visible:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
