import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Trash2 } from "lucide-react";

interface NoteListItem {
  id: string;
  title: string;
}

interface VaultNotesPageProps {
  onLock: () => void;
  onAddNote: () => void;
  onGetNote: (id: string) => Promise<{ title: string; content: string }>;
  onUpdateNote: (id: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onShowChangePassword: () => void;
  onViewNote: (id: string) => Promise<void>;
  notes: NoteListItem[];
}

export const VaultNotesPage: React.FC<VaultNotesPageProps> = ({
  onLock,
  onAddNote,
  onDeleteNote,
  onShowChangePassword,
  onViewNote,
  notes,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<NoteListItem | null>(null);

  const handleDeleteNote = async (note: NoteListItem) => {
    try {
      await onDeleteNote(note.id);
      setNoteToDelete(null);
    } catch (error) {
      setError("Failed to delete note");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-2xl font-bold">Secure Notes</h1>
        <Button onClick={onAddNote}>Add Note</Button>
      </div>

      {error && (
        <Alert variant="destructive" className="m-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="cursor-pointer group relative min-h-[100px]"
              onClick={() => onViewNote(note.id)}
            >
              <CardHeader>
                <CardTitle>{note.title}</CardTitle>
              </CardHeader>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteToDelete(note);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {!notes.length && (
            <div className="col-span-full">
              <p className="text-muted-foreground">
                No notes found, add one to get started
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t flex justify-end space-x-2">
        <Button variant="outline" onClick={onShowChangePassword}>
          Change Password
        </Button>
        <Button variant="outline" onClick={onLock}>
          Lock Vault
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={noteToDelete !== null}
        onOpenChange={() => setNoteToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{noteToDelete?.title}"? This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => noteToDelete && handleDeleteNote(noteToDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
