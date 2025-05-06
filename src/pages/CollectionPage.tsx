import { Button } from "@/components/ui/button";
import { Plus, FolderPlus, ChevronRight, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useJournal } from "@/contexts/JournalContext";
import { PageLayout } from "@/components/layout/PageLayout";
import { useState } from "react";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";
import { Folder } from "@/contexts/JournalContext";

export function CollectionPage() {
  const {
    notes,
    folders,
    isLoading,
    createFolder,
    getSubfolders,
    getFolderPath,
    deleteFolder,
    deleteFolderDialog,
    openDeleteFolderDialog,
    closeDeleteFolderDialog,
  } = useJournal();
  const navigate = useNavigate();
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<Folder | undefined>();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleCreateFolder = async (name: string, parentId?: string) => {
    await createFolder(name, parentId);
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolder(folder);
    navigate(`/collection/folder/${folder.id}`);
  };

  const currentSubfolders = getSubfolders(currentFolder?.id);
  const currentNotes = notes.filter(
    (note) => note.folderId === currentFolder?.id
  );

  return (
    <PageLayout
      title={currentFolder ? currentFolder.name : "Your Notes"}
      headerActions={
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateFolderDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button
            onClick={() =>
              navigate(
                `/collection/new${
                  currentFolder ? `?folderId=${currentFolder.id}` : ""
                }`
              )
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Breadcrumb Navigation */}
        {currentFolder && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/collection")}
              className="h-auto p-0"
            >
              Collection
            </Button>
            {getFolderPath(currentFolder.id).map((folder, index) => (
              <div key={folder.id} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                {index === getFolderPath(currentFolder.id).length - 1 ? (
                  <span className="font-medium">{folder.name}</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderClick(folder)}
                    className="h-auto p-0"
                  >
                    {folder.name}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Folders Section */}
        {currentSubfolders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Folders</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentSubfolders.map((folder) => (
                <div
                  key={folder.id}
                  className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer flex flex-col justify-between min-h-[100px] group"
                  onClick={() => handleFolderClick(folder)}
                >
                  <div>
                    <h3 className="text-xl font-semibold mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
                      {folder.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Created: {format(new Date(folder.created_at), "PPP")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {notes.filter((note) => note.folderId === folder.id).length}{" "}
                    notes
                  </p>
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteFolderDialog(folder);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {currentSubfolders.length > 0
              ? "Notes in this Folder"
              : "All Notes"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentNotes.map((note) => (
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
          </div>
          {currentNotes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No notes in this folder yet. Start writing!
              </p>
            </div>
          )}
        </div>
      </div>

      <CreateFolderDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
        onCreateFolder={handleCreateFolder}
        currentFolder={currentFolder}
        folders={folders}
      />

      {deleteFolderDialog.folder && (
        <DeleteFolderDialog
          open={deleteFolderDialog.isOpen}
          onOpenChange={closeDeleteFolderDialog}
          onDelete={async () => {
            await deleteFolder(deleteFolderDialog.folder!.id);
          }}
          folder={deleteFolderDialog.folder}
          isLoading={isLoading}
        />
      )}
    </PageLayout>
  );
}
