import { useParams } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { forwardRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const DeleteButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => (
  <button
    ref={ref}
    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent h-9 px-3 text-muted-foreground/30 hover:text-destructive"
    {...props}
  >
    <Trash2 className="h-4 w-4" />
  </button>
));
DeleteButton.displayName = "DeleteButton";

export function NotePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const { notes, deleteNote } = useJournal();
  const navigate = useNavigate();

  const note = notes.find((n) => n.created_at === noteId);

  const handleDelete = async () => {
    try {
      await deleteNote(noteId!);
      navigate("/collection");
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  if (!note) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Note not found</h1>
        <Button onClick={() => navigate("/collection")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collection
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 pt-16 px-16 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/collection")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/collection/${noteId}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <DeleteButton />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Note</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this note? This action cannot
                  be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => navigate("/collection")}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="h-full overflow-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{note.title}</h1>
          <p className="text-muted-foreground">{note.subtitle}</p>
        </div>
        <div className="flex-1">
          <div className="prose prose-sm dark:prose-invert max-w-none pb-8">
            <div dangerouslySetInnerHTML={{ __html: note.content }} />
          </div>
        </div>
      </div>
    </div>
  );
}
