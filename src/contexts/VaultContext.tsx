import React, { createContext, useContext, useState, useEffect } from "react";
import { EncryptionService } from "../services/encryption";
import { invoke } from "@tauri-apps/api/core";

interface Note {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultContextType {
  isInitialized: boolean;
  isUnlocked: boolean;
  initializeVault: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => void;
  addNote: (title: string, content: string) => Promise<string>;
  getNote: (id: string) => Promise<Note>;
  listNotes: () => Promise<{ id: string; title: string }[]>;
  deleteNote: (id: string) => Promise<void>;
  updateNote: (id: string, title: string, content: string) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  resetVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

const NOTES_STORAGE_KEY = "bruma_secure_notes";

const getStoredNotes = () => {
  const stored = localStorage.getItem(NOTES_STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const encryptionService = EncryptionService.getInstance();

  useEffect(() => {
    checkVaultStatus();
  }, []);

  const checkVaultStatus = async () => {
    try {
      const hasCredentials = await invoke("has_vault_credentials");
      setIsInitialized(hasCredentials as boolean);
    } catch (error) {
      setIsInitialized(false);
    }
  };

  const initializeVault = async (password: string) => {
    await encryptionService.initializeVault(password);
    setIsInitialized(true);
    setIsUnlocked(true);
  };

  const unlockVault = async (password: string) => {
    const success = await encryptionService.unlockVault(password);
    setIsUnlocked(success);
    return success;
  };

  const lockVault = () => {
    setIsUnlocked(false);
  };

  const addNote = async (title: string, content: string) => {
    if (!isUnlocked) throw new Error("Vault is locked");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const note: Note = {
      title,
      content,
      createdAt: now,
      updatedAt: now,
    };

    const encryptedNote = await encryptionService.encrypt(JSON.stringify(note));

    const notes = getStoredNotes();
    notes[id] = encryptedNote;
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));

    return id;
  };

  const getNote = async (id: string) => {
    if (!isUnlocked) throw new Error("Vault is locked");

    const notes = getStoredNotes();
    const encryptedNote = notes[id];
    if (!encryptedNote) throw new Error("Note not found");

    try {
      const decryptedNote = await encryptionService.decrypt(encryptedNote);
      return JSON.parse(decryptedNote) as Note;
    } catch (error) {
      console.error(`Error decrypting note ${id}:`, error);
      throw new Error("Failed to decrypt note");
    }
  };

  const listNotes = async () => {
    if (!isUnlocked) throw new Error("Vault is locked");

    const notes = getStoredNotes();
    const noteList = await Promise.all(
      Object.entries(notes).map(async ([id, encryptedNote]) => {
        try {
          const decryptedNote = await encryptionService.decrypt(
            encryptedNote as string
          );
          const note = JSON.parse(decryptedNote) as Note;
          return { id, title: note.title };
        } catch (error) {
          console.error(`Error decrypting note ${id}:`, error);
          return { id, title: "Error loading note" };
        }
      })
    );

    return noteList;
  };

  const deleteNote = async (id: string) => {
    if (!isUnlocked) throw new Error("Vault is locked");

    const notes = getStoredNotes();
    if (!notes[id]) throw new Error("Note not found");

    delete notes[id];
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  };

  const updateNote = async (id: string, title: string, content: string) => {
    if (!isUnlocked) throw new Error("Vault is locked");

    const notes = getStoredNotes();
    const encryptedNote = notes[id];
    if (!encryptedNote) throw new Error("Note not found");

    const decryptedNote = await encryptionService.decrypt(encryptedNote);
    const note = JSON.parse(decryptedNote) as Note;

    const updatedNote: Note = {
      ...note,
      title,
      content,
      updatedAt: new Date().toISOString(),
    };

    const newEncryptedNote = await encryptionService.encrypt(
      JSON.stringify(updatedNote)
    );
    notes[id] = newEncryptedNote;
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (!isUnlocked) throw new Error("Vault is locked");
    return await encryptionService.changePassword(currentPassword, newPassword);
  };

  const resetVault = async () => {
    setIsInitialized(false);
    setIsUnlocked(false);
    await invoke("reset_vault_credentials");
  };

  return (
    <VaultContext.Provider
      value={{
        isInitialized,
        isUnlocked,
        initializeVault,
        unlockVault,
        lockVault,
        addNote,
        getNote,
        listNotes,
        deleteNote,
        updateNote,
        changePassword,
        resetVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
};
