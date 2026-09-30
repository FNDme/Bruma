import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Folder, Note, useJournal } from "@/contexts/JournalContext";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useMemo, useState } from "react";
import {
  CreateFolderDialog,
  RenameFolderDialog,
} from "@/components/CreateFolderDialog";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderGrid } from "@/components/journal/FolderGrid";
import { NoteCard } from "@/components/journal/NoteCard";
import { MoveNoteDialog } from "@/components/journal/MoveNoteDialog";
import { JournalErrorAlert } from "@/components/journal/JournalErrorAlert";
import {
  JournalSearchInput,
  JournalSearchResults,
  useSearchQueryParam,
} from "@/components/journal/JournalSearch";

export function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const {
    notes,
    folders,
    getSubfolders,
    getFolderPath,
    getDescendantFolderIds,
    createFolder,
    moveNote,
    deleteFolderDialog,
    openDeleteFolderDialog,
    closeDeleteFolderDialog,
  } = useJournal();
  const navigate = useNavigate();
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [moving, setMoving] = useState<Note | null>(null);
  const [query, setQuery] = useSearchQueryParam();

  // Search is scoped to this folder and everything nested in it.
  const scope = useMemo(() => {
    if (!folderId || !query.trim()) return null;
    const nested = getDescendantFolderIds(folderId);
    const ids = new Set([folderId, ...nested]);
    return {
      folders: folders.filter((f) => nested.includes(f.id)),
      notes: notes.filter((n) => n.folderId && ids.has(n.folderId)),
    };
  }, [folderId, query, folders, notes, getDescendantFolderIds]);

  const folder = folders.find((f) => f.id === folderId);
  const subfolders = getSubfolders(folderId);
  const folderNotes = notes.filter((note) => note.folderId === folderId);
  const path = folderId ? getFolderPath(folderId) : [];

  const goToFolder = (id?: string) =>
    navigate(id ? `/collection/folder/${id}` : "/collection");

  const handleBack = () => goToFolder(folder?.parentId);

  const handleDropNote = async (noteId: string, target: Folder) => {
    try {
      await moveNote(noteId, target.id);
      toast.success(`Moved to ${target.name}`);
    } catch (err) {
      toast.error("Couldn't move note", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (!folder || !folderId) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Folder not found</h1>
        <Button onClick={() => navigate("/collection")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collection
        </Button>
      </div>
    );
  }

  const deletingFolder = deleteFolderDialog.folder;

  return (
    <PageLayout
      title={folder.name}
      headerActions={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="w-fit"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowCreateFolderDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/collection/new?folderId=${folderId}`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Folder actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenaming(folder)}>
                <Pencil className="h-4 w-4" />
                Rename folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => openDeleteFolderDialog(folder)}
              >
                <Trash className="h-4 w-4" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-8">
        <JournalErrorAlert />

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/collection")}
            className="h-auto p-0"
          >
            Collection
          </Button>
          {path.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" />
              {index === path.length - 1 ? (
                <span className="font-medium" aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToFolder(crumb.id)}
                  className="h-auto p-0"
                >
                  {crumb.name}
                </Button>
              )}
            </div>
          ))}
        </nav>

        <JournalSearchInput
          value={query}
          onChange={setQuery}
          placeholder={`Search in ${folder.name}…`}
        />

        {scope ? (
          <JournalSearchResults
            query={query}
            notes={scope.notes}
            folders={scope.folders}
            onOpenNote={(n) => navigate(`/collection/${n.id}`)}
            onOpenFolder={(f) => goToFolder(f.id)}
            onMoveNote={setMoving}
            onRenameFolder={setRenaming}
            onDeleteFolder={openDeleteFolderDialog}
            onDropNote={handleDropNote}
          />
        ) : (
        <>
        {subfolders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Subfolders</h2>
            <FolderGrid
              folders={subfolders}
              onOpen={(f) => goToFolder(f.id)}
              onRename={setRenaming}
              onDelete={openDeleteFolderDialog}
              onDropNote={handleDropNote}
            />
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folderNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onOpen={(n) => navigate(`/collection/${n.id}`)}
                onMove={setMoving}
              />
            ))}
          </div>
          {folderNotes.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">
                No notes in this folder yet. Start writing!
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
          await createFolder(name, folderId);
          toast.success(`Created folder "${name}"`);
        }}
        currentFolder={folder}
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

      {deletingFolder && (
        <DeleteFolderDialog
          open={deleteFolderDialog.isOpen}
          onOpenChange={(open) => !open && closeDeleteFolderDialog()}
          folder={deletingFolder}
          onDeleted={(_mode, parentId) => {
            // Deleting the folder being viewed: go to where it used to live.
            if (deletingFolder.id === folderId) goToFolder(parentId);
          }}
        />
      )}
    </PageLayout>
  );
}
