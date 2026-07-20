import React, { useState, useEffect } from 'react';
import { X, Hash, FileText, DollarSign, Building2, Calendar, Tag, Trash2, AlertCircle, Layers, CreditCard, ChevronDown, Paperclip, Plus, User, Loader2, Pencil, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { uploadToStorage, UPLOAD_LIMITS, sanitizeFileName } from '../lib/storage';
import { SiengeTitle, SiengeStatus, SiengeLote, SiengeFatura, Project } from '../types';
import DatePicker from './DatePicker';
import ConfirmModal from './ConfirmModal';
import TaskChat from './TaskChat';
import { useAuth } from '../context/AuthContext';
import { withVencimentoOriginal, getPositiveAction, showsRejectAction, rejectTargetStatus } from '../lib/siengeHelpers';

interface SiengeTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: SiengeTitle) => void;
  onUpdateOnly?: (title: SiengeTitle) => void;
  onDelete?: (id: string) => void;
  initialData?: SiengeTitle | null;
  initialStatus?: SiengeStatus;
  openLotes: SiengeLote[];
  openFaturas: SiengeFatura[];
  projects: Project[];
  hideHeader?: boolean;
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

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SiengeTitleModal({
  isOpen,
  onClose,
  onSave,
  onUpdateOnly,
  onDelete,
  initialData,
  initialStatus = 'a_lancar',
  openLotes,
  openFaturas,
  projects,
}: SiengeTitleModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [empreendimento, setEmpreendimento] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [loteId, setLoteId] = useState('');
  const [faturaId, setFaturaId] = useState('');
  const [motivoDetalhado, setMotivoDetalhado] = useState('');
  const [paymentMode, setPaymentMode] = useState<'lote' | 'cartao'>('lote');
  const [status, setStatus] = useState<SiengeStatus>(initialStatus);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoteDropdownOpen, setIsLoteDropdownOpen] = useState(false);
  const [isFaturaDropdownOpen, setIsFaturaDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [pdfFiles, setPdfFiles] = useState<{ id: string, file: File | null }[]>([{ id: Date.now().toString(), file: null }]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [motivoRecusaRecord, setMotivoRecusaRecord] = useState<string | undefined>(undefined);
  const [motivoRecusaRegistradoEm, setMotivoRecusaRegistradoEm] = useState<string | undefined>(undefined);
  const [motivoRecusaResolvido, setMotivoRecusaResolvido] = useState(false);
  const [motivoRecusaResolvidoEm, setMotivoRecusaResolvidoEm] = useState<string | undefined>(undefined);
  const [motivoRecusaObservacaoRecord, setMotivoRecusaObservacaoRecord] = useState<string | undefined>(undefined);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveVencimento, setResolveVencimento] = useState('');
  const [resolveObservacao, setResolveObservacao] = useState('');

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
        setFaturaId(initialData.faturaId || '');
        setMotivoDetalhado(initialData.motivoDetalhado || '');
        setPaymentMode(initialData.faturaId ? 'cartao' : 'lote');
        setAssigneeId(initialData.assigneeId || '');
        setStatus(initialData.status);
        setIsLocked(true);
        setMotivoRecusaRecord(initialData.motivoRecusa);
        setMotivoRecusaRegistradoEm(initialData.motivoRecusaRegistradoEm);
        setMotivoRecusaResolvido(!!initialData.motivoRecusaResolvido);
        setMotivoRecusaResolvidoEm(initialData.motivoRecusaResolvidoEm);
        setMotivoRecusaObservacaoRecord(initialData.motivoRecusaObservacao);
      } else {
        setTitulo('');
        setDescricao('');
        setValorDisplay('');
        setEmpreendimento('');
        setVencimento('');
        setLoteId('');
        setFaturaId('');
        setMotivoDetalhado('');
        setPaymentMode('lote');
        setAssigneeId('');
        setStatus(initialStatus);
        setIsLocked(false);
        setMotivoRecusaRecord(undefined);
        setMotivoRecusaRegistradoEm(undefined);
        setMotivoRecusaResolvido(false);
        setMotivoRecusaResolvidoEm(undefined);
        setMotivoRecusaObservacaoRecord(undefined);
      }
      setErrors({});
      setShowDeleteConfirm(false);
      setShowRejectModal(false);
      setRejectReason('');
      setShowResolveForm(false);
      setResolveVencimento('');
      setResolveObservacao('');
      setPdfFiles([{ id: Date.now().toString(), file: null }]);
    }
  }, [isOpen, initialData, initialStatus]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!valorDisplay) newErrors.valor = 'Valor é obrigatório';
    if (paymentMode === 'lote') {
      if (!loteId) newErrors.loteId = 'Lote de pagamento é obrigatório';
    } else {
      if (!faturaId) newErrors.faturaId = 'Cartão de crédito é obrigatório';
      if (!motivoDetalhado.trim()) newErrors.motivoDetalhado = 'Motivo detalhado é obrigatório';
    }
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

      const title: SiengeTitle = withVencimentoOriginal({
        id: titleId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        valor: parseCurrency(valorDisplay),
        empreendimento: empreendimento.trim() || undefined,
        vencimento: vencimento || undefined,
        vencimentoOriginal: initialData?.vencimentoOriginal,
        vencimentoHistory: initialData?.vencimentoHistory,
        loteId: paymentMode === 'lote' ? (loteId || undefined) : undefined,
        faturaId: paymentMode === 'cartao' ? (faturaId || undefined) : undefined,
        motivoDetalhado: paymentMode === 'cartao' ? (motivoDetalhado.trim() || undefined) : undefined,
        assigneeId: assigneeId || undefined,
        lote: initialData?.lote,
        attachments: allAttachments,
        status,
        motivoRecusa: motivoRecusaRecord,
        motivoRecusaRegistradoEm,
        motivoRecusaResolvido,
        motivoRecusaResolvidoEm,
        motivoRecusaObservacao: motivoRecusaObservacaoRecord,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onSave(title);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const positiveAction = getPositiveAction(status);
  const showReject = showsRejectAction(status);

  const handlePositiveAction = () => {
    if (!initialData || !positiveAction) return;
    const updated: SiengeTitle = { ...initialData, status: positiveAction.nextStatus, updatedAt: new Date().toISOString() };
    setStatus(positiveAction.nextStatus);
    onSave(updated);
  };

  const handleRequestReject = () => {
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = () => {
    if (!initialData || !rejectReason.trim()) return;
    const trimmed = rejectReason.trim();
    const now = new Date().toISOString();
    const newStatus = rejectTargetStatus(initialData.status);
    const updated: SiengeTitle = {
      ...initialData,
      status: newStatus,
      motivoRecusa: trimmed,
      motivoRecusaRegistradoEm: now,
      motivoRecusaResolvido: false,
      motivoRecusaResolvidoEm: undefined,
      motivoRecusaObservacao: undefined,
      updatedAt: now,
    };
    setStatus(newStatus);
    setMotivoRecusaRecord(trimmed);
    setMotivoRecusaRegistradoEm(now);
    setMotivoRecusaResolvido(false);
    setMotivoRecusaResolvidoEm(undefined);
    setMotivoRecusaObservacaoRecord(undefined);
    setShowRejectModal(false);
    onSave(updated);
  };

  const handleRequestResolve = () => {
    setResolveVencimento('');
    setResolveObservacao('');
    setShowResolveForm(true);
  };

  const handleConfirmResolve = () => {
    if (!initialData || !resolveVencimento) return;
    const oldVencimento = initialData.vencimento;
    const trimmedObs = resolveObservacao.trim() || undefined;
    const now = new Date().toISOString();
    // A rejection resolved from 'recusados' (i.e. rejected after clearing every
    // alçada, at aguardando_pagamento) goes straight back to aguardando_pagamento.
    // A rejection resolved from 'a_lancar' (rejected during an alçada step) stays
    // at 'a_lancar' — it must re-enter the alçada flow via the "Lançado" button.
    const newStatus = initialData.status === 'recusados' ? 'aguardando_pagamento' : 'a_lancar';
    const updated: SiengeTitle = {
      ...initialData,
      status: newStatus,
      vencimento: resolveVencimento,
      vencimentoOriginal: newStatus === 'aguardando_pagamento' ? (initialData.vencimentoOriginal || oldVencimento) : initialData.vencimentoOriginal,
      vencimentoHistory: oldVencimento
        ? [...(initialData.vencimentoHistory || []), { vencimento: oldVencimento, changedAt: now, observacao: trimmedObs }]
        : (initialData.vencimentoHistory || []),
      motivoRecusaResolvido: true,
      motivoRecusaResolvidoEm: now,
      motivoRecusaObservacao: trimmedObs,
      updatedAt: now,
    };
    setStatus(newStatus);
    setVencimento(resolveVencimento);
    setMotivoRecusaResolvido(true);
    setMotivoRecusaResolvidoEm(now);
    setMotivoRecusaObservacaoRecord(trimmedObs);
    setShowResolveForm(false);
    onSave(updated);
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
    if (isLocked) {
      onClose();
      return;
    }
    const hasData = titulo || descricao || valorDisplay || empreendimento || vencimento || loteId || faturaId || motivoDetalhado || assigneeId || (pdfFiles[0] && pdfFiles[0].file);
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
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              {isEditing ? (isLocked ? 'Título Sienge' : 'Editar Título') : 'Novo Título Sienge'}
              {isEditing && isLocked && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-500 text-[9px] font-medium uppercase tracking-wider">
                  <Lock size={9} /> Somente leitura
                </span>
              )}
            </h2>
          </div>
          <button type="button" onClick={handleCloseRequest} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        {isLocked ? (
          <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto max-h-[70vh]">
            {/* Título + Status */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Hash size={13} className="text-blue-400 shrink-0" />
                <span className="text-sm font-semibold text-zinc-100 truncate">{titulo || 'Sem número'}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(positiveAction || showReject) && (
                  <div className="flex items-center gap-0.5">
                    {positiveAction && (
                      <button
                        type="button"
                        onClick={handlePositiveAction}
                        className="flex items-center justify-center w-5 h-5 rounded text-zinc-500 hover:text-emerald-400 transition-colors"
                        title={positiveAction.label}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    {showReject && (
                      <button
                        type="button"
                        onClick={handleRequestReject}
                        className="flex items-center justify-center w-5 h-5 rounded text-zinc-500 hover:text-red-400 transition-colors"
                        title="Recusar título"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                )}
                <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-semibold text-zinc-300 uppercase tracking-wide">
                  {STATUS_LABELS[status]}
                </span>
              </div>
            </div>

            {/* Motivo da Recusa — permanece visível como histórico mesmo após o título sair de 'recusados'.
                Cor/ícone acompanham o estado: vermelho enquanto pendente de ação, neutro (com selo verde) uma vez resolvido. */}
            {motivoRecusaRecord && (
              <div className={`flex flex-col gap-2.5 p-3 rounded-lg border transition-colors ${
                motivoRecusaResolvido ? 'bg-zinc-900/40 border-zinc-800/60' : 'bg-red-950/30 border-red-900/50'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                      motivoRecusaResolvido ? 'bg-emerald-500/15 border-emerald-500/20' : 'bg-red-500/15 border-red-500/20'
                    }`}>
                      {motivoRecusaResolvido
                        ? <CheckCircle2 size={12} className="text-emerald-400" />
                        : <AlertCircle size={12} className="text-red-400" />}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider truncate ${motivoRecusaResolvido ? 'text-zinc-400' : 'text-red-400'}`}>
                      {motivoRecusaResolvido ? 'Recusa Resolvida' : 'Motivo da Recusa'}
                    </span>
                  </div>
                  {motivoRecusaResolvido ? (
                    motivoRecusaResolvidoEm && (
                      <span className="text-[9px] font-medium text-zinc-500 shrink-0">{formatDateTime(motivoRecusaResolvidoEm)}</span>
                    )
                  ) : (status === 'recusados' || status === 'a_lancar') ? (
                    <button
                      type="button"
                      onClick={handleRequestResolve}
                      className="text-[9px] font-semibold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors shrink-0"
                    >
                      Resolver
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-0.5">
                  <p className={`text-xs leading-relaxed whitespace-pre-wrap ${motivoRecusaResolvido ? 'text-zinc-300' : 'text-red-200/90'}`}>{motivoRecusaRecord}</p>
                  {motivoRecusaRegistradoEm && (
                    <span className="text-[9px] text-zinc-500">Recusado em {formatDateTime(motivoRecusaRegistradoEm)}</span>
                  )}
                </div>

                {motivoRecusaResolvido && motivoRecusaObservacaoRecord && (
                  <div className="pt-2 border-t border-zinc-800/60">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Observação da Resolução</span>
                    <p className="text-xs text-zinc-300 mt-0.5 whitespace-pre-wrap">{motivoRecusaObservacaoRecord}</p>
                  </div>
                )}

                {showResolveForm && !motivoRecusaResolvido && (status === 'recusados' || status === 'a_lancar') && (
                  <div className="flex flex-col gap-2.5 p-2.5 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Novo Vencimento</label>
                      <DatePicker fullWidth value={resolveVencimento} onChange={(date) => setResolveVencimento(date)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Observação (opcional)</label>
                      <textarea
                        value={resolveObservacao}
                        onChange={(e) => setResolveObservacao(e.target.value)}
                        placeholder="O que foi feito para resolver..."
                        rows={2}
                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowResolveForm(false)} className="px-3 py-1.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmResolve}
                        disabled={!resolveVencimento}
                        className="px-3 py-1.5 text-[12px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Confirmar Resolução
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Valor */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor</span>
              <span className="text-lg font-bold text-white tracking-tight">{`R$ ${valorDisplay || '0,00'}`}</span>
            </div>

            {/* Grid resumo */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><Building2 size={10} /> Empreendimento</span>
                <span className="text-sm text-zinc-200 font-medium truncate">{empreendimento || '-'}</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                {paymentMode === 'cartao' ? (
                  <>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><CreditCard size={10} /> Cartão de Crédito</span>
                    <span className="text-sm text-zinc-200 font-medium truncate">{openFaturas.find(f => f.id === faturaId)?.codigo || '-'}</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><Layers size={10} /> Lote</span>
                    <span className="text-sm text-zinc-200 font-medium truncate">{openLotes.find(l => l.id === loteId)?.nome || initialData?.lote || '-'}</span>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><User size={10} /> Responsável</span>
                <span className="text-sm text-zinc-200 font-medium truncate">{sortedUsers.find(u => u.id === assigneeId)?.name || '-'}</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><Calendar size={10} /> Vencimento</span>
                <span className="text-sm text-zinc-200 font-medium truncate">{vencimento ? vencimento.split('-').reverse().join('/') : '-'}</span>
              </div>
            </div>

            {/* Descrição */}
            {descricao && (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><FileText size={10} /> Descrição</span>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{descricao}</p>
              </div>
            )}

            {/* Motivo Detalhado (cartão de crédito) */}
            {paymentMode === 'cartao' && motivoDetalhado && (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><FileText size={10} /> Motivo Detalhado</span>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{motivoDetalhado}</p>
              </div>
            )}

            {/* Anexos */}
            {initialData?.attachments && initialData.attachments.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><Paperclip size={10} /> Anexos</span>
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

            {/* Chat do Título */}
            <div className="mt-2 h-[180px] shrink-0">
              {initialData && (
                <TaskChat 
                  siengeTitle={initialData}
                  customTitle="Comentários e Recados"
                    onUpdate={(msgs) => {
                      if (initialData && onUpdateOnly) {
                        onUpdateOnly({ ...initialData, chatMessages: msgs });
                      } else if (initialData) {
                        onSave({ ...initialData, chatMessages: msgs });
                      }
                    }}
                    baseColor="blue"
                />
              )}
            </div>
          </div>
        ) : (
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

          {/* Forma de lançamento: Lote de Pagamento vs Cartão de Crédito */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Forma de Lançamento</label>
            <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-zinc-800 rounded-lg">
              <button
                type="button"
                onClick={() => { setPaymentMode('lote'); setErrors(p => ({ ...p, faturaId: '', motivoDetalhado: '' })); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  paymentMode === 'lote' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                }`}
              >
                <Layers size={12} /> Lote de Pagamento
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode('cartao'); setErrors(p => ({ ...p, loteId: '' })); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  paymentMode === 'cartao' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                }`}
              >
                <CreditCard size={12} /> Cartão de Crédito
              </button>
            </div>
          </div>

          {paymentMode === 'lote' ? (
            /* Lote de Pagamento selector */
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
          ) : (
            <>
              {/* Cartão de Crédito (Fatura) selector */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <CreditCard size={11} /> Cartão de Crédito <span className="text-red-400">*</span>
                </label>
                {openFaturas.length > 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFaturaDropdownOpen(p => !p)}
                      className={`w-full flex items-center justify-between bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-zinc-800/60 ${
                        errors.faturaId ? 'border-red-500/60 focus:ring-1 focus:ring-red-500/30' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
                      }`}
                    >
                      <span className={faturaId ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>
                        {faturaId ? openFaturas.find(f => f.id === faturaId)?.codigo : 'Selecione uma fatura ou cadastre uma nova'}
                      </span>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isFaturaDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {errors.faturaId && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.faturaId}</p>}

                    {isFaturaDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsFaturaDropdownOpen(false)} />
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {openFaturas.map(f => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => { setFaturaId(f.id); setErrors(p => ({...p, faturaId: ''})); setIsFaturaDropdownOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                                  f.id === faturaId
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <CreditCard size={14} className={f.id === faturaId ? 'text-blue-500/70' : 'text-zinc-500'} />
                                  <span className="font-medium text-[13px]">{f.codigo}</span>
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
                    É necessário cadastrar uma fatura na aba "Cartão de Crédito" antes de criar um título.
                  </div>
                )}
              </div>
            </>
          )}

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
                disabled={isLocked}
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
              onChange={e => { setDescricao(e.target.value.toUpperCase()); if (errors.descricao) setErrors(p => ({ ...p, descricao: '' })); }}
              placeholder="Descreva o título..."
              rows={3}
              className={`${inputClass('descricao')} resize-none`}
            />
            {errors.descricao && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.descricao}</p>}
          </div>

          {/* Motivo Detalhado (cartão de crédito) */}
          {paymentMode === 'cartao' && (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <FileText size={11} /> Motivo Detalhado <span className="text-red-400">*</span>
              </label>
              <textarea
                value={motivoDetalhado}
                onChange={e => { setMotivoDetalhado(e.target.value); if (errors.motivoDetalhado) setErrors(p => ({ ...p, motivoDetalhado: '' })); }}
                placeholder="Detalhe o motivo desta compra no cartão de crédito..."
                rows={2}
                className={`${inputClass('motivoDetalhado')} resize-none`}
              />
              {errors.motivoDetalhado && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{errors.motivoDetalhado}</p>}
            </div>
          )}

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
        )}

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
            {isLocked ? (
              <>
                <button type="button" onClick={handleCloseRequest} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors">
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => setIsLocked(false)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Pencil size={12} /> Editar
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleCloseRequest} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={(paymentMode === 'lote' ? openLotes.length === 0 : openFaturas.length === 0) || isUploading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-blue-500/20 disabled:shadow-none"
                >
                  {isUploading && <Loader2 size={12} className="animate-spin" />}
                  {isUploading ? 'Enviando...' : isEditing ? 'Salvar Alterações' : 'Criar Título'}
                </button>
              </>
            )}
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

    {showRejectModal && (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        onMouseDown={(e) => { e.stopPropagation(); setShowRejectModal(false); }}
      >
        <div
          className="bg-[#18181b] border border-zinc-800/80 rounded-xl p-5 flex flex-col gap-3 w-full max-w-[380px] shadow-2xl animate-slide-up"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-100 flex items-center gap-2">
              <XCircle className="text-red-500" size={16} />
              Recusar Título
            </h3>
            <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
              Informe o motivo da recusa. Ele ficará registrado neste título.
            </p>
          </div>
          <textarea
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Descreva o motivo da recusa..."
            rows={3}
            className="w-full bg-zinc-900/60 border border-red-900/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-red-500/30 resize-none"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-3 py-1.5 text-[13px] font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim()}
              className="px-3 py-1.5 text-[13px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Confirmar Recusa
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
