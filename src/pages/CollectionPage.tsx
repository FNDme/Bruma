import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useJournal } from "@/contexts/JournalContext";

export function CollectionPage() {
  const { notes, isLoading } = useJournal();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Notes</h1>
        <Button onClick={() => navigate("/collection/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <div
            key={note.created_at}
            className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer flex flex-col justify-between min-h-[200px]"
            onClick={() => navigate(`/collection/${note.created_at}`)}
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {note.title}
              </h2>
              <p className="text-muted-foreground mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {note.subtitle}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Created: {format(new Date(note.created_at), "PPP")}
            </p>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">
              No notes yet. Start writing!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
