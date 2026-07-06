import React, { useState } from 'react';
import { Check, X, ExternalLink, Image as ImageIcon, Send, Pencil, Trash2, RotateCcw, Maximize2, MessageSquare, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Delivery, DeliveryThreadMessage } from '../types';
import DeliveryForm from './DeliveryForm';
import FullscreenImageEditor from './FullscreenImageEditor';
import { useAuth } from '../context/AuthContext';

interface DeliveryApprovalProps {
  delivery: Delivery;
  index: number;
  taskTitle?: string;
  onUpdate: (id: string, updates: Partial<Delivery>) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export default function DeliveryApproval({ 
  delivery, 
  index,
  taskTitle,
  onUpdate, 
  onDelete,
  disabled = false
}: DeliveryApprovalProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [chatText, setChatText] = useState('');
  
  const { currentUser } = useAuth();
  
  const [isFullscreenEditorOpen, setIsFullscreenEditorOpen] = useState(false);
  const [annotatedImages, setAnnotatedImages] = useState<string[]>([]);
  const [isSubmittingNewVersion, setIsSubmittingNewVersion] = useState(false);
  const [isExpanded, setIsExpanded] = useState(delivery.status !== 'approved');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState<number | null>(null);

  const isExpired = new Date(delivery.createdAt).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000;

  // Build the unified thread. If the delivery is old and has no thread, we mock it.
  const thread: DeliveryThreadMessage[] = [...(delivery.thread || [])];
  
  const images = delivery.imageUrls && delivery.imageUrls.length > 0 
    ? delivery.imageUrls 
    : [delivery.imageUrl].filter(Boolean) as string[];
    
  
  // If thread has no submission (because it's old), inject the defense
  if (!thread.some(t => t.type === 'submission') && delivery.creativeDefense) {
    // Insert at beginning
    thread.unshift({
      id: 'legacy-sub',
      role: 'designer',
      type: 'submission',
      content: delivery.creativeDefense,
      createdAt: delivery.createdAt
    });
  }
  
  // If thread has no rejection (but has legacy rejected feedback), inject it
  if (!thread.some(t => t.action === 'rejected') && delivery.rejectedFeedback) {
    thread.push({
      id: 'legacy-rej',
      role: 'manager',
      type: 'feedback',
      action: 'rejected',
      content: delivery.rejectedFeedback,
      annotatedImageUrl: delivery.annotatedImageUrl,
      createdAt: delivery.createdAt // approximation
    });
  }

  const currentMajorVersion = thread.length > 0 ? Math.max(...thread.map(t => t.majorVersion || 1)) : 1;
  const currentMajorThread = thread.filter(t => (t.majorVersion || 1) === currentMajorVersion);
  const currentMinorVersion = currentMajorThread.length > 0 ? Math.max(...currentMajorThread.map(t => t.minorVersion || 0)) : 0;

  const addMessage = (msg: Omit<DeliveryThreadMessage, 'id' | 'createdAt' | 'majorVersion' | 'minorVersion'>) => {
    let nextMajor = currentMajorVersion;
    let nextMinor = currentMinorVersion + 1;

    if (msg.type === 'submission') {
      nextMajor = thread.length > 0 ? currentMajorVersion + 1 : 1;
      nextMinor = 0;
    }

    const newMessage: DeliveryThreadMessage = {
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      majorVersion: nextMajor,
      minorVersion: nextMinor,
      authorId: currentUser?.id,
      authorName: currentUser?.name,
      createdAt: new Date().toISOString()
    };
    return [...thread, newMessage];
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const newThread = addMessage({
      role: 'designer', // fallback
      type: 'chat',
      content: chatText
    });
    onUpdate(delivery.id, { thread: newThread });
    setChatText('');
  };

  const handleApprove = () => {
    const newThread = addMessage({
      role: 'manager',
      type: 'feedback',
      action: 'approved',
      content: 'Aprovado!',
      editorName: currentUser?.name || 'Aprovador'
    });
    onUpdate(delivery.id, { status: 'approved', thread: newThread });
  };

  const handleReject = () => {
    if (!showFeedbackInput) {
      setShowFeedbackInput(true);
      return;
    }
    
    const submissions = thread.filter(t => t.type === 'submission');
    const currentRevisionNumber = submissions.length > 0 ? submissions[submissions.length - 1].revisionNumber || submissions.length : 1;

    const hasAnnotations = annotatedImages.some(Boolean);

    const newThread = addMessage({
      role: 'manager',
      type: 'feedback',
      action: 'rejected',
      content: feedback || 'Reprovado sem justificativa',
      annotatedImageUrl: hasAnnotations ? annotatedImages.find(Boolean) : undefined,
      annotatedImageUrls: hasAnnotations ? annotatedImages : undefined,
      revisionNumber: currentRevisionNumber,
      editorName: currentUser?.name || 'Aprovador'
    });
    
    onUpdate(delivery.id, { 
      status: 'rejected', 
      thread: newThread, 
      annotatedImageUrl: hasAnnotations ? annotatedImages.find(Boolean) : undefined,
      annotatedImageUrls: hasAnnotations ? annotatedImages : undefined
    });
    setFeedback('');
    setShowFeedbackInput(false);
    setAnnotatedImages([]);
  };

  const handleDesignerReply = (action: 'request_review' | 'will_rework') => {
    if (action === 'request_review' && !showReplyInput) {
      setShowReplyInput(true);
      return;
    }
    
    const newThread = addMessage({
      role: 'designer',
      type: 'reply',
      action: action,
      content: action === 'will_rework' ? 'Vou refazer a arte.' : replyText,
      editorName: currentUser?.name || 'Designer'
    });
    
    onUpdate(delivery.id, { 
      status: action === 'will_rework' ? 'reworking' : 'review_requested', 
      thread: newThread 
    });
    
    if (action === 'request_review') {
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  return (
    <div className={`flex flex-col animate-fade-in py-6 ${
      !isExpanded && delivery.status === 'approved' 
        ? 'border border-emerald-500/20 bg-emerald-500/[0.02] rounded-lg px-5 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.03)]' 
        : 'border-b border-zinc-800/60 last:border-0'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <h4 className="text-[13px] font-medium text-zinc-200 tracking-tight">
            Criativo {index.toString().padStart(2, '0')}
          </h4>
          {delivery.status === 'pending' && (
            <span className="px-1.5 py-0.5 border border-yellow-500/20 text-yellow-500/80 text-[10px] uppercase rounded">
              Pendente
            </span>
          )}
          {delivery.status === 'review_requested' && (
            <span className="px-1.5 py-0.5 border border-orange-500/20 text-orange-400/80 text-[10px] uppercase rounded">
              Revisão Solicitada
            </span>
          )}
          {delivery.status === 'reworking' && (
            <span className="px-1.5 py-0.5 border border-blue-500/20 text-blue-400/80 text-[10px] uppercase rounded">
              Em Refação
            </span>
          )}
          {delivery.status === 'approved' && (
            <span className="px-1.5 py-0.5 border border-emerald-500/20 text-emerald-400/80 text-[10px] uppercase rounded">
              Aprovado
            </span>
          )}
          {delivery.status === 'rejected' && (
            <span className="px-1.5 py-0.5 border border-red-500/20 text-red-400/80 text-[10px] uppercase rounded">
              Reprovado
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onDelete && !disabled && (
            <button onClick={() => onDelete(delivery.id)} className="p-1.5 text-zinc-500 hover:text-red-400 bg-zinc-900/50 hover:bg-red-500/10 rounded transition-colors" title="Excluir Criativo">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {(() => {
        const timelineEvents = thread
          .filter(t => t.type !== 'chat')
          .map(t => {
            let label = 'Evento';
            if (t.type === 'submission') label = 'Enviado para aprovação';
            else if (t.action === 'approved') label = 'Aprovado';
            else if (t.action === 'rejected') label = 'Reprovado';
            else if (t.action === 'request_review') label = 'Revisão solicitada';
            else if (t.action === 'will_rework') label = 'Em refação';
            return { label, date: t.createdAt };
          });

        if (timelineEvents.length === 0) return null;

        return (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-2">
            <div className="flex items-center gap-0 overflow-x-auto hide-scrollbar">
              {timelineEvents.map((event, idx) => {
                const isLast = idx === timelineEvents.length - 1;
                return (
                  <div key={idx} className="flex items-start flex-shrink-0">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isLast ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]' : 'bg-zinc-700'}`} />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${isLast ? 'text-zinc-200' : 'text-zinc-500'}`}>
                          {event.label}
                        </span>
                      </div>
                      <span className="text-[9px] text-zinc-600 whitespace-nowrap pl-3">
                        {new Date(event.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="w-8 h-[1px] bg-zinc-800/80 mx-3 mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {delivery.status === 'reworking' && !isExpired && !disabled && (
                <button
                  onClick={() => setIsSubmittingNewVersion(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold bg-yellow-500 hover:bg-yellow-400 text-yellow-950 uppercase tracking-wider rounded transition-colors whitespace-nowrap shrink-0"
                >
                  + Adicionar novo arquivo
                </button>
              )}

              {delivery.status === 'approved' && !isExpanded && delivery.figmaLink && (
                <a 
                  href={delivery.figmaLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 uppercase tracking-wider rounded transition-colors whitespace-nowrap"
                >
                  <ExternalLink size={14} />
                  Acesse o arquivo
                </a>
              )}

              {delivery.status === 'approved' && (
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 uppercase tracking-wider rounded transition-colors whitespace-nowrap"
                >
                  {isExpanded ? 'Ocultar Informações' : 'Revelar Informações'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {isExpanded && (
        <div className="flex flex-col md:flex-row gap-8 items-stretch md:h-[500px]">
        
        {/* Left Column: Image Preview */}
        <div className="w-full md:w-5/12 flex flex-col gap-2 shrink-0 h-full">
          <div className="flex-1 min-h-0 relative rounded-md overflow-hidden border border-zinc-800/60 bg-transparent select-none w-full flex items-center justify-center">
            {isExpired ? (
              <div className="relative w-full aspect-video flex flex-col items-center justify-center">
                <img 
                  src={delivery.thumbnailUrl || ''} 
                  alt="Thumbnail" 
                  className="absolute inset-0 w-full h-full object-cover blur-md opacity-30" 
                />
                <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
                  <div className="p-3 bg-red-500/10 rounded-full">
                    <AlertCircle className="text-red-400" size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-300">Entrega Expirada</h4>
                  <p className="text-xs text-zinc-500 max-w-[250px]">O arquivo original foi removido após 30 dias por política de retenção. O histórico de aprovação foi mantido.</p>
                </div>
              </div>
            ) : (
              <div 
                className="relative inline-block w-full max-w-full group h-full"
              >
                {(() => {
                  const submissions = thread.filter(t => t.type === 'submission');
                  const revisionCount = Math.max(1, submissions.length);
                  
                  const activeRevisionIndex = selectedRevisionIndex !== null && selectedRevisionIndex < submissions.length 
                    ? selectedRevisionIndex 
                    : Math.max(0, submissions.length - 1);
                    
                  const activeSubmission = submissions[activeRevisionIndex];
                  
                  let activeImages: string[] = [];
                  if (activeSubmission) {
                    if (activeSubmission.imageUrls && activeSubmission.imageUrls.length > 0) {
                      activeImages = activeSubmission.imageUrls;
                    } else if (activeSubmission.imageUrl) {
                      activeImages = [activeSubmission.imageUrl];
                    }
                  }
                  
                  if (activeImages.length === 0) {
                    activeImages = images; // fallback
                  }
                  
                  const isCopyDelivery = !!activeSubmission?.copyText;
                  
                  const isLatestRevision = activeRevisionIndex === Math.max(0, submissions.length - 1);
                    
                  const displayImage = isLatestRevision 
                    ? (annotatedImages[currentImageIndex] || delivery.annotatedImageUrls?.[currentImageIndex] || delivery.annotatedImageUrl || activeImages[currentImageIndex])
                    : activeImages[currentImageIndex];
                  
                  return (
                    <>
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 flex-wrap max-w-[calc(100%-24px)]">
                        {Array.from({ length: revisionCount }).map((_, i) => {
                          const isSelected = i === activeRevisionIndex;
                          return (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRevisionIndex(i);
                                setCurrentImageIndex(0);
                              }}
                              className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider backdrop-blur-sm border shadow-sm transition-colors ${
                                isSelected 
                                  ? 'bg-yellow-500 text-yellow-950 border-yellow-500' 
                                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800'
                              }`}
                            >
                              REV {(i + 1).toString().padStart(2, '0')}
                            </button>
                          );
                        })}
                      </div>
                      
                      {isCopyDelivery ? (
                        <div className="w-full h-full p-6 overflow-y-auto max-h-full text-zinc-300 text-sm prose prose-invert prose-p:my-1 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm text-left mt-8">
                          <div className="mb-4 font-bold text-pink-400 uppercase tracking-widest text-[10px]">
                            {activeSubmission?.editorName || 'Copy'}
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: activeSubmission?.copyText || '' }} />
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img 
                            src={displayImage} 
                            alt={`Entrega ${currentImageIndex + 1}`} 
                            onClick={() => {
                              if (delivery.status === 'pending' || delivery.status === 'review_requested' || delivery.status === 'rejected') setIsFullscreenEditorOpen(true);
                            }}
                            className="max-h-full h-full w-auto object-contain block group-hover:brightness-75 transition-all cursor-pointer mx-auto"
                          />
                          
                          {!(isLatestRevision && annotatedImages[currentImageIndex]) && !(isLatestRevision && delivery.annotatedImageUrls?.[currentImageIndex]) && !(isLatestRevision && delivery.annotatedImageUrl) && activeImages.length > 1 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(prev => prev === 0 ? activeImages.length - 1 : prev - 1);
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-20"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(prev => prev === activeImages.length - 1 ? 0 : prev + 1);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-20"
                              >
                                <ChevronRight size={20} />
                              </button>
                              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/40 px-2 py-1 rounded-full">
                                {activeImages.map((_, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/40'}`} 
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
                {(delivery.status === 'pending' || delivery.status === 'review_requested' || delivery.status === 'rejected') && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-black/60 p-3 rounded-full text-white backdrop-blur-sm">
                      <Maximize2 size={24} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {delivery.figmaLink && (
            <div className="mt-auto pt-2">
              <a 
                href={delivery.figmaLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors w-full border border-zinc-700/50"
              >
                <ExternalLink size={14} />
                Acesse o arquivo
              </a>
            </div>
          )}
        </div>

        {/* Right Column: Info and Actions (Thread) */}
        <div className="flex-1 flex flex-col gap-4 h-full">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <MessageSquare size={12} /> Histórico de Revisão
          </span>
          
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4 scrollbar-thin">
            {thread.map((msg) => {
              const isMe = msg.authorId === currentUser?.id;
              const displayName = msg.authorName || (msg.role === 'manager' ? 'Aprovador' : 'Solicitante');
              const isEvent = ['submission'].includes(msg.type) || ['approved', 'rejected', 'request_review', 'will_rework'].includes(msg.action || '');
              
              const renderEventLine = () => {
                if (!isEvent) return null;
                let title = '';
                if (msg.type === 'submission') title = 'Criativo Enviado para Aprovação';
                else if (msg.action === 'rejected') title = 'Criativo Reprovado';
                else if (msg.action === 'approved') title = 'Criativo Aprovado';
                else if (msg.action === 'request_review') title = 'Revisão Solicitada';
                else if (msg.action === 'will_rework') title = 'Em Refação';
                
                return (
                  <div className="relative flex flex-col items-center justify-center mt-6 mb-4">
                    <div className="absolute w-full h-[1px] bg-zinc-800/80 top-[10px]" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-[#08080a] px-4 relative z-10">
                      {title}
                    </span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-[0.2em] mt-1 relative z-10 bg-[#08080a] px-4">
                      {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                );
              };

              return (
                <div key={msg.id}>
                  {renderEventLine()}
                  {msg.content && (
                    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'} ${isEvent ? 'mt-3' : 'mt-0'}`}>
                      {!isEvent && (
                        <span className="text-[10px] text-zinc-500 font-medium px-1">
                          {displayName} • {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      )}
                      {isEvent && (
                        <span className="text-[10px] text-zinc-500 font-medium px-1 uppercase mt-0.5">
                          {msg.editorName || displayName} ⬢ {new Date(msg.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')}
                        </span>
                      )}
                      <div className={`p-3 max-w-[90%] text-[13px] leading-relaxed rounded-xl ${
                        isMe 
                          ? 'bg-zinc-800 text-zinc-200 rounded-tr-sm' 
                          : 'bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 rounded-tl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fluxo de Decisão (Bottom Actions) */}
          <div className="mt-auto pt-4 border-t border-zinc-800/50 flex flex-col gap-3">

            {/* GESTOR: APROVAR/REPROVAR */}
            {(delivery.status === 'pending' || delivery.status === 'review_requested') && !isExpired && !disabled && (
              <div className="flex flex-col gap-4">
                {showFeedbackInput && (
                  <div className="flex flex-col gap-2 animate-slide-down">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Motivo da Reprovação</span>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Explique o que precisa ser ajustado na peça..."
                      className="w-full bg-[#121214] border border-red-900/50 rounded-md p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500/50 resize-none min-h-[80px]"
                    />
                    {annotatedImages.some(Boolean) && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12}/> Imagens com rabiscos anexadas</span>
                        <button onClick={() => setAnnotatedImages([])} className="text-[10px] text-zinc-500 hover:text-red-400">Remover rabiscos</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {showFeedbackInput ? (
                    <>
                      <button 
                        onClick={() => setShowFeedbackInput(false)}
                        className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleReject}
                        className="flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md transition-colors"
                      >
                        <Send size={14} /> Confirmar Reprovação
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={handleReject}
                        className="flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold bg-transparent hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-500/20 rounded-md transition-colors"
                      >
                        <X size={14} /> Reprovar
                      </button>
                      <button 
                        onClick={handleApprove}
                        className="flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md transition-colors"
                      >
                        <Check size={14} /> Aprovar Arte
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input 
                type="text" 
                value={chatText}
                disabled={disabled}
                onChange={(e) => setChatText(e.target.value)}
                placeholder={disabled ? "Tarefa em modo leitura" : "Mensagem..."}
                className="flex-1 bg-[#121214] border border-zinc-800 rounded-md px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                type="submit" 
                disabled={disabled || !chatText.trim()}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Enviar mensagem"
              >
                <Send size={14} />
              </button>
            </form>

            {/* DESIGNER: REPROVADO -> ESCOLHER AÇÃO */}
            {(delivery.status === 'rejected' || delivery.status === 'reworking') && !disabled && (
              <div className="flex flex-col gap-4">
                {showReplyInput ? (
                  <div className="flex flex-col gap-2 animate-slide-down">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      Sua Justificativa
                    </span>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Justifique por que a alteração não é necessária..."
                      className="w-full bg-[#121214] border border-zinc-700/50 rounded-md p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 resize-none min-h-[80px]"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button 
                        onClick={() => setShowReplyInput(false)}
                        className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-transparent"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleDesignerReply('request_review')}
                        disabled={!replyText.trim()}
                        className="flex-1 py-2 text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-md transition-colors disabled:opacity-50"
                      >
                        Enviar Justificativa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowReplyInput(true)}
                      className="flex-1 py-3 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-transparent rounded-md transition-colors"
                    >
                      Justificar
                    </button>
                    <button 
                      onClick={() => {
                        if (delivery.status !== 'reworking') {
                          handleDesignerReply('will_rework');
                        }
                        setIsSubmittingNewVersion(true);
                      }}
                      className="flex-1 py-3 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 text-xs font-bold border border-transparent rounded-md transition-colors shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                    >
                      <RefreshCw size={14} /> Refazer
                    </button>
                  </div>
                )}
              </div>
            )}

            {delivery.status === 'approved' && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20">
                <Check size={14} /> Arte Aprovada e Finalizada
              </div>
            )}

          </div>
        </div>
        </div>
      )}

      {isFullscreenEditorOpen && (
        <FullscreenImageEditor
          imageUrls={images}
          initialIndex={currentImageIndex}
          initialAnnotatedDataUrls={annotatedImages.length > 0 ? annotatedImages : (delivery.annotatedImageUrls || (delivery.annotatedImageUrl ? [delivery.annotatedImageUrl] : []))}
          onSave={(dataUrls) => {
            setAnnotatedImages(dataUrls);
            setIsFullscreenEditorOpen(false);
          }}
          onClose={() => setIsFullscreenEditorOpen(false)}
        />
      )}

      {/* MODAL: SUBMETER NOVA VERSÃO */}
      {isSubmittingNewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <DeliveryForm
              onSave={(data) => {
                const newThread = addMessage({
                  role: 'designer',
                  type: 'submission',
                  content: data.creativeDefense || 'Nova versão enviada',
                  imageUrl: data.imageUrls?.[0] || data.imageUrl,
                  imageUrls: data.imageUrls,
                  editorName: currentUser?.name || 'Designer'
                });
                
                onUpdate(delivery.id, { 
                  status: 'pending', 
                  imageUrl: data.imageUrls?.[0] || data.imageUrl,
                  imageUrls: data.imageUrls,
                  figmaLink: data.figmaLink,
                  annotatedImageUrl: undefined,
                  annotatedImageUrls: undefined,
                  thread: newThread 
                });
                setIsSubmittingNewVersion(false);
              }}
              onCancel={() => setIsSubmittingNewVersion(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
