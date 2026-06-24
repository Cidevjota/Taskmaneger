import React, { useState } from 'react';
import { Check, X, ExternalLink, Image as ImageIcon, Send, Pencil, Trash2, RotateCcw, Maximize2, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { Delivery, DeliveryThreadMessage } from '../types';
import FullscreenImageEditor from './FullscreenImageEditor';
import { useAuth } from '../context/AuthContext';

interface DeliveryApprovalProps {
  delivery: Delivery;
  index: number;
  taskTitle?: string;
  onUpdate: (id: string, updates: Partial<Delivery>) => void;
  onDelete: (id: string) => void;
}

export default function DeliveryApproval({ 
  delivery, 
  index,
  taskTitle,
  onUpdate, 
  onDelete
}: DeliveryApprovalProps) {
  const [feedback, setFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [chatText, setChatText] = useState('');
  
  const { currentUser } = useAuth();
  
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDefense, setNewDefense] = useState('');

  const [isFullscreenEditorOpen, setIsFullscreenEditorOpen] = useState(false);
  const [annotatedImage, setAnnotatedImage] = useState<string | undefined>(undefined);
  const [isSubmittingNewVersion, setIsSubmittingNewVersion] = useState(false);
  const [isExpanded, setIsExpanded] = useState(delivery.status !== 'approved');

  const isExpired = new Date(delivery.createdAt).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000;

  // Build the unified thread. If the delivery is old and has no thread, we mock it.
  const thread: DeliveryThreadMessage[] = [...(delivery.thread || [])];
  
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

    const newThread = addMessage({
      role: 'manager',
      type: 'feedback',
      action: 'rejected',
      content: feedback,
      annotatedImageUrl: annotatedImage,
      revisionNumber: currentRevisionNumber,
      editorName: currentUser?.name || 'Aprovador'
    });
    
    onUpdate(delivery.id, { status: 'rejected', thread: newThread, annotatedImageUrl: annotatedImage });
    setFeedback('');
    setShowFeedbackInput(false);
    setAnnotatedImage(undefined);
  };

  const handleDesignerReply = (action: 'request_review' | 'will_rework') => {
    if (!showReplyInput) {
      setShowReplyInput(true);
      return;
    }
    
    const newThread = addMessage({
      role: 'designer',
      type: 'reply',
      action: action,
      content: replyText,
      editorName: currentUser?.name || 'Designer'
    });
    
    onUpdate(delivery.id, { 
      status: action === 'will_rework' ? 'reworking' : 'review_requested', 
      thread: newThread 
    });
    setReplyText('');
    setShowReplyInput(false);
  };

  const handleNewSubmission = () => {
    if (!newImageUrl.trim()) return;
    
    const newThread = addMessage({
      role: 'designer',
      type: 'submission',
      content: newDefense || 'Nova versão enviada',
      imageUrl: newImageUrl,
      editorName: currentUser?.name || 'Designer'
    });
    
    onUpdate(delivery.id, { 
      status: 'pending', 
      imageUrl: newImageUrl,
      annotatedImageUrl: undefined,
      thread: newThread 
    });
    setNewImageUrl('');
    setNewDefense('');
    setIsSubmittingNewVersion(false);
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new globalThis.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_DIM = 1920;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round(height * (MAX_DIM / width));
                width = MAX_DIM;
              } else {
                width = Math.round(width * (MAX_DIM / height));
                height = MAX_DIM;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              setNewImageUrl(dataUrl);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
        break;
      }
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
          {onDelete && (
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
              {delivery.status === 'reworking' && !isExpired && (
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
                  const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;
                  const isCopyDelivery = !!latestSubmission?.copyText;
                  
                  return (
                    <>
                      <div className="absolute top-3 left-3 z-20 pointer-events-none">
                        <span className="px-2 py-1 bg-zinc-900/90 text-zinc-300 text-[10px] font-bold rounded uppercase tracking-wider backdrop-blur-sm border border-zinc-700/50 shadow-sm flex items-center gap-1.5">
                          REV {revisionCount.toString().padStart(2, '0')}
                        </span>
                      </div>
                      {isCopyDelivery ? (
                        <div className="w-full h-full p-6 overflow-y-auto max-h-full text-zinc-300 text-sm prose prose-invert prose-p:my-1 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm text-left">
                          <div className="mb-4 font-bold text-pink-400 uppercase tracking-widest text-[10px]">
                            {latestSubmission.editorName || 'Copy'}
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: latestSubmission.copyText || '' }} />
                        </div>
                      ) : (
                        <img 
                          src={annotatedImage || delivery.annotatedImageUrl || delivery.imageUrl} 
                          alt="Entrega" 
                          onClick={() => {
                            if (delivery.status === 'pending' || delivery.status === 'review_requested' || delivery.status === 'rejected') setIsFullscreenEditorOpen(true);
                          }}
                          className="max-h-full h-full w-auto object-contain block group-hover:brightness-75 transition-all cursor-pointer mx-auto"
                        />
                      )}
                    </>
                  );
                })()}
                {(delivery.status === 'pending' || delivery.status === 'review_requested' || delivery.status === 'rejected') && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
            {(delivery.status === 'pending' || delivery.status === 'review_requested') && !isExpired && (
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
                    {annotatedImage && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12}/> Imagem com rabiscos anexada</span>
                        <button onClick={() => setAnnotatedImage(undefined)} className="text-[10px] text-zinc-500 hover:text-red-400">Remover rabiscos</button>
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
                        disabled={!feedback.trim()}
                        className="flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md transition-colors disabled:opacity-50"
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
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Mensagem..." 
                className="flex-1 bg-[#121214] border border-zinc-800 rounded-md px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
              />
              <button 
                type="submit" 
                disabled={!chatText.trim()}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors disabled:opacity-50"
                title="Enviar mensagem"
              >
                <Send size={14} />
              </button>
            </form>

            {/* DESIGNER: REPROVADO -> ESCOLHER AÇÃO */}
            {delivery.status === 'rejected' && (
              <div className="flex flex-col gap-4">
                {showReplyInput ? (
                  <div className="flex flex-col gap-2 animate-slide-down">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      Sua Resposta
                    </span>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Justifique ou faça sua réplica..."
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
                        Solicitar Revisão
                      </button>
                      <button 
                        onClick={() => handleDesignerReply('will_rework')}
                        disabled={!replyText.trim()}
                        className="flex-1 py-2 text-xs font-semibold bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-md transition-colors disabled:opacity-50"
                      >
                        Concordar em Refazer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowReplyInput(true)}
                    className="w-full py-2 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-transparent rounded-md transition-colors"
                  >
                    <MessageSquare size={14} /> Responder Feedback
                  </button>
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
          imageUrl={delivery.imageUrl!}
          initialAnnotatedDataUrl={annotatedImage || delivery.annotatedImageUrl}
          onSave={(dataUrl) => {
            setAnnotatedImage(dataUrl);
            setIsFullscreenEditorOpen(false);
          }}
          onClose={() => setIsFullscreenEditorOpen(false)}
        />
      )}

      {/* MODAL: SUBMETER NOVA VERSÃO */}
      {isSubmittingNewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
              <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw size={14} /> Submeter Nova Versão
              </span>
              <button onClick={() => setIsSubmittingNewVersion(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="URL da nova imagem ou cole um print (Ctrl+V)..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onPaste={handlePasteImage}
                className="w-full bg-[#121214] border border-zinc-700/50 rounded-md px-3 py-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50"
              />
              {newImageUrl.startsWith('data:image') && (
                <div className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded border border-zinc-800/50">
                  <span className="text-[10px] text-emerald-400 font-medium">✨ Imagem carregada da área de transferência</span>
                  <img src={newImageUrl} alt="Preview" className="h-8 w-auto rounded ml-auto" />
                </div>
              )}
              <textarea
                placeholder="O que foi alterado nesta versão?"
                value={newDefense}
                onChange={(e) => setNewDefense(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-700/50 rounded-md p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 resize-none min-h-[100px]"
              />
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsSubmittingNewVersion(false)}
                  className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleNewSubmission}
                  disabled={!newImageUrl.trim()}
                  className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded border border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  <Send size={14} /> Enviar para Aprovação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
