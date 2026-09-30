import { useParams } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Pencil, FolderInput } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { forwardRef, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoveNoteDialog } from "@/components/journal/MoveNoteDialog";
import { sanitizeNoteHtml } from "@/lib/sanitize";

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
  const { getNote, deleteNote, getFolderPath } = useJournal();
  const navigate = useNavigate();
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const note = getNote(noteId);
  const safeHtml = useMemo(
    () => sanitizeNoteHtml(note?.content),
    [note?.content]
  );

  const goToLocation = (folderId?: string) =>
    navigate(folderId ? `/collection/folder/${folderId}` : "/collection");

  const handleDelete = async () => {
    if (!note) return;
    try {
      await deleteNote(note.id);
      toast.success("Note deleted");
      goToLocation(note.folderId);
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error("Couldn't delete note", {
        description: error instanceof Error ? error.message : undefined,
      });
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

  const path = note.folderId ? getFolderPath(note.folderId) : [];

  return (
    <div className="h-full flex flex-col gap-4 pt-16 px-16 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToLocation(note.folderId)}
          className="w-fit"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMoveDialog(true)}
            title="Move to folder"
            aria-label="Move to folder"
          >
            <FolderInput className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/collection/${note.id}/edit`)}
            title="Edit"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <DeleteButton title="Delete" aria-label="Delete" />
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
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
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
          <button
            type="button"
            onClick={() => setShowMoveDialog(true)}
            className="w-fit text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Move to folder"
          >
            {path.length
              ? path.map((f) => f.name).join(" / ")
              : "Unfiled"}
          </button>
          <h1 className="text-2xl font-bold">{note.title || "Untitled"}</h1>
          <p className="text-muted-foreground">{note.subtitle}</p>
        </div>
        <div className="flex-1">
          <div className="prose prose-sm dark:prose-invert max-w-none pb-8">
            <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </div>
        </div>
      </div>

      <MoveNoteDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        note={note}
      />
    </div>
  );
}
