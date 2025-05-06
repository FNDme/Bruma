import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

export interface Note {
  title: string;
  subtitle: string;
  content: string;
  created_at: string;
  updated_at: string;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  parentId?: string;
}

interface JournalContextType {
  notes: Note[];
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  deleteFolderDialog: {
    isOpen: boolean;
    folder: Folder | null;
  };
  openDeleteFolderDialog: (folder: Folder) => void;
  closeDeleteFolderDialog: () => void;
  saveNote: (
    title: string,
    subtitle: string,
    content: string,
    folderId?: string
  ) => Promise<void>;
  loadNotes: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  editNote: (
    noteId: string,
    title: string,
    subtitle: string,
    content: string,
    folderId?: string
  ) => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  editFolder: (folderId: string, name: string) => Promise<void>;
  getSubfolders: (parentId?: string) => Folder[];
  getFolderPath: (folderId: string) => Folder[];
}

const STORAGE_KEY = "bruma-notes";
const FOLDERS_KEY = "bruma-folders";

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{
    isOpen: boolean;
    folder: Folder | null;
  }>({
    isOpen: false,
    folder: null,
  });

  useEffect(() => {
    loadNotes();
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const storedFolders = localStorage.getItem(FOLDERS_KEY);
      const loadedFolders = storedFolders ? JSON.parse(storedFolders) : [];
      setFolders(loadedFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
    }
  };

  const createFolder = async (name: string, parentId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newFolder: Folder = {
        id: new Date().toISOString(),
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        parentId,
      };

      const updatedFolders = [...folders, newFolder];
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
      setFolders(updatedFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteFolderDialog = (folder: Folder) => {
    setDeleteFolderDialog({
      isOpen: true,
      folder,
    });
  };

  const closeDeleteFolderDialog = () => {
    setDeleteFolderDialog({
      isOpen: false,
      folder: null,
    });
  };

  const deleteFolder = async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Get all subfolders to delete
      const subfolders = getSubfolders(folderId);
      const folderIdsToDelete = [folderId, ...subfolders.map((f) => f.id)];

      // Remove the folders
      const updatedFolders = folders.filter(
        (folder) => !folderIdsToDelete.includes(folder.id)
      );
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
      setFolders(updatedFolders);

      // Remove folder references from notes
      const updatedNotes = notes.map((note) => {
        if (folderIdsToDelete.includes(note.folderId!)) {
          return { ...note, folderId: undefined };
        }
        return note;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const editFolder = async (folderId: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedFolders = folders.map((folder) => {
        if (folder.id === folderId) {
          return {
            ...folder,
            name,
            updated_at: new Date().toISOString(),
          };
        }
        return folder;
      });
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
      setFolders(updatedFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit folder");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async (
    title: string,
    subtitle: string,
    content: string,
    folderId?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const newNote: Note = {
        title,
        subtitle,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        folderId,
      };

      const updatedNotes = [...notes, newNote];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedNotes = notes.filter((note) => note.created_at !== noteId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedNotes = localStorage.getItem(STORAGE_KEY);
      const loadedNotes = storedNotes ? JSON.parse(storedNotes) : [];
      setNotes(loadedNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  };

  const editNote = async (
    noteId: string,
    title: string,
    subtitle: string,
    content: string,
    folderId?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedNotes = notes.map((note) => {
        if (note.created_at === noteId) {
          return {
            ...note,
            title,
            subtitle,
            content,
            folderId,
            updated_at: new Date().toISOString(),
          };
        }
        return note;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit note");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getSubfolders = (parentId?: string): Folder[] => {
    return folders.filter((folder) => folder.parentId === parentId);
  };

  const getFolderPath = (folderId: string): Folder[] => {
    const path: Folder[] = [];
    let currentFolder = folders.find((f) => f.id === folderId);

    while (currentFolder) {
      path.unshift(currentFolder);
      currentFolder = currentFolder.parentId
        ? folders.find((f) => f.id === currentFolder!.parentId)
        : undefined;
    }

    return path;
  };

  return (
    <JournalContext.Provider
      value={{
        notes,
        folders,
        isLoading,
        error,
        deleteFolderDialog,
        openDeleteFolderDialog,
        closeDeleteFolderDialog,
        saveNote,
        loadNotes,
        deleteNote,
        editNote,
        createFolder,
        deleteFolder,
        editFolder,
        getSubfolders,
        getFolderPath,
      }}
    >
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const context = useContext(JournalContext);
  if (context === undefined) {
    throw new Error("useJournal must be used within a JournalProvider");
  }
  return context;
}
