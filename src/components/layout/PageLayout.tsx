import { ReactNode } from "react";

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
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    full: "max-w-full",
  };

  return (
    <div className="h-full flex flex-col pt-16 px-16">
      <div
        className={`flex w-full justify-between items-center ${maxWidthClasses[maxWidth]} mx-auto`}
      >
        <h1 className="text-2xl font-bold">{title}</h1>
        {headerActions && (
          <div className="flex items-center gap-2">{headerActions}</div>
        )}
      </div>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      <div className="flex-1 w-full overflow-hidden mt-6">
        <div
          className={`w-full h-full space-y-4 ${maxWidthClasses[maxWidth]} mx-auto`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
