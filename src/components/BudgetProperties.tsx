import React, { useState } from 'react';
import { Task, Proposal } from '../types';
import { Plus, X, Building2, DollarSign, Handshake, Link2, AlignLeft, Check, Edit2, Upload, ExternalLink, UserPlus, Clock, CheckCircle2, XCircle, MessageCircle, Send, Tag, Grid } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface BudgetPropertiesProps {
  task: Task;
  saveChange: (updates: Partial<Task>) => void;
  themeColor: string;
}

export default function BudgetProperties({ task, saveChange, themeColor }: BudgetPropertiesProps) {
  const { currentUser, allUsers } = useAuth();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'propostas' | 'aprovacao'>('propostas');
  const [proposals, setProposals] = useState<Proposal[]>(task.proposals || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [approverMenuOpenFor, setApproverMenuOpenFor] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const proposalsRef = React.useRef(proposals);

  React.useEffect(() => {
    proposalsRef.current = proposals;
  }, [proposals]);

  // Flush pending saves immediately if component is unmounted (e.g. user closed task sheet quickly)
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveChange({ proposals: proposalsRef.current });
      }
    };
  }, []); // run only on unmount

  // Sincroniza apenas quando o array cresce/diminui vindo do backend (garante que não perca foco ao digitar)
  React.useEffect(() => {
    if (task.proposals && task.proposals.length !== proposals.length) {
      setProposals(task.proposals);
    }
  }, [task.proposals?.length]);

  React.useEffect(() => {
    const handleOpenSection = (e: CustomEvent<{ section: string, targetId?: string }>) => {
      if (e.detail.targetId && e.detail.targetId.startsWith('proposal-')) {
        setActiveTab('propostas');
      }
    };
    window.addEventListener('openTaskSection', handleOpenSection as EventListener);
    return () => window.removeEventListener('openTaskSection', handleOpenSection as EventListener);
  }, []);

  const triggerSave = (updated: Proposal[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveChange({ proposals: updated });
    }, 600);
  };

  const handleAddProposal = () => {
    const newId = `prop-${Date.now()}`;
    const newProposal: Proposal = {
      id: newId,
      empresa: '',
      valor: '',
      negociado: '',
      documento: '',
      observacao: ''
    };
    const updated = [...proposals, newProposal];
    setProposals(updated);
    setEditingId(newId);
    saveChange({ proposals: updated }); // Salva imediatamente ao criar
  };

  const handleUpdateProposal = (id: string, updates: Partial<Proposal>) => {
    const updated = proposals.map(p => p.id === id ? { ...p, ...updates } : p);
    setProposals(updated); // UI atualiza instantaneamente
    triggerSave(updated); // Backend salva com debounce
  };

  const handleDeleteProposal = (id: string) => {
    const updated = proposals.filter(p => p.id !== id);
    setProposals(updated);
    saveChange({ proposals: updated }); // Salva imediatamente ao deletar
  };

  const handleFileUpload = (id: string, file: File) => {
    // Simulação de upload em memória
    const url = URL.createObjectURL(file);
    handleUpdateProposal(id, { documento: url });
  };

  const handleAddComment = (proposalId: string) => {
    const text = commentInputs[proposalId]?.trim();
    if (!text) return;
    
    const newComment = {
      id: `comment-${Date.now()}`,
      userId: currentUser?.id,
      userName: currentUser?.name || 'Usuário',
      content: text,
      createdAt: new Date().toISOString()
    };

    const targetProposal = proposals.find(p => p.id === proposalId);
    if (!targetProposal) return;

    const updatedComments = [...(targetProposal.comments || []), newComment];
    handleUpdateProposal(proposalId, { comments: updatedComments });
    
    setCommentInputs(prev => ({ ...prev, [proposalId]: '' }));
  };

  const handleApprovalAction = (proposalId: string, status: 'approved' | 'rejected') => {
    handleUpdateProposal(proposalId, { approvalStatus: status });
    const p = proposals.find(pr => pr.id === proposalId);
    if (task.assigneeId) {
      const statusText = status === 'approved' ? 'Aprovada' : 'Reprovada';
      addNotification({
        userId: task.assigneeId,
        actorId: currentUser?.id || '',
        message: `Proposta ${statusText}`,
        details: `A proposta da empresa "${p?.empresa || 'Nova Empresa'}" foi ${statusText.toLowerCase()} na tarefa "${task.title}".`,
        type: status,
        taskId: task.id,
        targetId: `proposal-${proposalId}`
      });
    }
  };

  const formatCurrency = (value: string | undefined) => {
    if (!value) return '-';
    let cleanStr = value.replace(/[^\d.,-]/g, '');
    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    } else if (cleanStr.includes(',')) {
      cleanStr = cleanStr.replace(',', '.');
    }
    const parsed = parseFloat(cleanStr);
    if (isNaN(parsed)) return value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsed);
  };

  return (
    <div className="flex flex-col animate-fade-in bg-[#08080a]/40 p-4 rounded-md border border-zinc-900 mt-2">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800/50 mb-4">
        <button
          onClick={() => setActiveTab('propostas')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'propostas' ? `${themeColor} border-b-2 border-current` : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Propostas
        </button>
        <button
          onClick={() => setActiveTab('aprovacao')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'aprovacao' ? `${themeColor} border-b-2 border-current` : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Aprovação
        </button>
      </div>

      {activeTab === 'propostas' && (
        <div className="flex flex-col gap-4">
          <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar snap-x">
            {proposals.map(p => (
              <div 
                id={`target-proposal-${p.id}`}
                key={p.id} 
                className="w-[calc(33.333%-10.66px)] flex-shrink-0 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col relative group snap-start transition-all hover:border-zinc-700/80 overflow-hidden"
              >
                {/* Header */}
                <div className="flex justify-between items-center p-3 border-b border-zinc-800/50 bg-zinc-900/60 relative">
                  <div className="flex items-center gap-2 max-w-[65%]">
                    <Building2 size={13} className="text-zinc-500 flex-shrink-0" />
                    {editingId === p.id ? (
                      <input 
                        type="text" 
                        autoFocus
                        value={p.empresa} 
                        onChange={(e) => handleUpdateProposal(p.id, { empresa: e.target.value })} 
                        placeholder="Nome da Empresa" 
                        className="bg-transparent text-xs font-semibold text-zinc-200 outline-none placeholder-zinc-600 w-full" 
                      />
                    ) : (
                      <span className="text-xs font-semibold text-zinc-200 truncate pr-2">
                        {p.empresa || 'Nova Empresa'}
                      </span>
                    )}

                    {/* Aprovação Status */}
                    {p.approvalStatus === 'pending' && (
                      <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20 whitespace-nowrap">
                        <Clock size={10} />
                        <span className="text-[9px] font-semibold uppercase tracking-wider">Aprovação Pendente</span>
                      </div>
                    )}
                    {p.approvalStatus === 'approved' && (
                      <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
                        <CheckCircle2 size={10} />
                        <span className="text-[9px] font-semibold uppercase tracking-wider">Aprovada</span>
                      </div>
                    )}
                    {p.approvalStatus === 'rejected' && (
                      <div className="flex items-center gap-1 bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap">
                        <XCircle size={10} />
                        <span className="text-[9px] font-semibold uppercase tracking-wider">Reprovada</span>
                      </div>
                    )}
                    
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Botão Enviar para Aprovação */}
                    {(!p.approvalStatus || p.approvalStatus === 'none') && (
                      <div className="relative">
                        <button
                          onClick={() => setApproverMenuOpenFor(approverMenuOpenFor === p.id ? null : p.id)}
                          className="text-zinc-500 hover:text-pink-400 transition-colors p-1 bg-zinc-800/50 hover:bg-zinc-800 rounded-md flex items-center justify-center"
                          title="Enviar para Aprovação"
                        >
                          <UserPlus size={12} />
                        </button>
                        
                        {approverMenuOpenFor === p.id && (
                          <div className="absolute right-0 top-[calc(100%+4px)] w-48 bg-[#18181b] border border-zinc-800 rounded-md shadow-xl z-50 overflow-hidden animate-fade-in flex flex-col py-1">
                            <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Selecionar Aprovador</span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                              {allUsers.map(u => (
                                <button
                                  type="button"
                                  key={u.id}
                                  onClick={() => {
                                    handleUpdateProposal(p.id, { approverId: u.id, approvalStatus: 'pending' });
                                    addNotification({
                                      userId: u.id,
                                      actorId: currentUser?.id || '',
                                      message: 'Aprovação de Proposta',
                                      details: `Você foi selecionado para aprovar a proposta da empresa "${p.empresa || 'Nova Empresa'}" na tarefa "${task.title}".`,
                                      type: 'review_requested',
                                      taskId: task.id,
                                      targetId: `proposal-${p.id}`
                                    });
                                    setApproverMenuOpenFor(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/60 transition-colors text-left rounded-md"
                                >
                                  <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                                  <span className="text-xs text-zinc-300">{u.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {p.approvalStatus === 'pending' && currentUser?.id === p.approverId && (
                      <>
                        <button
                          onClick={() => handleApprovalAction(p.id, 'approved')}
                          className="flex items-center justify-center p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md transition-colors"
                          title="Aprovar Proposta"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                        <button
                          onClick={() => handleApprovalAction(p.id, 'rejected')}
                          className="flex items-center justify-center p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md transition-colors"
                          title="Reprovar Proposta"
                        >
                          <XCircle size={12} />
                        </button>
                      </>
                    )}

                    {(!p.approvalStatus || p.approvalStatus === 'none' || p.approvalStatus === 'rejected' || currentUser?.id === p.approverId) && editingId !== p.id && (
                      <button 
                        onClick={() => setEditingId(p.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 bg-zinc-800/50 hover:bg-zinc-800 rounded-md flex items-center justify-center"
                        title="Editar proposta"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    {(!p.approvalStatus || p.approvalStatus === 'none' || p.approvalStatus === 'rejected' || currentUser?.id === p.approverId) && (
                      <button 
                        onClick={() => setDeleteConfirmId(p.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 bg-zinc-800/50 hover:bg-zinc-800 rounded-md flex items-center justify-center"
                        title="Remover proposta"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Body */}
                <div className="p-3 flex flex-col gap-3">
                  {/* Row 1: Valor e Negociado */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <DollarSign size={10} /> Valor
                      </label>
                      {editingId === p.id ? (
                        <input 
                          type="text" 
                          value={p.valor} 
                          onChange={(e) => handleUpdateProposal(p.id, { valor: e.target.value })} 
                          placeholder="R$ 0,00" 
                          className="bg-zinc-950/50 border border-zinc-800/80 rounded p-1.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-700 transition-all" 
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-300 truncate">{formatCurrency(p.valor)}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Handshake size={10} /> Negociado
                      </label>
                      {editingId === p.id ? (
                        <input 
                          type="text" 
                          value={p.negociado} 
                          onChange={(e) => handleUpdateProposal(p.id, { negociado: e.target.value })} 
                          placeholder="R$ 0,00" 
                          className="bg-zinc-950/50 border border-zinc-800/80 rounded p-1.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-700 transition-all" 
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-300 truncate">{formatCurrency(p.negociado)}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Valor Unitário e Valor m2 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Tag size={10} /> Valor Unitário
                      </label>
                      {editingId === p.id ? (
                        <input 
                          type="text" 
                          value={p.valorUnitario || ''} 
                          onChange={(e) => handleUpdateProposal(p.id, { valorUnitario: e.target.value })} 
                          placeholder="R$ 0,00 / un" 
                          className="bg-zinc-950/50 border border-zinc-800/80 rounded p-1.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-700 transition-all" 
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-300 truncate">{formatCurrency(p.valorUnitario)}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Grid size={10} /> Valor m²
                      </label>
                      {editingId === p.id ? (
                        <input 
                          type="text" 
                          value={p.valorM2 || ''} 
                          onChange={(e) => handleUpdateProposal(p.id, { valorM2: e.target.value })} 
                          placeholder="R$ 0,00 / m²" 
                          className="bg-zinc-950/50 border border-zinc-800/80 rounded p-1.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-700 transition-all" 
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-300 truncate">{formatCurrency(p.valorM2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Documento */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Link2 size={10} /> Documento / Link
                    </label>
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input 
                          type="text" 
                          value={p.documento} 
                          onChange={(e) => handleUpdateProposal(p.id, { documento: e.target.value })} 
                          placeholder="Link (https://...)" 
                          className="bg-zinc-950/50 border border-zinc-800/80 rounded p-1.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-700 transition-all flex-1 min-w-0" 
                        />
                        <label className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 rounded cursor-pointer text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors shrink-0">
                          <Upload size={10} />
                          Upload
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload(p.id, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {p.documento ? (
                          <>
                            <a href={p.documento.startsWith('http') || p.documento.startsWith('blob:') ? p.documento : `https://${p.documento}`} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[65%] shrink-0 flex items-center gap-1.5">
                              {p.documento.startsWith('blob:') ? 'Documento Anexado' : p.documento}
                            </a>
                            <a 
                              href={p.documento.startsWith('http') || p.documento.startsWith('blob:') ? p.documento : `https://${p.documento}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="shrink-0 flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors text-[9px] font-semibold uppercase tracking-wider"
                            >
                              <ExternalLink size={10} /> Abrir
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-600">-</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 4: Observação */}
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <AlignLeft size={10} /> Observações
                    </label>
                    {editingId === p.id ? (
                      <textarea 
                        rows={2}
                        value={p.observacao} 
                        onChange={(e) => handleUpdateProposal(p.id, { observacao: e.target.value })} 
                        placeholder="Detalhes ou condições da proposta..." 
                        className="bg-zinc-950/50 border border-zinc-800/80 rounded flex-1 p-1.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none placeholder-zinc-700 transition-all" 
                      />
                    ) : (
                      <p className="text-[11px] text-zinc-400 line-clamp-3">
                        {p.observacao || '-'}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId === p.id && (
                    <div className="mt-2 pt-3 border-t border-zinc-800/50 flex justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className={`flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded text-[11px] font-semibold text-white transition-colors ${themeColor.replace('text-', 'bg-').split('/')[0]} hover:opacity-90`}
                      >
                        <Check size={12} /> Salvar Proposta
                      </button>
                    </div>
                  )}

                  {/* Chat Section */}
                  <div className="mt-1 border-t border-zinc-800/50 pt-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      <MessageCircle size={10} /> Chat da Proposta
                    </div>
                    
                    {/* Comments List */}
                    <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto no-scrollbar">
                      {p.comments && p.comments.length > 0 ? (
                        p.comments.map(c => (
                          <div key={c.id} className="flex gap-2 bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/30">
                            <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400 shrink-0">
                              {c.userName?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-semibold text-zinc-300">{c.userName}</span>
                              <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug break-words">
                                {c.content}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-zinc-600 italic px-1">Nenhum comentário ainda.</div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="flex items-end gap-1.5 mt-1">
                      <textarea
                        rows={1}
                        value={commentInputs[p.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(p.id);
                          }
                        }}
                        placeholder="Adicionar comentário..."
                        className="flex-1 bg-zinc-950/50 border border-zinc-800/80 rounded-lg p-2 text-[10px] text-zinc-300 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none min-h-[32px] max-h-[80px]"
                      />
                      <button
                        onClick={() => handleAddComment(p.id)}
                        disabled={!commentInputs[p.id]?.trim()}
                        className={`p-2 rounded-lg transition-colors shrink-0 ${
                          commentInputs[p.id]?.trim() 
                            ? 'bg-blue-600 text-white hover:bg-blue-500' 
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <button 
              onClick={handleAddProposal}
              className="w-[calc(33.333%-10.66px)] flex-shrink-0 flex flex-col items-center justify-center gap-2 border border-dashed border-zinc-800 rounded-xl p-4 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/30 transition-all min-h-[160px] snap-start"
            >
              <Plus size={18} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-center">Adicionar Proposta</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'aprovacao' && (
        <div className="flex flex-col items-center justify-center py-10 text-zinc-600 text-xs italic">
          Nenhum fluxo de aprovação configurado.
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmModal
          isOpen={true}
          title="Excluir Proposta"
          message="Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita."
          confirmText="Excluir"
          onConfirm={() => {
            handleDeleteProposal(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
