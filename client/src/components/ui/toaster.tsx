import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const variantIcon: Record<string, React.ReactNode> = {
  success:     <CheckCircle2  className="h-4 w-4 text-[--success] shrink-0 mt-0.5" />,
  warning:     <TriangleAlert className="h-4 w-4 text-[--warning] shrink-0 mt-0.5" />,
  destructive: <XCircle       className="h-4 w-4 text-[--danger]  shrink-0 mt-0.5" />,
  info:        <Info          className="h-4 w-4 text-[--info]    shrink-0 mt-0.5" />,
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, duration, ...props }) => {
        // Auto-dismiss: success/warning 4.5s, error 6s, info never (undefined = Radix default)
        const autoDismiss =
          variant === "success" || variant === "warning" ? 4500
          : variant === "destructive"                    ? 6000
          : variant === "info"                           ? Infinity
          : 4500;

        return (
          <Toast key={id} variant={variant} duration={duration ?? autoDismiss} {...props}>
            {variantIcon[variant ?? "default"]}
            <div className="flex-1 grid gap-0.5">
              {title       && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
