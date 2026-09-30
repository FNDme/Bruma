import { useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Folder, useJournal } from "@/contexts/JournalContext";
import { cn } from "@/lib/utils";
import { NOTE_DRAG_TYPE } from "./NoteCard";

interface FolderGridProps {
  folders: Folder[];
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  /** Called when a note card is dropped on a folder tile. */
  onDropNote?: (noteId: string, folder: Folder) => void;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function FolderGrid({
  folders,
  onOpen,
  onRename,
  onDelete,
  onDropNote,
}: FolderGridProps) {
  const { getFolderStats } = useJournal();
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {folders.map((folder) => {
        const stats = getFolderStats(folder.id);
        const created = new Date(folder.created_at);
        return (
          <div
            key={folder.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(folder)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(folder);
              }
            }}
            onDragOver={(e) => {
              if (!onDropNote || !e.dataTransfer.types.includes(NOTE_DRAG_TYPE))
                return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTarget(folder.id);
            }}
            onDragLeave={() =>
              setDropTarget((current) => (current === folder.id ? null : current))
            }
            onDrop={(e) => {
              setDropTarget(null);
              const noteId = e.dataTransfer.getData(NOTE_DRAG_TYPE);
              if (!onDropNote || !noteId) return;
              e.preventDefault();
              onDropNote(noteId, folder);
            }}
            className={cn(
              "group relative border rounded-lg p-4 hover:border-primary focus-visible:border-primary focus-visible:outline-none transition-colors cursor-pointer flex flex-col justify-between min-h-[100px]",
              dropTarget === folder.id && "border-primary bg-primary/5"
            )}
          >
            <div className="min-w-0">
              <h3 className="text-xl font-semibold mb-2 overflow-hidden text-ellipsis whitespace-nowrap pr-8">
                {folder.name}
              </h3>
              {!Number.isNaN(created.getTime()) && (
                <p className="text-xs text-muted-foreground">
                  Created: {format(created, "PPP")}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {plural(stats.directNoteCount, "note")}
              {stats.directSubfolderCount > 0 &&
                ` · ${plural(stats.directSubfolderCount, "subfolder")}`}
            </p>

            <div
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Actions for ${folder.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onRename(folder)}>
                    <Pencil className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(folder)}
                  >
                    <Trash className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
