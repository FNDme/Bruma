import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useState, ChangeEvent, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";

export function WritePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { saveNote, editNote, notes, isLoading: isSaving } = useJournal();
  const navigate = useNavigate();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: "Start writing your content here...",
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
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
        await editNote(noteId, title, subtitle, content);
      } else {
        await saveNote(title, subtitle, content);
      }
      // Clear the editor and navigate to collection
      editor.commands.clearContent();
      setTitle("");
      setSubtitle("");
      setShowSaveDialog(false);
      navigate("/collection");
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
    <div className="h-full flex flex-col">
      <div className="flex justify-end items-center gap-2 mb-4">
        <EditorToolbar editor={editor} />
        <Button
          variant="default"
          size="sm"
          disabled={isSaving}
          className="ml-2"
          onClick={() => setShowSaveDialog(true)}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
      <div className="flex-1 flex flex-col gap-4">
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
        <div className="flex-1 overflow-auto border rounded-md bg-transparent">
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[200px] p-4"
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
    </div>
  );
}
