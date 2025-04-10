import React, { useEffect, useState } from "react";
import { useVault } from "../contexts/VaultContext";
import { UnlockVaultPage } from "@/components/UnlockVaultPage";
import { VaultNotesPage } from "@/components/VaultNotesPage";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { NoteDialog } from "@/components/NoteDialog";
import { VaultSetupWizard } from "@/components/VaultSetupWizard";

interface Note {
  id: string;
  title: string;
  content: string;
}

export const VaultPage: React.FC = () => {
  const {
    isInitialized,
    isUnlocked,
    unlockVault,
    lockVault,
    addNote,
    getNote,
    updateNote,
    deleteNote,
    listNotes,
    changePassword,
    resetVault,
  } = useVault();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [noteDialogState, setNoteDialogState] = useState<{
    open: boolean;
    mode: "add" | "view";
    note?: Note;
  }>({
    open: false,
    mode: "add",
  });

  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const notes = await listNotes();
    setNotes(notes);
  };

  const handleUnlock = async (password: string): Promise<boolean> => {
    try {
      await loadNotes();
      return await unlockVault(password);
    } catch (error) {
      return false;
    }
  };

  const handleReset = async (): Promise<void> => {
    try {
      await resetVault();
      await loadNotes();
    } catch (error) {
      console.error("Error resetting vault:", error);
    }
  };

  const handleAddNote = async (
    title: string,
    content: string
  ): Promise<void> => {
    await addNote(title, content);
    await loadNotes();
  };

  const handleUpdateNote = async (
    title: string,
    content: string
  ): Promise<void> => {
    if (noteDialogState.note) {
      await updateNote(noteDialogState.note.id, title, content);
      await loadNotes();
    }
  };

  const handleDeleteNote = async (id: string): Promise<void> => {
    await deleteNote(id);
    await loadNotes();
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    const success = await changePassword(currentPassword, newPassword);
    if (success) await loadNotes();
    return success;
  };

  const handleViewNote = async (noteId: string) => {
    const note = await getNote(noteId);
    setNoteDialogState({
      open: true,
      mode: "view",
      note: { id: noteId, ...note },
    });
  };

  if (!isInitialized) {
    return <VaultSetupWizard />;
  }

  if (!isUnlocked) {
    return <UnlockVaultPage onUnlock={handleUnlock} onReset={handleReset} />;
  }

  return (
    <>
      <VaultNotesPage
        onLock={lockVault}
        onAddNote={() => setNoteDialogState({ open: true, mode: "add" })}
        onGetNote={getNote}
        onUpdateNote={updateNote}
        onDeleteNote={handleDeleteNote}
        onShowChangePassword={() => setShowChangePassword(true)}
        onViewNote={handleViewNote}
        notes={notes}
      />
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        onChangePassword={handleChangePassword}
      />
      <NoteDialog
        open={noteDialogState.open}
        onOpenChange={(open) =>
          setNoteDialogState((prev) => ({ ...prev, open }))
        }
        mode={noteDialogState.mode}
        initialTitle={noteDialogState.note?.title}
        initialContent={noteDialogState.note?.content}
        onSave={
          noteDialogState.mode === "add" ? handleAddNote : handleUpdateNote
        }
      />
    </>
  );
};
