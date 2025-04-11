import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Welcome to <span className="font-alfa tracking-wide">Bruma</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Your personal space for whatever you want
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
          <Button
            size="lg"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate("/collection")}
          >
            <span className="text-lg">Notes</span>
            <span className="text-sm text-muted-foreground">
              Start journaling
            </span>
          </Button>

          <Button
            size="lg"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate("/todo")}
          >
            <span className="text-lg">Todo List</span>
            <span className="text-sm text-muted-foreground">Manage tasks</span>
          </Button>

          <Button
            size="lg"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate("/vault")}
          >
            <span className="text-lg">Secure Vault</span>
            <span className="text-sm text-muted-foreground">
              Store securely
            </span>
          </Button>

          <Button
            size="lg"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate("/collection")}
          >
            <span className="text-lg">Collection</span>
            <span className="text-sm text-muted-foreground">
              View all notes
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
