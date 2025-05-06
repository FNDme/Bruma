import { useParams, useNavigate } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ChevronRight, Trash } from "lucide-react";
import { format } from "date-fns";
import { PageLayout } from "@/components/layout/PageLayout";
import { useState } from "react";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";

export function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const {
    notes,
    folders,
    deleteFolder,
    getSubfolders,
    getFolderPath,
    createFolder,
    deleteFolderDialog,
    openDeleteFolderDialog,
    closeDeleteFolderDialog,
    isLoading,
  } = useJournal();
  const navigate = useNavigate();
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);

  const folder = folders.find((f) => f.id === folderId);
  const subfolders = getSubfolders(folderId);
  const folderNotes = notes.filter((note) => note.folderId === folderId);

  const handleFolderClick = (folderId: string) => {
    navigate(`/collection/folder/${folderId}`);
  };

  const handleBack = () => {
    if (folder?.parentId) {
      const parentFolder = folders.find((f) => f.id === folder.parentId);
      navigate(`/collection/folder/${parentFolder?.id}`);
    } else {
      navigate("/collection");
    }
  };

  if (!folder || !folderId) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Folder not found</h1>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collection
        </Button>
      </div>
    );
  }

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
        </div>
      }
    >
      <div className="space-y-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/collection")}
            className="h-auto p-0"
          >
            Collection
          </Button>
          {getFolderPath(folderId).map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" />
              {index === getFolderPath(folderId).length - 1 ? (
                <span className="font-medium">{folder.name}</span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFolderClick(folder.id)}
                  className="h-auto p-0"
                >
                  {folder.name}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Subfolders Section */}
        {subfolders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Subfolders</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subfolders.map((subfolder) => (
                <div
                  key={subfolder.id}
                  className="
                  border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer flex flex-col justify-between min-h-[100px]
                  group
                  "
                  onClick={() => handleFolderClick(subfolder.id)}
                >
                  <div>
                    <h3 className="text-xl font-semibold mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
                      {subfolder.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Created: {format(new Date(subfolder.created_at), "PPP")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {
                      notes.filter((note) => note.folderId === subfolder.id)
                        .length
                    }{" "}
                    notes
                  </p>
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteFolderDialog(subfolder);
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
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folderNotes.map((note) => (
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
          {folderNotes.length === 0 && (
            <div className="col-span-full text-center py-8">
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
        onCreateFolder={async (name) => {
          await createFolder(name, folderId);
          setShowCreateFolderDialog(false);
        }}
        currentFolder={folder}
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
