import { SystemCheck } from "@/contexts/SystemChecksContext";

type CheckStatus = "pending" | "running" | "completed" | "failed";

export function SystemCheckItem({
  id,
  name,
  description,
  status,
  icon,
  error,
}: SystemCheck) {
  const getStatusColor = (status: CheckStatus) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-500";
      case "failed":
        return "bg-red-500/20 text-red-500";
      case "running":
        return "bg-yellow-500/20 text-yellow-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div
      key={id}
      className="flex items-center space-x-4 p-2 px-4 rounded-lg bg-muted/50"
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full ${getStatusColor(
          status
        )}`}
      >
        {status === "running" ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          icon
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-medium">{name}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  );
}
