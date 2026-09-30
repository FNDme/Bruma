import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Note, useJournal } from "@/contexts/JournalContext";
import { FolderSelect } from "./FolderSelect";

interface MoveNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  onMoved?: (folderId: string | undefined) => void;
}

export function MoveNoteDialog({
  open,
  onOpenChange,
  note,
  onMoved,
}: MoveNoteDialogProps) {
  const { moveNote, getFolderLabel } = useJournal();
  const [target, setTarget] = useState<string | undefined>(note?.folderId);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (open) setTarget(note?.folderId);
  }, [open, note?.folderId]);

  if (!note) return null;

  const unchanged = target === note.folderId;

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await moveNote(note.id, target);
      toast.success(`Moved to ${getFolderLabel(target)}`);
      onOpenChange(false);
      onMoved?.(target);
    } catch (err) {
      toast.error("Couldn't move note", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isMoving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move note</DialogTitle>
          <DialogDescription>
            "{note.title || "Untitled"}" is currently in{" "}
            {getFolderLabel(note.folderId)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="move-note-folder" className="text-sm font-medium">
            Destination
          </label>
          <FolderSelect
            id="move-note-folder"
            value={target}
            onChange={setTarget}
            disabled={isMoving}
            className="w-full"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isMoving || unchanged}>
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
