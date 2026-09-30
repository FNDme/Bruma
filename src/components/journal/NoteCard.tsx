import { format } from "date-fns";
import { FolderInput, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Note } from "@/contexts/JournalContext";
import { Highlight } from "@/components/command/Highlight";

/** MIME type used when dragging a note card onto a folder tile. */
export const NOTE_DRAG_TYPE = "application/x-bruma-note";

/** Plain-text preview of a note's HTML content (no markup is rendered). */
export function notePreview(html: string, maxLength = 160): string {
  if (!html) return "";
  let text: string;
  try {
    text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  } catch {
    text = html.replace(/<[^>]*>/g, " ");
  }
  text = text.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "PPP");
}

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onMove?: (note: Note) => void;
  /** Search mode: highlight matches of this query. */
  query?: string;
  /** Search mode: excerpt around the match, shown instead of the preview. */
  snippet?: string;
  /** Folder path shown above the title (e.g. in search results). */
  location?: string;
}

export function NoteCard({
  note,
  onOpen,
  onMove,
  query = "",
  snippet,
  location,
}: NoteCardProps) {
  const preview = snippet ?? notePreview(note.content);
  const updated = formatDate(note.updated_at);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={Boolean(onMove)}
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_DRAG_TYPE, note.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(note)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(note);
        }
      }}
      className="group relative border rounded-lg p-4 hover:border-primary focus-visible:border-primary focus-visible:outline-none transition-colors cursor-pointer flex flex-col justify-between min-h-[200px]"
    >
      <div className="min-w-0">
        {location && (
          <p className="text-xs text-muted-foreground mb-1 truncate pr-8">
            {location}
          </p>
        )}
        <h2 className="text-xl font-semibold mb-2 overflow-hidden text-ellipsis whitespace-nowrap pr-8">
          <Highlight text={note.title || "Untitled"} query={query} />
        </h2>
        {note.subtitle && (
          <p className="text-muted-foreground mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <Highlight text={note.subtitle} query={query} />
          </p>
        )}
        {preview && (
          <p className="text-sm text-muted-foreground/80 line-clamp-3 break-words">
            <Highlight text={preview} query={query} />
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        {updated && note.updated_at !== note.created_at
          ? `Updated ${updated}`
          : `Created ${formatDate(note.created_at)}`}
      </p>

      {onMove && (
        <div
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Note actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onMove(note)}>
                <FolderInput className="h-4 w-4" />
                Move to...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
