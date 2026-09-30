import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  STORAGE_KEYS,
  isOptionalString,
  isRecord,
  isString,
  readJsonArray,
  writeJson,
} from "@/lib/storage";

export interface Note {
  /**
   * Stable identifier used in routes. Notes created before ids existed are
   * backfilled with their `created_at` value on load, so old URLs keep working.
   */
  id: string;
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

/** Fields of a note that can be changed after creation. */
export type NotePatch = Partial<
  Pick<Note, "title" | "subtitle" | "content" | "folderId">
>;

/**
 * What happens to a folder's contents when it is deleted:
 * - "move-to-parent": only the folder is removed; its notes and subfolders
 *   move up one level (to the root if it had no parent).
 * - "delete-all": the folder, every nested subfolder and all their notes are
 *   permanently removed.
 */
export type FolderDeleteMode = "move-to-parent" | "delete-all";

export interface FolderStats {
  /** Notes in the folder and all nested subfolders. */
  noteCount: number;
  /** Nested subfolders at any depth (not counting the folder itself). */
  subfolderCount: number;
  /** Notes directly in the folder. */
  directNoteCount: number;
  /** Direct child folders. */
  directSubfolderCount: number;
}

export const MAX_FOLDER_NAME_LENGTH = 100;

interface JournalContextType {
  notes: Note[];
  folders: Folder[];
  isLoading: boolean;
  /** Last storage error from a load or mutation; cleared by the next one. */
  error: string | null;
  clearError: () => void;
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
  ) => Promise<Note>;
  loadNotes: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  /**
   * Merge `patch` into an existing note. Fields that are not present in the
   * patch (including `folderId`) are left untouched.
   */
  editNote: (noteId: string, patch: NotePatch) => Promise<Note>;
  /** Move a note into a folder, or to the root when `folderId` is undefined. */
  moveNote: (noteId: string, folderId?: string) => Promise<void>;
  /** Look a note up by id (or by created_at, for links made before ids). */
  getNote: (noteId: string | undefined) => Note | undefined;
  createFolder: (name: string, parentId?: string) => Promise<Folder>;
  deleteFolder: (folderId: string, mode?: FolderDeleteMode) => Promise<void>;
  editFolder: (folderId: string, name: string) => Promise<void>;
  getSubfolders: (parentId?: string) => Folder[];
  getFolderPath: (folderId: string) => Folder[];
  /** Human readable location, e.g. "Work / Projects". Root is "Unfiled". */
  getFolderLabel: (folderId?: string) => string;
  getDescendantFolderIds: (folderId: string) => string[];
  getFolderStats: (folderId: string) => FolderStats;
  /** Returns an error message, or null when the name is acceptable. */
  validateFolderName: (
    name: string,
    parentId?: string,
    excludeFolderId?: string
  ) => string | null;
}

const STORAGE_KEY = STORAGE_KEYS.notes;
const FOLDERS_KEY = STORAGE_KEYS.folders;

type StoredNote = Partial<Note> & { created_at: string };
type StoredFolder = Partial<Folder> & { id: string };

// Notes are identified by id (falling back to created_at for older data);
// everything else is optional on disk and defaulted on load so older or
// partially written entries still render.
function isStoredNote(value: unknown): value is StoredNote {
  return (
    isRecord(value) &&
    isString(value.created_at) &&
    isOptionalString(value.id) &&
    isOptionalString(value.title) &&
    isOptionalString(value.subtitle) &&
    isOptionalString(value.content) &&
    isOptionalString(value.updated_at) &&
    isOptionalString(value.folderId)
  );
}

function isStoredFolder(value: unknown): value is StoredFolder {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isOptionalString(value.name) &&
    isOptionalString(value.created_at) &&
    isOptionalString(value.updated_at) &&
    isOptionalString(value.parentId)
  );
}

function normalizeNote(note: StoredNote): Note {
  return {
    ...note,
    id: note.id || note.created_at,
    title: note.title ?? "",
    subtitle: note.subtitle ?? "",
    content: note.content ?? "",
    created_at: note.created_at,
    updated_at: note.updated_at ?? note.created_at,
  };
}

function normalizeFolder(folder: StoredFolder): Folder {
  return {
    ...folder,
    id: folder.id,
    name: folder.name ?? "Untitled folder",
    created_at: folder.created_at ?? folder.id,
    updated_at: folder.updated_at ?? folder.created_at ?? folder.id,
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Make older or damaged data reachable again:
 * - folders whose parent no longer exists (or that form a parent cycle) are
 *   moved to the root;
 * - notes that point at a missing folder become unfiled.
 * This only rewrites references; nothing is ever dropped.
 */
export function repairJournal(
  notes: Note[],
  folders: Folder[]
): { notes: Note[]; folders: Folder[]; repaired: boolean } {
  let repaired = false;
  const byId = new Map<string, Folder>();
  for (const folder of folders) byId.set(folder.id, { ...folder });

  for (const folder of byId.values()) {
    if (
      folder.parentId !== undefined &&
      (!byId.has(folder.parentId) || folder.parentId === folder.id)
    ) {
      folder.parentId = undefined;
      repaired = true;
    }
  }

  // Break parent cycles (A -> B -> A) so path walks always terminate.
  for (const folder of byId.values()) {
    const seen = new Set<string>([folder.id]);
    let current = folder;
    while (current.parentId !== undefined) {
      if (seen.has(current.parentId)) {
        current.parentId = undefined;
        repaired = true;
        break;
      }
      seen.add(current.parentId);
      current = byId.get(current.parentId)!;
    }
  }

  const repairedFolders = folders.map((f) => byId.get(f.id) ?? f);
  const repairedNotes = notes.map((note) => {
    if (note.folderId !== undefined && !byId.has(note.folderId)) {
      repaired = true;
      return { ...note, folderId: undefined };
    }
    return note;
  });

  return { notes: repairedNotes, folders: repairedFolders, repaired };
}

function readJournal(): { notes: Note[]; folders: Folder[] } {
  const notes = readJsonArray(STORAGE_KEY, isStoredNote).map(normalizeNote);
  const folders = readJsonArray(FOLDERS_KEY, isStoredFolder).map(
    normalizeFolder
  );
  const result = repairJournal(notes, folders);
  if (result.repaired) {
    console.warn(
      "Journal data referenced missing folders; affected items were moved to the root."
    );
  }
  return { notes: result.notes, folders: result.folders };
}

function persist(key: string, value: unknown) {
  if (!writeJson(key, value)) {
    throw new Error(
      "Failed to save to local storage. Your storage may be full or unavailable."
    );
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: ReactNode }) {
  // Read synchronously so a reload on a note/folder URL does not flash
  // "not found" before the effect runs.
  const [initial] = useState(readJournal);
  const [notes, setNotes] = useState<Note[]>(initial.notes);
  const [folders, setFolders] = useState<Folder[]>(initial.folders);
  // Refs always hold the latest committed data, so back-to-back mutations
  // never work from a stale render's closure.
  const notesRef = useRef<Note[]>(initial.notes);
  const foldersRef = useRef<Folder[]>(initial.folders);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{
    isOpen: boolean;
    folder: Folder | null;
  }>({
    isOpen: false,
    folder: null,
  });

  const commitNotes = (next: Note[]) => {
    persist(STORAGE_KEY, next);
    notesRef.current = next;
    setNotes(next);
  };

  const commitFolders = (next: Folder[]) => {
    persist(FOLDERS_KEY, next);
    foldersRef.current = next;
    setFolders(next);
  };

  /** Run a mutation, recording (and re-throwing) any failure. */
  const run = async <T,>(fallbackError: string, fn: () => T): Promise<T> => {
    setError(null);
    try {
      return fn();
    } catch (err) {
      setError(errorMessage(err, fallbackError));
      throw err;
    }
  };

  const loadNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = readJournal();
      notesRef.current = loaded.notes;
      foldersRef.current = loaded.folders;
      setNotes(loaded.notes);
      setFolders(loaded.folders);
    } catch (err) {
      setError(errorMessage(err, "Failed to load notes"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Also pick up changes made in another window of the app.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === FOLDERS_KEY) {
        loadNotes();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ---------- folder queries ----------

  const getSubfolders = (parentId?: string): Folder[] =>
    folders.filter((folder) => folder.parentId === parentId);

  const getFolderPath = (folderId: string): Folder[] => {
    const path: Folder[] = [];
    const seen = new Set<string>();
    let currentFolder = folders.find((f) => f.id === folderId);

    while (currentFolder && !seen.has(currentFolder.id)) {
      seen.add(currentFolder.id);
      path.unshift(currentFolder);
      const parentId = currentFolder.parentId;
      currentFolder = parentId
        ? folders.find((f) => f.id === parentId)
        : undefined;
    }

    return path;
  };

  const getFolderLabel = (folderId?: string): string => {
    if (!folderId) return "Unfiled";
    const path = getFolderPath(folderId);
    return path.length ? path.map((f) => f.name).join(" / ") : "Unfiled";
  };

  const descendantIds = (source: Folder[], folderId: string): string[] => {
    const result: string[] = [];
    const queue = [folderId];
    const seen = new Set<string>([folderId]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const folder of source) {
        if (folder.parentId === current && !seen.has(folder.id)) {
          seen.add(folder.id);
          result.push(folder.id);
          queue.push(folder.id);
        }
      }
    }
    return result;
  };

  const getDescendantFolderIds = (folderId: string) =>
    descendantIds(folders, folderId);

  const getFolderStats = (folderId: string): FolderStats => {
    const nested = descendantIds(folders, folderId);
    const all = new Set([folderId, ...nested]);
    return {
      noteCount: notes.filter((n) => n.folderId && all.has(n.folderId)).length,
      subfolderCount: nested.length,
      directNoteCount: notes.filter((n) => n.folderId === folderId).length,
      directSubfolderCount: folders.filter((f) => f.parentId === folderId)
        .length,
    };
  };

  const validateFolderNameIn = (
    source: Folder[],
    name: string,
    parentId?: string,
    excludeFolderId?: string
  ): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Folder name cannot be empty.";
    if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
      return `Folder name must be at most ${MAX_FOLDER_NAME_LENGTH} characters.`;
    }
    const lower = trimmed.toLocaleLowerCase();
    const duplicate = source.some(
      (f) =>
        f.id !== excludeFolderId &&
        f.parentId === parentId &&
        f.name.trim().toLocaleLowerCase() === lower
    );
    if (duplicate) {
      return `A folder named "${trimmed}" already exists here.`;
    }
    return null;
  };

  const validateFolderName = (
    name: string,
    parentId?: string,
    excludeFolderId?: string
  ) => validateFolderNameIn(folders, name, parentId, excludeFolderId);

  // ---------- folder mutations ----------

  const createFolder = (name: string, parentId?: string) =>
    run("Failed to create folder", () => {
      const current = foldersRef.current;
      if (parentId && !current.some((f) => f.id === parentId)) {
        throw new Error("The parent folder no longer exists.");
      }
      const invalid = validateFolderNameIn(current, name, parentId);
      if (invalid) throw new Error(invalid);

      const now = new Date().toISOString();
      const newFolder: Folder = {
        id: newId(),
        name: name.trim(),
        created_at: now,
        updated_at: now,
        parentId,
      };
      commitFolders([...current, newFolder]);
      return newFolder;
    });

  const editFolder = (folderId: string, name: string) =>
    run("Failed to rename folder", () => {
      const current = foldersRef.current;
      const target = current.find((f) => f.id === folderId);
      if (!target) throw new Error("Folder not found.");
      const invalid = validateFolderNameIn(
        current,
        name,
        target.parentId,
        folderId
      );
      if (invalid) throw new Error(invalid);

      commitFolders(
        current.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                name: name.trim(),
                updated_at: new Date().toISOString(),
              }
            : folder
        )
      );
    });

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

  const deleteFolder = (
    folderId: string,
    mode: FolderDeleteMode = "move-to-parent"
  ) =>
    run("Failed to delete folder", () => {
      const currentFolders = foldersRef.current;
      const currentNotes = notesRef.current;
      const target = currentFolders.find((f) => f.id === folderId);
      if (!target) throw new Error("Folder not found.");

      // Notes are written first: if the folder write then fails, the notes are
      // already somewhere reachable and the repair pass cleans up on load.
      if (mode === "delete-all") {
        const doomed = new Set([
          folderId,
          ...descendantIds(currentFolders, folderId),
        ]);
        commitNotes(
          currentNotes.filter(
            (note) => !(note.folderId && doomed.has(note.folderId))
          )
        );
        commitFolders(currentFolders.filter((f) => !doomed.has(f.id)));
      } else {
        const parentId = target.parentId;
        const now = new Date().toISOString();
        commitNotes(
          currentNotes.map((note) =>
            note.folderId === folderId
              ? { ...note, folderId: parentId, updated_at: now }
              : note
          )
        );
        // Move direct children up one level; if a name collides with a
        // sibling at the new level, keep both but make the moved one distinct.
        const remaining = currentFolders.filter((f) => f.id !== folderId);
        const siblings = remaining.filter((f) => f.parentId === parentId);
        const taken = new Set(
          siblings.map((f) => f.name.trim().toLocaleLowerCase())
        );
        commitFolders(
          remaining.map((folder) => {
            if (folder.parentId !== folderId) return folder;
            let name = folder.name;
            if (taken.has(name.trim().toLocaleLowerCase())) {
              const base = `${name} (from ${target.name})`;
              name = base;
              let n = 2;
              while (taken.has(name.toLocaleLowerCase())) {
                name = `${base} ${n++}`;
              }
            }
            taken.add(name.trim().toLocaleLowerCase());
            return { ...folder, name, parentId, updated_at: now };
          })
        );
      }
    });

  // ---------- notes ----------

  const findNote = (source: Note[], noteId: string | undefined) =>
    noteId
      ? source.find((n) => n.id === noteId) ??
        source.find((n) => n.created_at === noteId)
      : undefined;

  const getNote = (noteId: string | undefined) => findNote(notes, noteId);

  const saveNote = (
    title: string,
    subtitle: string,
    content: string,
    folderId?: string
  ) =>
    run("Failed to save note", () => {
      const validFolder =
        folderId && foldersRef.current.some((f) => f.id === folderId)
          ? folderId
          : undefined;
      const now = new Date().toISOString();
      const newNote: Note = {
        id: newId(),
        title,
        subtitle,
        content,
        created_at: now,
        updated_at: now,
        folderId: validFolder,
      };
      commitNotes([...notesRef.current, newNote]);
      return newNote;
    });

  const deleteNote = (noteId: string) =>
    run("Failed to delete note", () => {
      const target = findNote(notesRef.current, noteId);
      if (!target) throw new Error("Note not found.");
      commitNotes(notesRef.current.filter((note) => note !== target));
    });

  const editNote = (noteId: string, patch: NotePatch) =>
    run("Failed to save note", () => {
      const current = notesRef.current;
      const target = findNote(current, noteId);
      if (!target) throw new Error("Note not found. It may have been deleted.");
      if (
        "folderId" in patch &&
        patch.folderId !== undefined &&
        !foldersRef.current.some((f) => f.id === patch.folderId)
      ) {
        throw new Error("The selected folder no longer exists.");
      }
      const updated: Note = {
        ...target,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      if ("folderId" in patch && patch.folderId === undefined) {
        delete updated.folderId;
      }
      commitNotes(current.map((note) => (note === target ? updated : note)));
      return updated;
    });

  const moveNote = async (noteId: string, folderId?: string) => {
    await editNote(noteId, { folderId });
  };

  return (
    <JournalContext.Provider
      value={{
        notes,
        folders,
        isLoading,
        error,
        clearError: () => setError(null),
        deleteFolderDialog,
        openDeleteFolderDialog,
        closeDeleteFolderDialog,
        saveNote,
        loadNotes,
        deleteNote,
        editNote,
        moveNote,
        getNote,
        createFolder,
        deleteFolder,
        editFolder,
        getSubfolders,
        getFolderPath,
        getFolderLabel,
        getDescendantFolderIds,
        getFolderStats,
        validateFolderName,
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
