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
}

interface JournalContextType {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  saveNote: (title: string, subtitle: string, content: string) => Promise<void>;
  loadNotes: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
}

const STORAGE_KEY = "bruma-notes";

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const saveNote = async (title: string, subtitle: string, content: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newNote: Note = {
        title,
        subtitle,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

  return (
    <JournalContext.Provider
      value={{
        notes,
        isLoading,
        error,
        saveNote,
        loadNotes,
        deleteNote,
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
