import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, History, Save } from "lucide-react";
import {
  useState,
  ChangeEvent,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  BlockerFunction,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { useJournal } from "@/contexts/JournalContext";
import { PageLayout } from "@/components/layout/PageLayout";
import { FolderSelect } from "@/components/journal/FolderSelect";
import {
  isNumber,
  isOptionalString,
  isRecord,
  isString,
  noteDraftKey,
  readJson,
  removeKey,
  writeJson,
} from "@/lib/storage";

const AUTOSAVE_DELAY_MS = 800;
const DEFAULT_TITLE = "Untitled";

interface Snapshot {
  title: string;
  subtitle: string;
  content: string;
  folderId?: string;
}

interface Draft extends Snapshot {
  savedAt: number;
}

function isDraft(value: unknown): value is Draft {
  return (
    isRecord(value) &&
    isString(value.title) &&
    isString(value.subtitle) &&
    isString(value.content) &&
    isOptionalString(value.folderId) &&
    isNumber(value.savedAt)
  );
}

/** Editor HTML, with an empty document normalized to "". */
function editorHtml(editor: Editor): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

function sameSnapshot(a: Snapshot, b: Snapshot) {
  return (
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.content === b.content &&
    (a.folderId ?? undefined) === (b.folderId ?? undefined)
  );
}

export function WritePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const folderParam = searchParams.get("folderId") ?? undefined;
  const { saveNote, editNote, getNote, folders } = useJournal();
  const navigate = useNavigate();

  const isEdit = Boolean(noteId);
  const existing = getNote(noteId);
  // Key drafts by the note's stable id when we know it.
  const draftKey = noteDraftKey(existing?.id ?? noteId);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [baseline, setBaseline] = useState<Snapshot | null>(null);
  // The page key the baseline was loaded for. While it differs from the
  // current key (the same WritePage instance just moved to another note), the
  // page is treated as uninitialised so nothing touches the new note's draft.
  const [baselineKey, setBaselineKey] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: {
          HTMLAttributes: {
            class:
              "rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-1 font-mono text-sm [&::before]:content-none [&::after]:content-none text-neutral-900 dark:text-neutral-200",
          },
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-500 hover:text-blue-700 underline",
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing your content here...",
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    onUpdate: ({ editor }) => setContent(editorHtml(editor)),
  });

  const pageKey = noteId ?? `new:${folderParam ?? ""}`;
  const isLoaded = baseline !== null && baselineKey === pageKey;
  const current: Snapshot = { title, subtitle, content, folderId };
  const isDirty = isLoaded && !sameSnapshot(current, baseline);

  // Refs for callbacks that must see the latest values (blocker, keyboard).
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;
  const bypassBlockerRef = useRef(false);
  const autosaveTimer = useRef<number | undefined>(undefined);
  const savingRef = useRef(false);

  // ---------- initialise once per note ----------
  const initializedFor = useRef<string | null>(null);
  // Id of a new note that Cmd/Ctrl+S just saved; the editor already holds it.
  const justSavedId = useRef<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    const key = pageKey;
    if (initializedFor.current === key) return;
    if (noteId && justSavedId.current === noteId) {
      // Same WritePage instance moved from /new to /:id/edit after a save.
      // Don't reload the content: that would move the caret and add an undo step.
      justSavedId.current = null;
      initializedFor.current = key;
      setBaselineKey(key);
      bypassBlockerRef.current = false;
      return;
    }
    if (isEdit && !existing) return; // wait for the note (or show not found)
    initializedFor.current = key;
    bypassBlockerRef.current = false;

    const source: Snapshot = existing
      ? {
          title: existing.title,
          subtitle: existing.subtitle,
          content: existing.content,
          folderId: existing.folderId,
        }
      : {
          title: "",
          subtitle: "",
          content: "",
          folderId:
            folderParam && folders.some((f) => f.id === folderParam)
              ? folderParam
              : undefined,
        };

    // Loading a note must not become an undo step (Undo would otherwise
    // bring back the previous note's text or empty the freshly loaded one).
    editor
      .chain()
      .setMeta("addToHistory", false)
      .setContent(source.content || "", false)
      .run();
    const normalized: Snapshot = { ...source, content: editorHtml(editor) };
    setTitle(normalized.title);
    setSubtitle(normalized.subtitle);
    setContent(normalized.content);
    setFolderId(normalized.folderId);
    setBaseline(normalized);
    setBaselineKey(key);
    setDraftSavedAt(null);

    const draft = readJson<Draft | null>(draftKey, null, isDraft);
    if (draft && !sameSnapshot(draft, normalized)) {
      setPendingDraft(draft);
    } else {
      setPendingDraft(null);
      if (draft) removeKey(draftKey);
    }
  }, [editor, pageKey, noteId, isEdit, existing, folderParam, folders, draftKey]);

  // ---------- autosave draft ----------
  const writeDraft = useCallback(
    (snapshot: Snapshot) => {
      const savedAt = Date.now();
      if (writeJson(draftKey, { ...snapshot, savedAt })) {
        setDraftSavedAt(savedAt);
      }
    },
    [draftKey]
  );

  useEffect(() => {
    // Not loaded for this key yet, or an unrestored draft exists: don't touch it.
    if (!isLoaded || pendingDraft) return;
    window.clearTimeout(autosaveTimer.current);
    if (!isDirty) {
      removeKey(draftKey);
      setDraftSavedAt(null);
      return;
    }
    const snapshot = { title, subtitle, content, folderId };
    autosaveTimer.current = window.setTimeout(
      () => writeDraft(snapshot),
      AUTOSAVE_DELAY_MS
    );
    return () => window.clearTimeout(autosaveTimer.current);
  }, [
    title,
    subtitle,
    content,
    folderId,
    isDirty,
    isLoaded,
    pendingDraft,
    draftKey,
    writeDraft,
  ]);

  // Flush the draft immediately if the window is closed or reloaded.
  const latestRef = useRef<Snapshot>(current);
  latestRef.current = current;
  const pendingDraftRef = useRef(false);
  pendingDraftRef.current = pendingDraft !== null;
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || bypassBlockerRef.current) return;
      // Never overwrite a draft the user hasn't restored or discarded yet.
      if (!pendingDraftRef.current) {
        writeJson(draftKey, { ...latestRef.current, savedAt: Date.now() });
      }
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [draftKey]);

  const restoreDraft = () => {
    if (!editor || !pendingDraft) return;
    editor
      .chain()
      .setMeta("addToHistory", false)
      .setContent(pendingDraft.content || "", false)
      .run();
    setTitle(pendingDraft.title);
    setSubtitle(pendingDraft.subtitle);
    setContent(editorHtml(editor));
    setFolderId(
      pendingDraft.folderId && folders.some((f) => f.id === pendingDraft.folderId)
        ? pendingDraft.folderId
        : undefined
    );
    setPendingDraft(null);
    toast.success("Draft restored");
  };

  const discardDraft = () => {
    removeKey(draftKey);
    setPendingDraft(null);
  };

  // ---------- save ----------
  /**
   * Save the note. `after` decides where to go next:
   * - "view": open the saved note (Save button);
   * - "stay": keep editing (Cmd/Ctrl+S); a new note switches to its edit URL;
   * - "none": do not navigate (used by the leave-page guard).
   */
  const handleSave = async (after: "view" | "stay" | "none" = "view") => {
    // A ref, not state, so two quick Cmd+S presses can't create two notes.
    if (!editor || savingRef.current || baseline === null || !isLoaded)
      return false;
    const html = editorHtml(editor);
    const finalTitle = title.trim() || DEFAULT_TITLE;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const saved =
        isEdit && noteId
          ? await editNote(noteId, {
              title: finalTitle,
              subtitle,
              content: html,
              // Only touch the folder when the user actually changed it.
              ...(folderId !== baseline.folderId ? { folderId } : {}),
            })
          : await saveNote(finalTitle, subtitle, html, folderId);

      window.clearTimeout(autosaveTimer.current);
      removeKey(draftKey);
      setPendingDraft(null);
      const snapshot = { title: finalTitle, subtitle, content: html, folderId };
      setTitle(finalTitle);
      setBaseline(snapshot);
      dirtyRef.current = false;
      setDraftSavedAt(null);
      toast.success("Note saved");

      if (after === "view" || (after === "stay" && !isEdit)) {
        bypassBlockerRef.current = true;
        if (after === "stay") justSavedId.current = saved.id;
        navigate(
          after === "view"
            ? `/collection/${saved.id}`
            : `/collection/${saved.id}/edit`,
          { replace: true }
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to save note:", error);
      toast.error("Couldn't save note", {
        description:
          error instanceof Error
            ? `${error.message} Your draft is kept on this device.`
            : "Your draft is kept on this device.",
      });
      // Make sure the latest text is in the draft so nothing is lost.
      writeDraft({ title, subtitle, content: html, folderId });
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  // Cmd/Ctrl+S saves from anywhere on the page, including inside the editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        if (!event.repeat) void saveRef.current("stay");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ---------- unsaved-changes guard ----------
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      !bypassBlockerRef.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
    []
  );
  const blocker = useBlocker(shouldBlock);

  const leaveWithoutSaving = () => {
    window.clearTimeout(autosaveTimer.current);
    removeKey(draftKey);
    bypassBlockerRef.current = true;
    if (blocker.state === "blocked") blocker.proceed();
  };

  const saveAndLeave = async () => {
    const ok = await handleSave("none");
    if (ok && blocker.state === "blocked") {
      bypassBlockerRef.current = true;
      blocker.proceed();
    }
  };

  const handleBack = () => {
    if (existing) navigate(`/collection/${existing.id}`);
    else navigate(folderId ? `/collection/folder/${folderId}` : "/collection");
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleSubtitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSubtitle(e.target.value);
  };

  if (isEdit && !existing) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Note not found</h1>
        <Button onClick={() => navigate("/collection")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collection
        </Button>
      </div>
    );
  }

  if (!editor) {
    return null;
  }

  const status = isSaving
    ? "Saving..."
    : isDirty
    ? draftSavedAt
      ? `Unsaved changes · draft kept ${format(draftSavedAt, "p")}`
      : "Unsaved changes"
    : "";

  return (
    <PageLayout
      title={isEdit ? "Edit Note" : "New Note"}
      headerActions={
        <div className="flex items-center gap-2">
          {status && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {status}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isSaving}
            onClick={() => void handleSave("view")}
            title={`Save (${
              /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘S" : "Ctrl+S"
            })`}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 h-full overflow-hidden pb-16">
        {pendingDraft && (
          <Alert>
            <History className="h-4 w-4" />
            <AlertTitle>Unsaved draft found</AlertTitle>
            <AlertDescription>
              <p>
                You have changes from{" "}
                {format(pendingDraft.savedAt, "PPP 'at' p")} that were never
                saved
                {pendingDraft.title ? ` ("${pendingDraft.title}")` : ""}.
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={restoreDraft}>
                  Restore draft
                </Button>
                <Button size="sm" variant="outline" onClick={discardDraft}>
                  Discard draft
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <EditorToolbar editor={editor} />
          <div className="flex items-center gap-2">
            <label
              htmlFor="note-folder"
              className="text-sm text-muted-foreground"
            >
              Folder
            </label>
            <FolderSelect
              id="note-folder"
              value={folderId}
              onChange={setFolderId}
              disabled={isSaving}
            />
          </div>
        </div>
        <input
          placeholder="Title"
          aria-label="Title"
          value={title}
          onChange={handleTitleChange}
          className="text-2xl font-bold h-12 border rounded-md bg-transparent p-4 focus:outline-none"
        />
        <input
          placeholder="Subtitle"
          aria-label="Subtitle"
          value={subtitle}
          onChange={handleSubtitleChange}
          className="text-lg text-muted-foreground border rounded-md bg-transparent p-4 focus:outline-none"
        />
        <div className="flex-1 overflow-auto border rounded-md bg-transparent min-h-0">
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none dark:prose-invert focus:outline-none p-4"
          />
        </div>
      </div>

      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have changes to this note that haven't been saved. What would
              you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => blocker.state === "blocked" && blocker.reset()}
              disabled={isSaving}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={leaveWithoutSaving}
              disabled={isSaving}
            >
              Discard changes
            </Button>
            <Button onClick={() => void saveAndLeave()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save and leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
