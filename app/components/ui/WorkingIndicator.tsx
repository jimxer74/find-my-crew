// components/ui/image-skeleton.tsx
import { cn } from "@/app/lib/utils"; // shadcn/ui helper or your own classNames util

interface WorkingIndicatorProps {
  className?: string;
  aspectRatio?: "square" | "video" | "portrait" | "landscape" | "auto";
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  showIcon?: boolean;
}

export function WorkingIndicator({
  className,
  aspectRatio = "square",
  rounded = "md",
  showIcon = false,
}: WorkingIndicatorProps) {
  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
    landscape: "aspect-[4/3]",
    auto: "",
  }[aspectRatio];

  const roundedClasses = {
    none: "",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/60 animate-pulse",
        aspectClasses,
        roundedClasses,
        className
      )}
    >
      {/* Shimmer effect – pure Tailwind (no extra libs needed) */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent",
          "animate-shimmer"
        )}
        style={{ backgroundSize: "200% 100%" }}
      />

      {showIcon && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}