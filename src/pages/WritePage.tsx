import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useState, ChangeEvent } from "react";

export function WritePage() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

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

  const handleSave = () => {
    if (!editor) return;
    const content = editor.getHTML();
    // TODO: Implement actual save functionality
    console.log("Saving content:", { title, subtitle, content });
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
          onClick={handleSave}
          className="ml-2"
        >
          <Save className="h-4 w-4 mr-2" />
          Save
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
    </div>
  );
}
