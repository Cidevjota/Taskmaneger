import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Palette,
  Minus,
  Table as TableIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  taskId: string;
  content: string;
  onChange: (content: string) => void;
  variant?: 'default' | 'borderless';
  wrapperClassName?: string;
}

const COLORS = [
  { hex: '#eab308', label: 'Amarelo (Design)' },
  { hex: '#ec4899', label: 'Rosa (Copy)' },
  { hex: '#3b82f6', label: 'Azul (Tarefa)' },
  { hex: '#10b981', label: 'Verde (Orçamento)' },
  { hex: '#a855f7', label: 'Roxo (Social Mídia)' },
  { hex: '#ffffff', label: 'Branco' },
  { hex: '#a1a1aa', label: 'Cinza' },
];

type ToolbarButton = {
  icon: React.ReactNode;
  title: string;
  action: () => void;
  isActive?: () => boolean;
  disabled?: () => boolean;
};

function MenuBar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [isColorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!editor) return null;

  const groups: ToolbarButton[][] = [
    [
      {
        icon: <span style={{ fontWeight: 800, fontSize: 12, fontFamily: 'inherit', lineHeight: 1 }}>H1</span>,
        title: 'Título 1 (22px)',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 }),
      },
      {
        icon: <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'inherit', lineHeight: 1 }}>H2</span>,
        title: 'Título 2 (18px)',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 }),
      },
      {
        icon: <span style={{ fontWeight: 600, fontSize: 11, fontFamily: 'inherit', lineHeight: 1 }}>H3</span>,
        title: 'Título 3 (label pequeño)',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive('heading', { level: 3 }),
      },
    ],
    [
      {
        icon: <Bold size={14} />,
        title: 'Negrito (Ctrl+B)',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold'),
        disabled: () => !editor.can().chain().focus().toggleBold().run(),
      },
      {
        icon: <Italic size={14} />,
        title: 'Itálico (Ctrl+I)',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic'),
        disabled: () => !editor.can().chain().focus().toggleItalic().run(),
      },
      {
        icon: <Strikethrough size={14} />,
        title: 'Riscado',
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive('strike'),
        disabled: () => !editor.can().chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        icon: <List size={14} />,
        title: 'Lista (bullet)',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
      },
      {
        icon: <ListOrdered size={14} />,
        title: 'Lista numerada',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList'),
      },
      {
        icon: <CheckSquare size={14} />,
        title: 'Checklist',
        action: () => editor.chain().focus().toggleTaskList().run(),
        isActive: () => editor.isActive('taskList'),
      },
      {
        icon: <TableIcon size={14} />,
        title: 'Inserir Tabela (3x3)',
        action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        isActive: () => editor.isActive('table'),
      },
    ],
    [
      {
        icon: <Minus size={14} />,
        title: 'Separador',
        action: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
  ];

  return (
    <div className="rte-toolbar">
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div className="rte-divider" />}
          {group.map((btn, bi) => (
            <button
              key={bi}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                btn.action();
              }}
              disabled={btn.disabled ? btn.disabled() : false}
              title={btn.title}
              className={`rte-btn ${btn.isActive && btn.isActive() ? 'rte-btn--active' : ''}`}
            >
              {btn.icon}
            </button>
          ))}
        </React.Fragment>
      ))}

      {/* Color picker */}
      <div className="rte-divider" />
      <div style={{ position: 'relative' }} ref={colorRef}>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setColorOpen((p) => !p);
          }}
          title="Cor do texto"
          className="rte-btn"
          style={{ position: 'relative' }}
        >
          <Palette size={14} />
          {/* Indicator dot showing current color */}
          {editor.isActive('textStyle') && (
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: editor.getAttributes('textStyle').color || '#fff',
              }}
            />
          )}
        </button>

        {isColorOpen && (
          <div className="rte-color-panel">
            {COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().setColor(c.hex).run();
                  setColorOpen(false);
                }}
                className="rte-color-swatch"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().unsetColor().run();
                setColorOpen(false);
              }}
              className="rte-color-reset"
            >
              Resetar cor
            </button>
          </div>
        )}
      </div>

      {/* Table Actions (Visible only when inside a table) */}
      {editor.isActive('table') && (
        <div className="flex items-center gap-1 ml-2 bg-zinc-900/50 p-1 rounded-md border border-zinc-800">
          <button type="button" className="rte-btn !px-2" title="Linha Acima" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addRowBefore().run();}}><span className="text-[9px] font-bold text-zinc-300">L +� </span></button>
          <button type="button" className="rte-btn !px-2" title="Linha Abaixo" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addRowAfter().run();}}><span className="text-[9px] font-bold text-zinc-300">L +� </span></button>
          <button type="button" className="rte-btn !px-2" title="Excluir Linha" onMouseDown={e => {e.preventDefault(); editor.chain().focus().deleteRow().run();}}><span className="text-[9px] font-bold text-red-400/80">L -</span></button>
          
          <div className="w-px h-3 bg-zinc-700 mx-1" />
          
          <button type="button" className="rte-btn !px-2" title="Coluna Esquerda" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addColumnBefore().run();}}><span className="text-[9px] font-bold text-zinc-300">C +� �</span></button>
          <button type="button" className="rte-btn !px-2" title="Coluna Direita" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addColumnAfter().run();}}><span className="text-[9px] font-bold text-zinc-300">C +� </span></button>
          <button type="button" className="rte-btn !px-2" title="Excluir Coluna" onMouseDown={e => {e.preventDefault(); editor.chain().focus().deleteColumn().run();}}><span className="text-[9px] font-bold text-red-400/80">C -</span></button>

          <div className="w-px h-3 bg-zinc-700 mx-1" />
          
          <button type="button" className="rte-btn !px-2" title="Excluir Tabela" onMouseDown={e => {e.preventDefault(); editor.chain().focus().deleteTable().run();}}><span className="text-[9px] font-bold text-red-500">Del Tab</span></button>
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({ taskId, content, onChange, variant = 'default', wrapperClassName = '' }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'task-list' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'task-item' },
      }),
      TextStyle,
      Color,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'Escreva sobre o que é essa tarefa...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'rte-content',
        spellcheck: 'false',
      },
    },
  });

  // Sync content only when task changes (not on every keystroke)
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, editor]);

  return (
    <div className={`rte-wrapper flex flex-col ${variant === 'borderless' ? 'rte-borderless !border-transparent !bg-transparent' : ''} ${wrapperClassName}`}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
}
