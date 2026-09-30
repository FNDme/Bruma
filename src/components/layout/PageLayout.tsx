import { ReactNode, UIEvent, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";
}

export function PageLayout({
  title,
  subtitle,
  children,
  headerActions,
  maxWidth = "4xl",
}: PageLayoutProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    full: "max-w-full",
  };

  // The scroll container is this component's root div (not the window), so
  // listen to it directly. setState bails out when the value doesn't change.
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setIsScrolled(event.currentTarget.scrollTop > 0);
  }, []);

  return (
    <div
      onScroll={handleScroll}
      className="h-full flex flex-col overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-button]:hidden"
    >
      <div
        className={cn(
          "sticky top-0 z-10 bg-background transition-shadow duration-200 pb-4 border-b border-border mb-4",
          isScrolled && "shadow-md"
        )}
      >
        <div className="pt-16 px-16">
          <div
            className={`w-full items-center ${maxWidthClasses[maxWidth]} mx-auto`}
          >
            <div className={`flex w-full justify-between items-center`}>
              <h1 className="text-2xl h-9 font-bold">{title}</h1>
              {headerActions && (
                <div className="flex items-center gap-2">{headerActions}</div>
              )}
            </div>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="flex-1 w-full">
        <div
          className={`w-full h-full space-y-4 ${maxWidthClasses[maxWidth]} mx-auto px-16 pb-16`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
