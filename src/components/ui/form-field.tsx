import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  id?: string;
}

export function FormField({
  label,
  required,
  error,
  hint,
  className,
  children,
  id: providedId,
}: FormFieldProps) {
  const generatedId = React.useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // Inject id and aria attributes into single child, or wrap multiple children
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const childProps = child.props as Record<string, unknown>;
    const isInputElement =
      typeof child.type === "string" ||
      (typeof child.type === "function" && (child.type as { displayName?: string }).displayName);

    if (isInputElement) {
      return React.cloneElement(
        child as React.ReactElement<{
          id?: string;
          "aria-invalid"?: boolean;
          "aria-describedby"?: string;
          "aria-required"?: boolean;
        }>,
        {
          id,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": [
            error ? errorId : null,
            hint && !error ? hintId : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
          "aria-required": required ? true : undefined,
          ...childProps,
        }
      );
    }
    return child;
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground"
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (обязательное поле)</span>}
        </label>
      )}
      {enhancedChildren}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-destructive flex items-center gap-1"
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
