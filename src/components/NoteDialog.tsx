import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./editor/EditorToolbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "view";
  initialTitle?: string;
  initialContent?: string;
  onSave?: (title: string, content: string) => Promise<void>;
  onCancel?: () => void;
}

export const NoteDialog: React.FC<NoteDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initialTitle = "",
  initialContent = "",
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    content: initialContent,
    editable: mode !== "view",
  });

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      if (editor) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [open, initialTitle, initialContent, editor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !onSave) return;

    setIsSubmitting(true);
    try {
      const content = editor.getHTML();
      await onSave(title, content);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  if (!editor) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Note" : title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== "view" && (
            <Input
              autoComplete="off"
              id="title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTitle(e.target.value)
              }
              placeholder="Title"
              required
              disabled={isSubmitting}
            />
          )}

          <div className="space-y-2">
            <div className="border rounded-md">
              <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[300px] p-4"
              />
            </div>
            <EditorToolbar editor={editor} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {mode === "view" ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "add"
                  ? "Adding..."
                  : "Saving..."
                : mode === "add"
                ? "Add Note"
                : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
