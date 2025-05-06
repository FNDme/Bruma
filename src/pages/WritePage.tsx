import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useState, ChangeEvent, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";
import { PageLayout } from "@/components/layout/PageLayout";
import Code from "@tiptap/extension-code";

export function WritePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("folderId");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { saveNote, editNote, notes, isLoading: isSaving } = useJournal();
  const navigate = useNavigate();

  const editor = useEditor({
    extensions: [
      StarterKit,
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
      Code.configure({
        HTMLAttributes: {
          class:
            "rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-1 font-mono text-sm [&::before]:content-none [&::after]:content-none text-neutral-900 dark:text-neutral-200",
        },
      }),
    ],
  });

  useEffect(() => {
    if (noteId && editor) {
      const note = notes.find((n) => n.created_at === noteId);
      if (note) {
        setTitle(note.title);
        setSubtitle(note.subtitle);
        editor.commands.setContent(note.content);
      }
    }
  }, [noteId, editor, notes]);

  const handleSaveConfirm = async () => {
    if (!editor) return;
    try {
      const content = editor.getHTML();
      if (noteId) {
        await editNote(noteId, title, subtitle, content, folderId || undefined);
      } else {
        await saveNote(title, subtitle, content, folderId || undefined);
      }
      // Clear the editor and navigate to collection
      editor.commands.clearContent();
      setTitle("");
      setSubtitle("");
      setShowSaveDialog(false);
      if (folderId) {
        navigate(`/collection/folder/${folderId}`);
      } else {
        navigate("/collection");
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      // TODO: Show error toast
    }
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleSubtitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSubtitle(e.target.value);
  };

  if (!editor) {
    return null;
  }

  return (
    <PageLayout
      title={noteId ? "Edit Note" : "New Note"}
      headerActions={
        <div className="flex items-center gap-2">
          <EditorToolbar editor={editor} />
          <Button
            variant="default"
            size="sm"
            disabled={isSaving}
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 h-full overflow-hidden pb-16">
        <input
          placeholder="Title"
          value={title}
          onChange={handleTitleChange}
          className="text-2xl font-bold h-12 border rounded-md bg-transparent p-4 focus:outline-none"
        />
        <input
          placeholder="Subtitle"
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

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-lg font-semibold mb-2">Save Note</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to save this note and return to the
              collection?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveConfirm} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
