import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
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
import Image from '@tiptap/extension-image';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Palette,
  Minus,
  Table as TableIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Rows3,
  Columns3,
} from 'lucide-react';

// Inline font-size extension — teaches TextStyle to carry a `fontSize` attribute.
// Works exactly like the Color extension: applies to selection or stored mark at cursor.
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, any>) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

interface RichTextEditorProps {
  taskId: string;
  content: string;
  onChange: (content: string) => void;
  variant?: 'default' | 'borderless';
  wrapperClassName?: string;
  columns?: 1 | 2 | 3;
  onColumnsChange?: (cols: 1 | 2 | 3) => void;
  readOnly?: boolean;
}

const COLORS = [
  { hex: '#eab308', label: 'Amarelo (Design)' },
  { hex: '#ec4899', label: 'Rosa (Copy)' },
  { hex: '#3b82f6', label: 'Azul (Tarefa)' },
  { hex: '#10b981', label: 'Verde (Orçamento)' },
  { hex: '#a855f7', label: 'Roxo (Social Media)' },
  { hex: '#ffffff', label: 'Branco' },
  { hex: '#a1a1aa', label: 'Cinza' },
];

// Font sizes: H1 = default (remove mark), H2 = medium, H3 = large
const FONT_SIZES = [
  { label: 'H1', size: null,   title: 'Normal (padrão)' },
  { label: 'H2', size: '18px', title: 'Subtítulo (18px)' },
  { label: 'H3', size: '24px', title: 'Título (24px)' },
] as const;

type ToolbarButton = {
  icon: React.ReactNode;
  title: string;
  action: () => void;
  isActive?: () => boolean;
  disabled?: () => boolean;
};

function toggleMarkKeepingColor(editor: Editor, toggle: (e: Editor) => void) {
  const color = editor.getAttributes('textStyle').color as string | undefined;
  toggle(editor);
  if (color) {
    setTimeout(() => {
      if (!editor.isDestroyed) {
        editor.chain().focus().setColor(color).run();
      }
    }, 0);
  }
}

const Col1Icon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const Col2Icon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="2" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="8" y="2" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const Col3Icon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="2" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="5.5" y="2" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="10" y="2" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

function MenuBar({ editor, columns = 1, onColumnsChange }: { editor: Editor | null; columns?: 1|2|3; onColumnsChange?: (c: 1|2|3) => void }) {
  const [isColorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = useState(0);

  // Re-render the toolbar whenever the editor's selection or content changes
  // so that conditional toolbar sections (e.g. table controls) appear/disappear
  useEffect(() => {
    if (!editor) return;
    const handler = () => forceUpdate(n => n + 1);
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!editor) return (
    <div className="rte-toolbar opacity-50 pointer-events-none">
      <div className="text-xs text-zinc-500 px-2 py-1">Carregando editor...</div>
    </div>
  );

  const currentFontSize = editor.getAttributes('textStyle').fontSize as string | null | undefined;

  // H1/H2/H3 — inline font size. Clicking applies to selection or sets the stored mark at cursor.
  const applyFontSize = (size: string | null) => {
    if (size === null) {
      // H1 = reset to default
      editor.chain().focus().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
    } else {
      editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
    }
  };

  const groups: ToolbarButton[][] = [
    // Group: inline formatting
    [
      {
        icon: <Bold size={14} />,
        title: 'Negrito (Ctrl+B)',
        action: () => toggleMarkKeepingColor(editor, (e) => e.chain().focus().toggleBold().run()),
        isActive: () => editor.isActive('bold'),
        disabled: () => !editor.can().chain().focus().toggleBold().run(),
      },
      {
        icon: <Italic size={14} />,
        title: 'Itálico (Ctrl+I)',
        action: () => toggleMarkKeepingColor(editor, (e) => e.chain().focus().toggleItalic().run()),
        isActive: () => editor.isActive('italic'),
        disabled: () => !editor.can().chain().focus().toggleItalic().run(),
      },
      {
        icon: <Strikethrough size={14} />,
        title: 'Riscado',
        action: () => toggleMarkKeepingColor(editor, (e) => e.chain().focus().toggleStrike().run()),
        isActive: () => editor.isActive('strike'),
        disabled: () => !editor.can().chain().focus().toggleStrike().run(),
      },
    ],
    // Group: lists
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
        icon: <TableIcon size={14} />,
        title: 'Inserir Tabela (3x3)',
        action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        isActive: () => editor.isActive('table'),
      },
    ],
    // Group: separator
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
      {/* Font size — H1/H2/H3 como marcas inline */}
      <div className="flex items-center gap-0.5">
        {FONT_SIZES.map(({ label, size, title }) => {
          const isActive = size === null
            ? !currentFontSize
            : currentFontSize === size;
          return (
            <button
              key={label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyFontSize(size); }}
              title={title}
              className={`rte-btn ${isActive ? 'rte-btn--active' : ''}`}
            >
              <span style={{
                fontWeight: label === 'H1' ? 600 : label === 'H2' ? 700 : 800,
                fontSize: label === 'H1' ? 11 : 12,
                fontFamily: 'inherit',
                lineHeight: 1,
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rte-divider" />

      {/* Formatting marks */}
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div className="rte-divider" />}
          {group.map((btn, bi) => (
            <button
              key={bi}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
              disabled={btn.disabled ? btn.disabled() : false}
              title={btn.title}
              className={`rte-btn ${btn.isActive && btn.isActive() ? 'rte-btn--active' : ''}`}
            >
              {btn.icon}
            </button>
          ))}
        </React.Fragment>
      ))}

      {/* Color picker — independente do H selecionado */}
      <div className="rte-divider" />
      <div style={{ position: 'relative' }} ref={colorRef}>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setColorOpen((p) => !p); }}
          title="Cor do texto"
          className="rte-btn"
          style={{ position: 'relative' }}
        >
          <Palette size={14} />
          {editor.getAttributes('textStyle').color && (
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: editor.getAttributes('textStyle').color,
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

      {/* Column Layout */}
      <div className="rte-divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title="Layout em colunas">
        {([1,2,3] as const).map(n => {
          const Icon = n === 1 ? Col1Icon : n === 2 ? Col2Icon : Col3Icon;
          return (
            <button
              key={n}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onColumnsChange?.(n); }}
              title={`${n} coluna${n > 1 ? 's' : ''}`}
              className={`rte-btn ${columns === n ? 'rte-btn--active' : ''}`}
            >
              <Icon />
            </button>
          );
        })}
      </div>

      {/* Table Actions */}
      {editor.isActive('table') && (
        <div className="flex items-center gap-0.5 ml-2 bg-zinc-900/60 px-1.5 py-0.5 rounded-lg border border-zinc-800/60">
          {/* Row controls */}
          <div className="flex items-center gap-0.5 mr-0.5">
            <span className="text-[8px] font-semibold text-zinc-500 uppercase tracking-wider mr-0.5 select-none">Linha</span>
            <button type="button" className="rte-tbl-btn rte-tbl-btn--add" title="Adicionar linha acima" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addRowBefore().run();}}>
              <ArrowUp size={10} /><Plus size={8} className="rte-tbl-plus" />
            </button>
            <button type="button" className="rte-tbl-btn rte-tbl-btn--add" title="Adicionar linha abaixo" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addRowAfter().run();}}>
              <ArrowDown size={10} /><Plus size={8} className="rte-tbl-plus" />
            </button>
            <button type="button" className="rte-tbl-btn rte-tbl-btn--del" title="Excluir linha" onMouseDown={e => {e.preventDefault(); editor.chain().focus().deleteRow().run();}}>
              <Trash2 size={11} />
            </button>
          </div>
          <div className="w-px h-4 bg-zinc-700/60 mx-1" />
          {/* Column controls */}
          <div className="flex items-center gap-0.5 mr-0.5">
            <span className="text-[8px] font-semibold text-zinc-500 uppercase tracking-wider mr-0.5 select-none">Col</span>
            <button type="button" className="rte-tbl-btn rte-tbl-btn--add" title="Adicionar coluna à esquerda" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addColumnBefore().run();}}>
              <ArrowLeft size={10} /><Plus size={8} className="rte-tbl-plus" />
            </button>
            <button type="button" className="rte-tbl-btn rte-tbl-btn--add" title="Adicionar coluna à direita" onMouseDown={e => {e.preventDefault(); editor.chain().focus().addColumnAfter().run();}}>
              <ArrowRight size={10} /><Plus size={8} className="rte-tbl-plus" />
            </button>
            <button type="button" className="rte-tbl-btn rte-tbl-btn--del" title="Excluir coluna" onMouseDown={e => {e.preventDefault(); editor.chain().focus().deleteColumn().run();}}>
              <Trash2 size={11} />
            </button>
          </div>
          <div className="w-px h-4 bg-zinc-700/60 mx-1" />
          {/* Delete table */}
          <button type="button" className="rte-tbl-btn rte-tbl-btn--destroy" title="Excluir tabela inteira" onMouseDown={e => {e.preventDefault(); editor.chain().focus().deleteTable().run();}}>
            <Trash2 size={12} />
            <span className="text-[8px] font-bold">Tabela</span>
          </button>
        </div>
      )}
    </div>
  );
}

const MULTI_COL_ATTR = 'data-multi-col-wrapper';

function parseMultiColumnContent(html: string, cols: number): string[] {
  if (!html) return Array(cols).fill('');
  if (!html.includes(MULTI_COL_ATTR)) {
    return [html, ...Array(Math.max(0, cols - 1)).fill('')];
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const wrapper = doc.querySelector(`[${MULTI_COL_ATTR}]`);
    if (!wrapper) return [html, ...Array(Math.max(0, cols - 1)).fill('')];
    const docCols = parseInt(wrapper.getAttribute('data-cols') || '1');
    const extracted: string[] = [];
    for (let i = 0; i < Math.max(docCols, cols); i++) {
      const colDiv = wrapper.querySelector(`[data-col-idx="${i}"]`);
      extracted.push(colDiv ? colDiv.innerHTML : '');
    }
    if (cols < docCols) {
      const surviving = extracted.slice(0, cols);
      const dropped = extracted.slice(cols).filter(c => c.replace(/<p><\/p>|<br>|\s/g, '') !== '');
      if (dropped.length > 0) {
        surviving[cols - 1] = surviving[cols - 1] + '<p></p>' + dropped.join('<p></p>');
      }
      return surviving;
    }
    return extracted.slice(0, cols);
  } catch (e) {
    return [html, ...Array(Math.max(0, cols - 1)).fill('')];
  }
}

function buildMultiColumnContent(contents: string[], cols: number): string {
  if (cols === 1) return contents[0] || '';
  const innerHtml = contents.map((c, i) =>
    `<div data-col-idx="${i}" style="flex:1; min-width:0;">${c}</div>`
  ).join('');
  return `<div ${MULTI_COL_ATTR}="true" data-cols="${cols}" style="display:flex; gap:1.25rem;">${innerHtml}</div>`;
}

interface SingleEditorProps {
  taskId: string;
  content: string;
  onChange: (html: string) => void;
  onFocus: () => void;
  editorRefCallback: (editor: Editor | null) => void;
  placeholderText?: string;
  readOnly?: boolean;
}

function SingleEditor({ taskId, content, onChange, onFocus, editorRefCallback, placeholderText = 'Escreva sobre o que é essa tarefa...', readOnly }: SingleEditorProps) {
  const localRef = useRef<Editor | null>(null);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      // Headings kept in StarterKit for backward compat with existing content
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      // TaskList/TaskItem kept for backward compat (checklist button removed from toolbar)
      TaskList.configure({ HTMLAttributes: { class: 'task-list' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'task-item' } }),
      TextStyle.configure({ HTMLAttributes: {} }),
      Color.configure({ types: ['textStyle'] }),
      FontSize,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full max-h-96 object-contain rounded-md border border-zinc-800/50 my-2',
        },
      }),
      Placeholder.configure({
        placeholder: placeholderText,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => {
      onFocus();
    },
    editorProps: {
      attributes: {
        class: 'rte-content h-full outline-none',
        spellcheck: 'false',
      },
      transformPastedHTML(html) {
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const elements = doc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            // Remove style and class attributes to strip origin formatting
            el.removeAttribute('style');
            el.removeAttribute('class');
            el.removeAttribute('dir');
            el.removeAttribute('align');
            el.removeAttribute('font');
            el.removeAttribute('color');
            el.removeAttribute('size');
            el.removeAttribute('face');
          }
          return doc.body.innerHTML;
        } catch (e) {
          return html;
        }
      },
      handleKeyDown(_view, event) {
        const ed = localRef.current;
        if (!ed) return false;
        const isMod = event.ctrlKey || event.metaKey;
        if (!isMod) return false;
        if (event.key === 'b' || event.key === 'B') {
          event.preventDefault();
          toggleMarkKeepingColor(ed, (e) => e.chain().focus().toggleBold().run());
          return true;
        }
        if (event.key === 'i' || event.key === 'I') {
          event.preventDefault();
          toggleMarkKeepingColor(ed, (e) => e.chain().focus().toggleItalic().run());
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    localRef.current = editor ?? null;
    editorRefCallback(editor ?? null);
  }, [editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && readOnly) {
      if (editor.getHTML() !== content) {
        editor.commands.setContent(content || '');
      }
    }
  }, [content, readOnly, editor]);

  return <EditorContent editor={editor} className="h-full min-h-[150px]" />;
}

export default function RichTextEditor({ taskId, content, onChange, variant = 'default', wrapperClassName = '', columns = 1, onColumnsChange, readOnly }: RichTextEditorProps) {
  const [contents, setContents] = useState<string[]>(() => parseMultiColumnContent(content, columns));
  const [activeIdx, setActiveIdx] = useState(0);
  const editorsRef = useRef<(Editor | null)[]>([null, null, null]);
  const [prevTaskId, setPrevTaskId] = useState(taskId);

  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setContents(parseMultiColumnContent(content, columns));
  }

  useEffect(() => {
    if (readOnly) {
      setContents(parseMultiColumnContent(content, columns));
    }
  }, [content, readOnly, columns]);

  const handleEditorChange = (index: number, html: string) => {
    setContents(prev => {
      const next = [...prev];
      next[index] = html;
      onChange(buildMultiColumnContent(next, columns));
      return next;
    });
  };

  const handleColumnsChange = (newCols: 1|2|3) => {
    if (newCols === columns) return;
    setContents(prev => {
      let next = [...prev];
      if (newCols < columns) {
        const surviving = next.slice(0, newCols);
        const dropped = next.slice(newCols).filter(c => c.replace(/<p><\/p>|<br>|\s/g, '') !== '');
        if (dropped.length > 0) {
          surviving[newCols - 1] = surviving[newCols - 1] + '<p></p>' + dropped.join('<p></p>');
        }
        next = surviving;
      } else {
        while(next.length < newCols) next.push('');
      }
      onChange(buildMultiColumnContent(next, newCols));
      return next;
    });
    if (activeIdx >= newCols) setActiveIdx(newCols - 1);
    onColumnsChange?.(newCols);
  };

  const activeEditor = editorsRef.current[activeIdx] || editorsRef.current[0] || null;
  const gridClass = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`rte-wrapper flex flex-col ${variant === 'borderless' ? 'rte-borderless !border-transparent !bg-transparent' : ''} ${wrapperClassName}`}>
      {!readOnly && <MenuBar editor={activeEditor} columns={columns} onColumnsChange={handleColumnsChange} />}
      <div className={`flex-1 overflow-y-auto grid ${gridClass} gap-5`}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`${taskId}-col-${i}`} className={`h-full ${i < columns - 1 ? 'border-r border-zinc-800/50 pr-5' : ''}`}>
            <SingleEditor
              taskId={`${taskId}-col-${i}`}
              content={contents[i] || ''}
              readOnly={readOnly}
              onChange={(html) => handleEditorChange(i, html)}
              onFocus={() => setActiveIdx(i)}
              editorRefCallback={(ed) => { editorsRef.current[i] = ed; }}
              placeholderText={i === 0 ? 'Escreva sobre o que é essa tarefa...' : 'Escreva aqui...'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
