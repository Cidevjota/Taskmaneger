import React, { useState, useEffect } from 'react';
import { X, Hash, FileText, DollarSign, Building2, Calendar, Tag, Trash2, AlertCircle, Layers, ChevronDown, Paperclip, Plus, User, Loader2 } from 'lucide-react';
import { uploadToStorage, UPLOAD_LIMITS, sanitizeFileName } from '../lib/storage';
import { SiengeTitle, SiengeStatus, SiengeLote, Project } from '../types';
import DatePicker from './DatePicker';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';

interface SiengeTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: SiengeTitle) => void;
  onDelete?: (id: string) => void;
  initialData?: SiengeTitle | null;
  initialStatus?: SiengeStatus;
  openLotes: SiengeLote[];
  projects: Project[];
}

const STATUS_LABELS: Record<SiengeStatus, string> = {
  a_lancar: 'A Lançar',
  aprovacao_1: 'Aprovação em 1ª Alçada',
  aprovacao_2: 'Aprovação em 2ª Alçada',
  aprovacao_3: 'Aprovação em 3ª Alçada',
  aguardando_pagamento: 'Aguardando Pagamento',
  recusados: 'Recusados',
  pago: 'Pago',
};

function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(formatted: string): number {
  const cleaned = formatted.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export default function SiengeTitleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  initialStatus = 'a_lancar',
  openLotes,
  projects,
}: SiengeTitleModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [empreendimento, setEmpreendimento] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [loteId, setLoteId] = useState('');
  const [status, setStatus] = useState<SiengeStatus>(initialStatus);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoteDropdownOpen, setIsLoteDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [pdfFiles, setPdfFiles] = useState<{ id: string, file: File | null }[]>([{ id: Date.now().toString(), file: null }]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const { allUsers: USERS, currentUser } = useAuth();
  const sortedUsers = currentUser
    ? [currentUser, ...USERS.filter(u => u.id !== currentUser.id)]
    : USERS;

  const selectedLote = openLotes.find(l => l.id === loteId);
  const suggestedDate = selectedLote?.prazoPagamento;

  const isEditing = !!initialData;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitulo(initialData.titulo);
        setDescricao(initialData.descricao || '');
        const v = initialData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setValorDisplay(v);
        setEmpreendimento(initialData.empreendimento || '');
        setVencimento(initialData.vencimento || '');
        setLoteId(initialData.loteId || '');
        setAssigneeId(initialData.assigneeId || '');
        setStatus(initialData.status);
      } else {
        setTitulo('');
        setDescricao('');
        setValorDisplay('');
        setEmpreendimento('');
        setVencimento('');
        setLoteId('');
        setAssigneeId('');
        setStatus(initialStatus);
      }
      setErrors({});
      setShowDeleteConfirm(false);
      setPdfFiles([{ id: Date.now().toString(), file: null }]);
    }
  }, [isOpen, initialData, initialStatus]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!valorDisplay) newErrors.valor = 'Valor é obrigatório';
    if (!loteId) newErrors.loteId = 'Lote de pagamento é obrigatório';
    if (!assigneeId) newErrors.assigneeId = 'Responsável é obrigatório';
    if (!empreendimento.trim()) newErrors.empreendimento = 'Empreendimento é obrigatório';
    if (!vencimento) newErrors.vencimento = 'Vencimento é obrigatório';
    if (!descricao.trim()) newErrors.descricao = 'Descrição é obrigatória';
    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const filesToUpload = pdfFiles.filter(p => p.file);
    for (const p of filesToUpload) {
      if (p.file!.size > UPLOAD_LIMITS.sienge) {
        setUploadError(`"${p.file!.name}" excede o limite de ${UPLOAD_LIMITS.sienge / (1024 * 1024)}MB por arquivo.`);
        return;
      }
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const titleId = initialData?.id || crypto.randomUUID();

      const newAttachments = await Promise.all(
        filesToUpload.map(async p => {
          const safeName = sanitizeFileName(p.file!.name);
          const path = `sienge/${titleId}/${p.id}_${safeName}`;
          const url = await uploadToStorage('attachments', path, p.file!, UPLOAD_LIMITS.sienge);
          return { id: p.id, name: p.file!.name, url };
        })
      );

      const allAttachments = [...(initialData?.attachments || []), ...newAttachments];

      const title: SiengeTitle = {
        id: titleId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        valor: parseCurrency(valorDisplay),
        empreendimento: empreendimento.trim() || undefined,
        vencimento: vencimento || undefined,
        loteId: loteId || undefined,
        assigneeId: assigneeId || undefined,
        lote: initialData?.lote,
        attachments: allAttachments,
        status,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSave(title);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleValorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setValorDisplay(raw ? formatCurrency(raw) : '');
    if (errors.valor) setErrors(prev => ({ ...prev, valor: '' }));
  };

  const handleAddPdfField = () => {
    setPdfFiles(prev => [...prev, { id: Date.now().toString(), file: null }]);
  };

  const handleRemovePdfField = (idToRemove: string) => {
    setPdfFiles(prev => prev.filter(p => p.id !== idToRemove));
  };

  const handleFileChange = (id: string, file: File | null) => {
    setPdfFiles(prev => prev.map(p => p.id === id ? { ...p, file } : p));
  };

  const inputClass = (field: string) =>
    `w-full bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:ring-1 ${
      errors[field]
        ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500/60'
        : 'border-zinc-800 focus:ring-blue-500/30 focus:border-blue-500/50'
    }`;

  const handleCloseRequest = () => {
    const hasData = titulo || descricao || valorDisplay || empreendimento || vencimento || loteId || assigneeId || (pdfFiles[0] && pdfFiles[0].file);
    if (hasData) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onMouseDown={handleCloseRequest}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[#0d0d10] border border-zinc-800/80 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Hash size={14} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {isEditing ? 'Editar Título' : 'Novo Título Sienge'}
            </h2>
          </div>
          <button type="button" onClick={handleCloseRequest} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto max-h-[70vh]">
          {/* Row 1: Título (number) */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Hash size={11} /> Número do Título
            </label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: 12345 (opcional se a lançar)"
              className={inputClass('titulo')}
              autoFocus
            />
          </div>

          {/* Lote de Pagamento selector */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Layers size={11} /> Lote de Pagamento <span className="text-red-400">*</span>
            </label>
            {openLotes.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLoteDropdownOpen(p => !p)}
                  className={`w-full flex items-center justify-between bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-zinc-800/60 ${
                    errors.loteId ? 'border-red-500/60 focus:ring-1 focus:ring-red-500/30' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
                  }`}
                >
                  <span className={loteId ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>
                    {loteId ? openLotes.find(l => l.id === loteId)?.nome : 'Selecione um lote ou cadastre um novo'}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isLoteDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {errors.loteId && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.loteId}</p>}
                
                {isLoteDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLoteDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {openLotes.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => { setLoteId(l.id); setErrors(p => ({...p, loteId: ''})); setIsLoteDropdownOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                              l.id === loteId
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Layers size={14} className={l.id === loteId ? 'text-blue-500/70' : 'text-zinc-500'} />
                              <span className="font-medium text-[13px]">{l.nome}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-medium">
                <AlertCircle size={14} />
                É necessário cadastrar um lote na aba "Lotes de Pagamento" antes de criar um título.
              </div>
            )}
          </div>

          {/* Responsável */}
          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-zinc-500" />
              Responsável <span className="text-red-500">*</span>
            </label>
            <div 
              className={`w-full bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-100 flex items-center justify-between cursor-pointer transition-all ${
                errors.assigneeId ? 'border-red-500/60' : 'border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
            >
              <div className="flex items-center gap-2">
                {assigneeId ? (() => {
                  const assignee = sortedUsers.find(u => u.id === assigneeId);
                  if (!assignee) return <span className="text-zinc-500">Selecionar...</span>;
                  return (
                    <>
                      {assignee.avatarUrl ? (
                        <img src={assignee.avatarUrl} alt={assignee.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">
                          {assignee.initials}
                        </div>
                      )}
                      <span>{assignee.name}</span>
                    </>
                  );
                })() : (
                  <span className="text-zinc-500">Selecionar responsável...</span>
                )}
              </div>
              <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
            {errors.assigneeId && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.assigneeId}</p>
            )}
            {isAssigneeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181b] border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
                <div className="max-h-48 overflow-y-auto">
                  {sortedUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setAssigneeId(user.id);
                        setIsAssigneeDropdownOpen(false);
                        if (errors.assigneeId) setErrors(prev => ({ ...prev, assigneeId: '' }));
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800/50 transition-colors ${assigneeId === user.id ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300'}`}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">
                          {user.initials}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-[10px] text-zinc-500">{user.role}</span>
                      </div>
                      {assigneeId === user.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Empreendimento selector */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Building2 size={11} /> Empreendimento <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProjectDropdownOpen(p => !p)}
                className={`w-full flex items-center justify-between bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-zinc-800/60 ${
                  errors.empreendimento ? 'border-red-500/60 focus:ring-1 focus:ring-red-500/30' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
                }`}
              >
                <span className={empreendimento ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>
                  {empreendimento || 'Selecione um empreendimento'}
                </span>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {errors.empreendimento && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.empreendimento}</p>}
              
              {isProjectDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProjectDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setEmpreendimento(p.name); setErrors(prev => ({...prev, empreendimento: ''})); setIsProjectDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                            p.name === empreendimento
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="font-medium text-[13px]">{p.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Valor + Vencimento */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <DollarSign size={11} /> Valor (R$) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium select-none">R$</span>
                <input
                  type="text"
                  value={valorDisplay}
                  onChange={handleValorInput}
                  placeholder="0,00"
                  inputMode="numeric"
                  className={`${inputClass('valor')} pl-8`}
                />
              </div>
              {errors.valor && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.valor}</p>}
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Calendar size={11} /> Vencimento <span className="text-red-400">*</span>
              </label>
              <DatePicker
                fullWidth
                value={vencimento}
                suggestedDate={suggestedDate}
                onChange={(date) => {
                  // DatePicker sem enableTime retorna 'YYYY-MM-DD'
                  setVencimento(date);
                  if (errors.vencimento) setErrors(p => ({ ...p, vencimento: '' }));
                }}
                trigger={
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-zinc-800/60 ${
                      errors.vencimento ? 'border-red-500/60 focus:ring-1 focus:ring-red-500/30' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
                    }`}
                  >
                    <span className={vencimento ? 'text-zinc-100 font-medium text-sm' : 'text-zinc-500 text-sm'}>
                      {vencimento ? vencimento.split('-').reverse().join('/') : 'Selecionar data'}
                    </span>
                    <Calendar size={14} className="text-zinc-500" />
                  </button>
                }
              />
              {errors.vencimento && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.vencimento}</p>}
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <FileText size={11} /> Descrição <span className="text-red-400">*</span>
            </label>
            <textarea
              value={descricao}
              onChange={e => { setDescricao(e.target.value); if (errors.descricao) setErrors(p => ({ ...p, descricao: '' })); }}
              placeholder="Descreva o título..."
              rows={3}
              className={`${inputClass('descricao')} resize-none`}
            />
            {errors.descricao && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.descricao}</p>}
          </div>

          {/* Anexos PDF */}
          <div className="flex flex-col gap-2 mt-1">
            <label className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Paperclip size={11} /> Anexos em PDF
              </div>
            </label>
            <div className="flex flex-col gap-2">
              {pdfFiles.map((pdf, index) => (
                <div key={pdf.id} className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(pdf.id, e.target.files?.[0] || null)}
                    className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-all focus:border-blue-500/50 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20"
                  />
                  {pdfFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePdfField(pdf.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              {initialData?.attachments && initialData.attachments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase mb-2 block">Anexos Salvos:</span>
                  <div className="flex flex-col gap-1.5">
                    {initialData.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/60">
                        <Paperclip size={12} className="text-blue-400 shrink-0" />
                        <span className="truncate flex-1">{att.name}</span>
                        {att.url && (
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0 underline">
                            Abrir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadError && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={11} />{uploadError}
                </p>
              )}
              <button
                type="button"
                onClick={handleAddPdfField}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors mt-1"
              >
                <Plus size={12} /> Adicionar mais um arquivo
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/60 bg-zinc-950/40">
          <div>
            {isEditing && onDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Excluir
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Confirmar exclusão?</span>
                <button
                  onClick={() => { onDelete!(initialData!.id); onClose(); }}
                  className="px-2.5 py-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  Sim, excluir
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCloseRequest} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={openLotes.length === 0 || isUploading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-blue-500/20 disabled:shadow-none"
            >
              {isUploading && <Loader2 size={12} className="animate-spin" />}
              {isUploading ? 'Enviando...' : isEditing ? 'Salvar Alterações' : 'Criar Título'}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <ConfirmModal
      isOpen={showCloseConfirm}
      title="Deseja sair do formulário?"
      message="Você tem informações preenchidas que não foram salvas. Se sair agora, você perderá essas informações. Deseja realmente sair?"
      confirmText="Sair sem salvar"
      cancelText="Continuar editando"
      onConfirm={() => {
        setShowCloseConfirm(false);
        onClose();
      }}
      onCancel={() => setShowCloseConfirm(false)}
    />
    </>
  );
}
