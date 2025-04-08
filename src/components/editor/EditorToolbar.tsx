import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={
          editor.isActive("bold") ? "!bg-primary/10 !text-primary" : ""
        }
        title={editor.isActive("bold") ? "Bold (Active)" : "Bold"}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={
          editor.isActive("italic") ? "!bg-primary/10 !text-primary" : ""
        }
        title={editor.isActive("italic") ? "Italic (Active)" : "Italic"}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        className={
          editor.isActive("underline") ? "!bg-primary/20 !text-primary" : ""
        }
        title={
          editor.isActive("underline") ? "Underline (Active)" : "Underline"
        }
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={
          editor.isActive("strike") ? "!bg-primary/20 !text-primary" : ""
        }
        title={
          editor.isActive("strike") ? "Strikethrough (Active)" : "Strikethrough"
        }
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={
          editor.isActive("bulletList") ? "!bg-primary/20 !text-primary" : ""
        }
        title={
          editor.isActive("bulletList") ? "Bullet List (Active)" : "Bullet List"
        }
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={
          editor.isActive("orderedList") ? "!bg-primary/20 !text-primary" : ""
        }
        title={
          editor.isActive("orderedList")
            ? "Ordered List (Active)"
            : "Ordered List"
        }
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
}
