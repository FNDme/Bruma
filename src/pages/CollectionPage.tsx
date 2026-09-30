import { Button } from "@/components/ui/button";
import { Plus, FolderPlus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Folder, Note, useJournal } from "@/contexts/JournalContext";
import { PageLayout } from "@/components/layout/PageLayout";
import { useEffect, useState } from "react";
import {
  CreateFolderDialog,
  RenameFolderDialog,
} from "@/components/CreateFolderDialog";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";
import { FolderGrid } from "@/components/journal/FolderGrid";
import { NoteCard } from "@/components/journal/NoteCard";
import { MoveNoteDialog } from "@/components/journal/MoveNoteDialog";
import { JournalErrorAlert } from "@/components/journal/JournalErrorAlert";
import {
  JournalSearchInput,
  JournalSearchResults,
  useSearchQueryParam,
} from "@/components/journal/JournalSearch";
import { readHighlightState } from "@/hooks/useLocationHighlight";

export function CollectionPage() {
  const {
    notes,
    folders,
    isLoading,
    createFolder,
    moveNote,
    getSubfolders,
    deleteFolderDialog,
    openDeleteFolderDialog,
    closeDeleteFolderDialog,
  } = useJournal();
  const navigate = useNavigate();
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [moving, setMoving] = useState<Note | null>(null);
  const [query, setQuery] = useSearchQueryParam();
  const location = useLocation();

  // "New folder" from the command palette.
  const focusTarget = readHighlightState(location.state).focus;
  useEffect(() => {
    if (focusTarget === "new-folder") {
      setShowCreateFolderDialog(true);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [focusTarget, location.key, location.pathname, location.search, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const rootFolders = getSubfolders(undefined);
  const unfiledNotes = notes.filter((note) => !note.folderId);

  const handleDropNote = async (noteId: string, folder: Folder) => {
    try {
      await moveNote(noteId, folder.id);
      toast.success(`Moved to ${folder.name}`);
    } catch (err) {
      toast.error("Couldn't move note", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <PageLayout
      title="Your Notes"
      headerActions={
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateFolderDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button onClick={() => navigate("/collection/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <JournalErrorAlert />

        {(notes.length > 0 || folders.length > 0) && (
          <JournalSearchInput value={query} onChange={setQuery} />
        )}

        {query.trim() ? (
          <JournalSearchResults
            query={query}
            notes={notes}
            folders={folders}
            onOpenNote={(n) => navigate(`/collection/${n.id}`)}
            onOpenFolder={(folder) => navigate(`/collection/folder/${folder.id}`)}
            onMoveNote={setMoving}
            onRenameFolder={setRenaming}
            onDeleteFolder={openDeleteFolderDialog}
            onDropNote={handleDropNote}
          />
        ) : (
        <>
        {rootFolders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Folders</h2>
            <FolderGrid
              folders={rootFolders}
              onOpen={(folder) => navigate(`/collection/folder/${folder.id}`)}
              onRename={setRenaming}
              onDelete={openDeleteFolderDialog}
              onDropNote={handleDropNote}
            />
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-4">
            {folders.length > 0 ? "Unfiled notes" : "Notes"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unfiledNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onOpen={(n) => navigate(`/collection/${n.id}`)}
                onMove={setMoving}
              />
            ))}
          </div>
          {unfiledNotes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {notes.length === 0
                  ? "No notes yet. Start writing!"
                  : "Every note is in a folder."}
              </p>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      <CreateFolderDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
        onCreateFolder={async (name) => {
          await createFolder(name);
          toast.success(`Created folder "${name}"`);
        }}
      />

      <RenameFolderDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        folder={renaming}
      />

      <MoveNoteDialog
        open={moving !== null}
        onOpenChange={(open) => !open && setMoving(null)}
        note={moving}
      />

      {deleteFolderDialog.folder && (
        <DeleteFolderDialog
          open={deleteFolderDialog.isOpen}
          onOpenChange={(open) => !open && closeDeleteFolderDialog()}
          folder={deleteFolderDialog.folder}
        />
      )}
    </PageLayout>
  );
}
