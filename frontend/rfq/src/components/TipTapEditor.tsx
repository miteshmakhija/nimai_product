import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

interface Props {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export default function TipTapEditor({ content, onChange, editable = true }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      {editable && (
        <div className="flex flex-wrap gap-1 p-2 bg-base-200 border-b border-base-300">
          <button
            className={`btn btn-ghost btn-xs${editor.isActive('bold') ? ' btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            type="button"
          >
            B
          </button>
          <button
            className={`btn btn-ghost btn-xs italic${editor.isActive('italic') ? ' btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            type="button"
          >
            I
          </button>
          <div className="divider divider-horizontal m-0" />
          <button
            className={`btn btn-ghost btn-xs${editor.isActive('bulletList') ? ' btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            type="button"
          >
            •—
          </button>
          <button
            className={`btn btn-ghost btn-xs${editor.isActive('orderedList') ? ' btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            type="button"
          >
            1—
          </button>
          <div className="divider divider-horizontal m-0" />
          <button
            className="btn btn-ghost btn-xs"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            type="button"
          >
            Table
          </button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose max-w-none p-4 min-h-[400px] focus:outline-none"
      />
    </div>
  );
}
