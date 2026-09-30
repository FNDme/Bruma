import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Folder, Note, useJournal } from "@/contexts/JournalContext";
import { indexNotes, searchFolders, searchNotes } from "@/lib/search";
import { FolderGrid } from "./FolderGrid";
import { NoteCard } from "./NoteCard";

/** The search query kept in the URL (?q=), so back/forward and reload keep it. */
export function useSearchQueryParam(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = useCallback(
    (value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set("q", value);
          else next.delete("q");
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );
  return [query, setQuery];
}

interface JournalSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function JournalSearchInput({
  value,
  onChange,
  placeholder = "Search notes and folders…",
}: JournalSearchInputProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label="Search notes and folders"
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface JournalSearchResultsProps {
  query: string;
  /** Notes and folders to search (e.g. everything, or one folder's subtree). */
  notes: Note[];
  folders: Folder[];
  onOpenNote: (note: Note) => void;
  onOpenFolder: (folder: Folder) => void;
  onMoveNote: (note: Note) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDropNote?: (noteId: string, folder: Folder) => void;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Matching folders and notes (title, subtitle and text), best matches first. */
export function JournalSearchResults({
  query,
  notes,
  folders,
  onOpenNote,
  onOpenFolder,
  onMoveNote,
  onRenameFolder,
  onDeleteFolder,
  onDropNote,
}: JournalSearchResultsProps) {
  const { getFolderLabel } = useJournal();
  const index = useMemo(() => indexNotes(notes), [notes]);
  const noteResults = useMemo(() => searchNotes(index, query), [index, query]);
  const folderResults = useMemo(
    () => searchFolders(folders, query).map((r) => r.folder),
    [folders, query]
  );

  if (noteResults.length === 0 && folderResults.length === 0) {
    return (
      <div className="text-center py-8" role="status">
        <p className="text-muted-foreground">
          No notes or folders match “{query.trim()}”.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground" role="status">
        {plural(noteResults.length, "note")}
        {folderResults.length > 0 && `, ${plural(folderResults.length, "folder")}`}
      </p>
      {folderResults.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Folders</h2>
          <FolderGrid
            folders={folderResults}
            onOpen={onOpenFolder}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
            onDropNote={onDropNote}
          />
        </div>
      )}
      {noteResults.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {noteResults.map(({ note, snippet }) => (
              <NoteCard
                key={note.id}
                note={note}
                query={query}
                snippet={snippet}
                location={getFolderLabel(note.folderId)}
                onOpen={onOpenNote}
                onMove={onMoveNote}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
