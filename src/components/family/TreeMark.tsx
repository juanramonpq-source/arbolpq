import { cn } from "@/lib/utils";

export function TreeMark({ className }: { className?: string }) {
  return (
    <img
      src="/icon-180.png"
      alt=""
      width={36}
      height={36}
      className={cn("shrink-0 rounded-lg object-cover", className)}
    />
  );
}
