import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LinkIcon, StickyNote, FileText, Plus, Maximize2, Minimize2,
  ExternalLink, Trash2, Pencil, Upload, X, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserDocument, UserDocumentKind } from '../types';
import { fetchUserDocuments, saveUserDocument, deleteUserDocument } from '../lib/api';
import { uploadToStorage, removeFromStorage, sanitizeFileName, UPLOAD_LIMITS } from '../lib/storage';
import RichTextEditor from './RichTextEditor';
import ConfirmModal from './ConfirmModal';

interface MyDocumentsProps {
  expanded: boolean;
  onToggleExpand: () => void;
}

const COLUMNS: { kind: UserDocumentKind; label: string; icon: any; empty: string }[] = [
  { kind: 'link',     label: 'Links',      icon: LinkIcon,   empty: 'Nenhum link salvo' },
  { kind: 'note',     label: 'Anotações',  icon: StickyNote, empty: 'Nenhuma anotação' },
  { kind: 'document', label: 'Documentos', icon: FileText,   empty: 'Nenhum documento' },
];

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function hostOf(url?: string) {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 30); }
}

// A URL pública do Storage tem o formato .../object/public/attachments/<path>.
// Só arquivos que subimos têm esse prefixo — links externos devolvem null.
function storagePathFromUrl(url?: string): string | null {
  if (!url) return null;
  const marker = '/object/public/attachments/';
  const idx = url.indexOf(marker);
  return idx === -1 ? null : decodeURIComponent(url.slice(idx + marker.length));
}

export default function MyDocuments({ expanded, onToggleExpand }: MyDocumentsProps) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['user-documents', userId],
    queryFn: () => fetchUserDocuments(userId!),
    enabled: !!userId,
  });

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editing, setEditing] = useState<UserDocument | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserDocument | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [addMenuOpen]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['user-documents', userId] });

  const startCreate = (kind: UserDocumentKind) => {
    if (!userId) return;
    setAddMenuOpen(false);
    const now = new Date().toISOString();
    setEditing({
      id: crypto.randomUUID(),
      userId,
      kind,
      title: '',
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleSave = async (doc: UserDocument) => {
    await saveUserDocument(doc);
    setEditing(null);
    refresh();
  };

  const handleDelete = async (doc: UserDocument) => {
    const path = storagePathFromUrl(doc.url);
    if (path) await removeFromStorage('attachments', path);
    await deleteUserDocument(doc.id);
    setPendingDelete(null);
    refresh();
  };

  return (
    <div className={`flex flex-col ${expanded ? 'flex-1 min-h-0' : ''}`}>
      {/* Header da seção */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-zinc-400" />
          <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Meus Documentos</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen(v => !v)}
              className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-md text-[10px] font-bold tracking-[0.15em] uppercase transition-colors"
            >
              <Plus size={13} /> Adicionar <ChevronDown size={12} className={addMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-[#18181b] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden z-30 animate-fade-in">
                {COLUMNS.map(({ kind, label, icon: Icon }) => (
                  <button
                    key={kind}
                    onClick={() => startCreate(kind)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100 transition-colors"
                  >
                    <Icon size={13} className="text-zinc-500" />
                    {kind === 'link' ? 'Link' : kind === 'note' ? 'Anotação' : 'Documento'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onToggleExpand}
            title={expanded ? 'Recolher' : 'Expandir'}
            className="p-1.5 rounded-md bg-[#121214] border border-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Três colunas */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 ${expanded ? 'flex-1 min-h-0' : ''}`}>
        {COLUMNS.map(({ kind, label, icon: Icon, empty }) => {
          const items = docs.filter(d => d.kind === kind);
          return (
            <div key={kind} className="flex flex-col bg-[#121214] border border-zinc-900 rounded-xl overflow-hidden shadow-sm shadow-black/20">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-900 bg-[#08080a]">
                <div className="flex items-center gap-2 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.15em]">
                  <Icon size={12} className="text-zinc-500" /> {label}
                  {items.length > 0 && (
                    <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full text-[9px]">{items.length}</span>
                  )}
                </div>
                <button
                  onClick={() => startCreate(kind)}
                  title={`Adicionar em ${label}`}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className={`flex flex-col p-2 gap-1 overflow-y-auto scrollbar-minimal ${expanded ? 'flex-1 min-h-[400px] short:min-h-[240px]' : 'card-list-h'}`}>
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center text-zinc-600 py-10 text-xs">Carregando…</div>
                ) : items.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-10 opacity-70">
                    <Icon size={26} className="mb-2 text-zinc-700" />
                    <span className="text-xs">{empty}</span>
                  </div>
                ) : items.map(doc => (
                  <div
                    key={doc.id}
                    className="group flex items-center gap-2 bg-[#121214] hover:bg-[#161619] border border-zinc-900/60 hover:border-zinc-800 rounded-md px-2.5 py-2 transition-all duration-150"
                  >
                    <Icon size={12} className="shrink-0 text-zinc-500" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11.5px] font-medium text-zinc-200 truncate" title={doc.title}>{doc.title}</span>
                      <span className="text-[9.5px] text-zinc-500 truncate">
                        {doc.kind === 'link' ? hostOf(doc.url)
                          : doc.kind === 'document' ? [doc.fileName, formatFileSize(doc.fileSize)].filter(Boolean).join(' · ') || hostOf(doc.url)
                          : new Date(doc.updatedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir"
                          className="text-zinc-500 hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={() => setEditing(doc)} title="Editar" className="text-zinc-500 hover:text-zinc-200 transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setPendingDelete(doc)} title="Excluir" className="text-zinc-500 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <DocumentModal
          doc={editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        isOpen={!!pendingDelete}
        title="Excluir item"
        message={`"${pendingDelete?.title}" será removido permanentemente${storagePathFromUrl(pendingDelete?.url) ? ', junto com o arquivo enviado' : ''}.`}
        confirmText="Excluir"
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ─── Modal de criação / edição ───────────────────────────────────────

interface DocumentModalProps {
  doc: UserDocument;
  onCancel: () => void;
  onSave: (doc: UserDocument) => Promise<void>;
}

function DocumentModal({ doc, onCancel, onSave }: DocumentModalProps) {
  const [title, setTitle] = useState(doc.title);
  const [url, setUrl] = useState(doc.url || '');
  const [content, setContent] = useState(doc.content || '');
  const [fileName, setFileName] = useState(doc.fileName);
  const [fileSize, setFileSize] = useState(doc.fileSize);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindLabel = doc.kind === 'link' ? 'link' : doc.kind === 'note' ? 'anotação' : 'documento';

  const handleFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const path = `documentos/${doc.userId}/${doc.id}_${sanitizeFileName(file.name)}`;
      const publicUrl = await uploadToStorage('attachments', path, file, UPLOAD_LIMITS.task);
      setUrl(publicUrl);
      setFileName(file.name);
      setFileSize(file.size);
      if (!title.trim()) setTitle(file.name);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const canSave = title.trim().length > 0
    && (doc.kind !== 'link' || url.trim().length > 0)
    && !isUploading && !isSaving;

  const submit = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        ...doc,
        title: title.trim(),
        url: url.trim() || undefined,
        content: content || undefined,
        fileName,
        fileSize,
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className={`bg-[#18181b] border border-zinc-800/80 rounded-xl flex flex-col shadow-2xl animate-slide-up w-full ${doc.kind === 'note' ? 'max-w-[720px]' : 'max-w-[440px]'}`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/70">
          <h3 className="text-[14px] font-semibold text-zinc-100 capitalize">
            {doc.title ? `Editar ${kindLabel}` : `Nova ${doc.kind === 'note' ? 'anotação' : doc.kind === 'link' ? 'link' : 'documento'}`}
          </h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Título</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`Nome ${doc.kind === 'note' ? 'da anotação' : doc.kind === 'link' ? 'do link' : 'do documento'}`}
              className="bg-zinc-900/60 border border-zinc-800 text-[13px] text-zinc-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {doc.kind === 'link' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">URL</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                className="bg-zinc-900/60 border border-zinc-800 text-[13px] text-zinc-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          )}

          {doc.kind === 'document' && (
            <div className="flex flex-col gap-3">
              <div
                onClick={isUploading ? undefined : pickFile}
                className={`border-2 border-dashed border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-800/30 transition-colors rounded-lg flex flex-col items-center justify-center p-6 cursor-pointer group ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-zinc-700 transition-colors">
                  <Upload size={17} className="text-zinc-400" />
                </div>
                <span className="text-[13px] font-medium text-zinc-300">
                  {isUploading ? 'Enviando…' : fileName ? fileName : 'Clique para enviar um arquivo'}
                </span>
                <span className="text-[11px] text-zinc-500 mt-1">
                  {fileSize ? formatFileSize(fileSize) : `Limite: ${UPLOAD_LIMITS.task / (1024 * 1024)}MB`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">ou cole um link</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <input
                value={url}
                onChange={e => { setUrl(e.target.value); setFileName(undefined); setFileSize(undefined); }}
                placeholder="https://drive.google.com/…"
                className="bg-zinc-900/60 border border-zinc-800 text-[13px] text-zinc-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          )}

          {doc.kind === 'note' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Conteúdo</label>
              <div className="border border-zinc-800 rounded-md overflow-hidden max-h-[45vh] overflow-y-auto scrollbar-minimal">
                <RichTextEditor
                  taskId={`doc-${doc.id}`}
                  content={content}
                  onChange={setContent}
                  variant="borderless"
                />
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800/70">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-[13px] font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="px-3 py-1.5 text-[13px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
