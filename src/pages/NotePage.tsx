import { useParams } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/collection")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground/30 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Note</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this note? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => navigate("/collection")}>
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{note.title}</h1>
        <p className="text-muted-foreground">{note.subtitle}</p>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: note.content }} />
        </div>
      </div>
    </div>
  );
}
