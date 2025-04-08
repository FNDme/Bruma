import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export function WritePage() {
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
    console.log("Saving content:", content);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Write</h1>
        <div className="flex items-center gap-2">
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
      </div>
      <div className="overflow-auto border rounded-md bg-background">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[200px] p-4"
        />
      </div>
    </div>
  );
}
