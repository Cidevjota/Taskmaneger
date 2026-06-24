import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Delivery, DeliveryThreadMessage } from '../types';
import { Check, X, ChevronLeft, ChevronRight, Info, CornerDownRight, MessageSquarePlus, MousePointer2, Highlighter } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import HtmlDiff from 'htmldiff-js';
import { useAuth } from '../context/AuthContext';

function groupHtmlDiff(html: string): string {
  if (!html) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    function processNode(node: Node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        let children = Array.from(el.childNodes);
        let i = 0;
        
        while (i < children.length) {
          let child = children[i];
          
          let run: Node[] = [];
          let j = i;
          let hasDel = false;
          let hasIns = false;
          
          while (j < children.length) {
            let next = children[j];
            if (next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName === 'DEL') {
              run.push(next);
              hasDel = true;
            } else if (next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName === 'INS') {
              run.push(next);
              hasIns = true;
            } else if (next.nodeType === Node.TEXT_NODE && /^\s+$/.test(next.textContent || '')) {
              run.push(next);
            } else {
              break;
            }
            j++;
          }
          
          const mutCount = run.filter(n => n.nodeType === Node.ELEMENT_NODE).length;
          if (mutCount > 1) {
            let delContent: string[] = [];
            let insContent: string[] = [];
            
            run.forEach(n => {
              if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'DEL') {
                delContent.push((n as HTMLElement).innerHTML);
              } else if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'INS') {
                insContent.push((n as HTMLElement).innerHTML);
              } else if (n.nodeType === Node.TEXT_NODE) {
                if (hasDel) delContent.push(n.textContent || '');
                if (hasIns) insContent.push(n.textContent || '');
              }
            });
            
            const runStart = run[0];
            let newNodes: Node[] = [];
            
            if (hasDel) {
              let newDel = document.createElement('del');
              newDel.className = 'diffmod';
              newDel.innerHTML = delContent.join('').replace(/\s+$/, '') + (hasDel && hasIns ? '' : ' ');
              newNodes.push(newDel);
            }
            if (hasDel && hasIns) {
              newNodes.push(document.createTextNode(' '));
            }
            if (hasIns) {
              let newIns = document.createElement('ins');
              newIns.className = 'diffmod';
              newIns.innerHTML = insContent.join('').replace(/^\s+/, '');
              newNodes.push(newIns);
            }
            
            newNodes.forEach(n => el.insertBefore(n, runStart));
            run.forEach(n => el.removeChild(n));
            
            children = Array.from(el.childNodes);
            i += newNodes.length;
          } else {
            processNode(child);
            i++;
          }
        }
      }
    }
    
    processNode(doc.body);
    return doc.body.innerHTML;
  } catch (e) {
    return html;
  }
}

interface CopyApprovalPanelProps {
  delivery: Delivery;
  currentText?: string;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Delivery>) => void;
}

type ViewMode = 'gestor-rev1' | 'redator-ajuste' | 'gestor-rev2';
type ToolMode = 'cursor' | 'highlighter';
type HighlightColor = 'yellow' | 'pink' | 'green';

// --- SUB-COMPONENTS EXTRACTED FOR PERFORMANCE ---

const colorStyles = {
  yellow: {
    bg: 'rgba(234, 179, 8, 0.4)',
    text: '#fef08a',
    border: 'border-l-yellow-500',
    icon: 'text-yellow-500',
    cardBg: 'bg-yellow-500/5',
    cardBorder: 'border-yellow-500/20'
  },
  pink: {
    bg: 'rgba(236, 72, 153, 0.4)',
    text: '#fbcfe8',
    border: 'border-l-pink-500',
    icon: 'text-pink-500',
    cardBg: 'bg-pink-500/5',
    cardBorder: 'border-pink-500/20'
  },
  green: {
    bg: 'rgba(34, 197, 94, 0.4)',
    text: '#bbf7d0',
    border: 'border-l-green-500',
    icon: 'text-green-500',
    cardBg: 'bg-green-500/5',
    cardBorder: 'border-green-500/20'
  }
};

const CommentCard = ({ id, type, text, editorName, date, snippet, colorCode, onEdit, onDelete, allowResolve, isResolved = false, onResolve }: { id: string, type: 'green' | 'red' | 'neutral', text: string, editorName?: string, date?: string, snippet?: string, colorCode?: string, onEdit?: (id: string, newText: string) => void, onDelete?: (id: string) => void, allowResolve?: boolean, isResolved?: boolean, onResolve?: (id: string, resolved: boolean) => void }) => {
  const color = (colorCode && colorStyles[colorCode as HighlightColor]) ? colorStyles[colorCode as HighlightColor] : colorStyles.yellow;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleSave = () => {
    if (onEdit) onEdit(id, editText);
    setIsEditing(false);
  };
  
  return (
    <div className={`bg-[#1A1A1E] border border-zinc-800/80 rounded-md p-3 flex flex-col gap-2 w-[220px] shadow-sm border-l-2 transition-all duration-300 ${isResolved ? 'opacity-50 grayscale' : ''} ${type === 'green' ? 'border-l-emerald-500' : type === 'red' ? 'border-l-red-500' : color.border}`}>
      <div className="flex items-center justify-between group">
        <span className="text-[10px] font-medium text-zinc-500">{editorName || 'Usuário'} ⬢ {date || '11:56'}</span>
        <div className="flex items-center gap-1">
          {allowResolve && (
            <button 
              onClick={() => onResolve && onResolve(id, !isResolved)} 
              className={`transition-colors ${isResolved ? 'text-emerald-500 scale-110' : 'text-zinc-600 hover:text-emerald-500'}`}
              title="Marcar como resolvido"
            >
              <Check size={14} strokeWidth={isResolved ? 3 : 2} />
            </button>
          )}
          {onEdit && onDelete && type === 'neutral' && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setIsEditing(!isEditing)} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Editar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
              <button onClick={() => onDelete(id)} className="text-zinc-500 hover:text-red-400 transition-colors" title="Excluir">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          )}
        </div>
      </div>
      {snippet && (
        <p className="text-[10px] text-zinc-500 italic line-clamp-2 leading-relaxed">"{snippet}"</p>
      )}
      {isEditing ? (
        <div className="flex flex-col gap-2 mt-1">
          <textarea 
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-[#121214] border border-zinc-700 rounded p-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-500 resize-y min-h-[60px]"
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <button onClick={() => { setIsEditing(false); setEditText(text); }} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] text-zinc-300">Cancelar</button>
            <button onClick={handleSave} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors">Salvar</button>
          </div>
        </div>
      ) : (
        <p className={`text-[11px] leading-normal transition-colors ${isResolved ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{text}</p>
      )}
    </div>
  );
};

const DynamicDocument = ({ submission, tempHtml, feedbacks, revNum, isCompact, isInteractive, toolMode, onEditFeedback, onDeleteFeedback, allowResolve, onResolveFeedback, hideAnnotations }: { submission: DeliveryThreadMessage | null, tempHtml?: string, feedbacks: DeliveryThreadMessage[], revNum: number, isCompact?: boolean, isInteractive?: boolean, toolMode?: ToolMode, onEditFeedback?: (id: string, text: string) => void, onDeleteFeedback?: (id: string) => void, allowResolve?: boolean, onResolveFeedback?: (id: string, resolved: boolean) => void, hideAnnotations?: boolean }) => {
  if (!submission) return <div className="text-zinc-500 italic p-4 text-xs">Nenhum documento anterior encontrado.</div>;
  
  const contentToRender = tempHtml || submission.copyText || '<p className="italic text-zinc-500">Sem conteúdo.</p>';
  
  const resolvedIds = feedbacks.filter(f => f.resolved).map(f => f.annotatedImageUrl?.split('|')[0]).filter(Boolean);

  return (
    <div className={`flex flex-col gap-6 text-zinc-300 font-sans leading-loose relative mt-4 ${isCompact ? 'text-xs w-full pr-4' : 'text-sm w-full max-w-[480px] mx-auto pr-12 pl-4'}`}>
      {hideAnnotations && (
        <style>{`
          mark { background-color: transparent !important; padding: 0 !important; text-decoration: underline !important; }
        `}</style>
      )}
      {resolvedIds.length > 0 && (
        <style>{`
          ${resolvedIds.map(id => `mark[data-comment-id="${id}"] { background-color: transparent !important; padding: 0 !important; text-decoration: underline !important; }`).join('\\n')}
        `}</style>
      )}
      <div>
        <span className={`text-[10px] font-bold ${revNum > 1 ? 'text-pink-500' : 'text-zinc-500'} uppercase tracking-wide mb-4 block`}>
          REVISÒO {revNum}
        </span>
        <div 
          id={isInteractive ? 'copy-document-container' : undefined}
          className={`copy-content [&>p]:mb-4 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-white [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 transition-colors ${toolMode === 'highlighter' ? 'cursor-crosshair selection:bg-yellow-500/30' : 'cursor-text'}`}
          dangerouslySetInnerHTML={{ __html: contentToRender }}
        />
      </div>

      {feedbacks.length > 0 && (
        <div className={`absolute top-0 flex flex-col gap-4 ${isCompact ? 'right-[-220px] scale-90 origin-top-left' : 'right-[-240px]'}`}>
          {feedbacks.map(f => {
            const colorCode = f.annotatedImageUrl?.split('|')[1] || 'yellow';
            return (
              <CommentCard 
                key={f.id}
                id={f.id}
                type={f.action === 'approved' ? 'green' : f.action === 'rejected' ? 'red' : 'neutral'}
                text={f.content}
                editorName={f.editorName || 'Usuário'}
                date={new Date(f.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')}
                snippet={f.copyText} 
                colorCode={colorCode}
                onEdit={onEditFeedback}
                onDelete={onDeleteFeedback}
                allowResolve={allowResolve}
                isResolved={f.resolved}
                onResolve={onResolveFeedback}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

export default function CopyApprovalPanel({ delivery, currentText, onClose, onUpdate }: CopyApprovalPanelProps) {
  const { currentUser } = useAuth();
  const [newDefense, setNewDefense] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Tool State
  const [toolMode, setToolMode] = useState<ToolMode>('cursor');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [showPastComments, setShowPastComments] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

  // Highlighting State
  const [draftHighlight, setDraftHighlight] = useState<{
    id: string;
    snippet: string;
    htmlContent: string;
    color: HighlightColor;
  } | null>(null);
  const [draftCommentText, setDraftCommentText] = useState('');

  // Redator Editor State
  const [draftText, setDraftText] = useState('');

  let viewMode: ViewMode = 'gestor-rev1';
  if (delivery.status === 'reworking') {
    viewMode = 'redator-ajuste';
  } else if (delivery.status === 'review_requested' || delivery.status === 'approved' || delivery.status === 'rejected') {
    if (delivery.thread.filter(t => t.type === 'submission').length > 1) {
      viewMode = 'gestor-rev2';
    } else {
      viewMode = 'gestor-rev1';
    }
  }

  const submissions = delivery.thread?.filter(t => t.type === 'submission') || [];
  const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;
  const previousSubmission = submissions.length > 1 ? submissions[submissions.length - 2] : null;
  const allFeedbacks = delivery.thread?.filter(t => t.type === 'feedback') || [];
  
  const creativeDefense = latestSubmission?.content || 'Nenhuma defesa criativa fornecida.';
  const revisionNumber = submissions.length;

  const rejectionFeedback = [...allFeedbacks].reverse().find(f => f.action === 'rejected');
  const contentFeedbacks = allFeedbacks.filter(f => !f.action);

  const pastFeedbacks = latestSubmission ? contentFeedbacks.filter(f => new Date(f.createdAt) < new Date(latestSubmission.createdAt)) : contentFeedbacks;
  const currentFeedbacks = latestSubmission ? contentFeedbacks.filter(f => new Date(f.createdAt) >= new Date(latestSubmission.createdAt)) : contentFeedbacks;

  useEffect(() => {
    if (viewMode === 'redator-ajuste' && latestSubmission) {
      if (!draftText) {
        setDraftText(latestSubmission.copyText.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1'));
      }
    }
  }, [viewMode, latestSubmission, draftText]);

  // Auto-highlight when in highlighter mode
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      // If we are evaluating the copy and in highlighter mode
      if (viewMode === 'redator-ajuste' || toolMode !== 'highlighter') return;
      if (draftHighlight) return; // Wait until current draft is saved or cancelled
      
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
        return;
      }

      // Check if the selection is inside the document container
      const container = document.getElementById('copy-document-container');
      if (container && container.contains(selection.anchorNode) && container.contains(selection.focusNode)) {
        
        const liveRange = selection.getRangeAt(0);
        const selectedText = selection.toString();
        
        // Prevent highlighting huge chunks accidentally
        if (selectedText.length > 500) {
          alert("Por favor, selecione trechos mais curtos para comentar.");
          selection.removeAllRanges();
          return;
        }

        const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const markNode = document.createElement('mark');
        
        const colorStyle = colorStyles[selectedColor];
        markNode.style.backgroundColor = colorStyle.bg;
        markNode.style.color = colorStyle.text;
        markNode.style.borderRadius = "2px";
        markNode.style.padding = "2px 4px";
        markNode.className = "cursor-pointer transition-colors";
        markNode.dataset.commentId = id;

        try {
          // A safer alternative to surroundContents that works perfectly for standard text selection
          const extractedContents = liveRange.extractContents();
          markNode.appendChild(extractedContents);
          liveRange.insertNode(markNode);

          const newHtml = container?.innerHTML || latestSubmission?.copyText || '';
          
          setDraftHighlight({
            id,
            snippet: selectedText,
            htmlContent: newHtml,
            color: selectedColor
          });
          
          selection.removeAllRanges();
        } catch (err) {
          alert("A seleção cruzou fronteiras complexas. Selecione o texto dentro do mesmo parágrafo.");
          selection.removeAllRanges();
        }
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [viewMode, toolMode, selectedColor, draftHighlight, latestSubmission]);

  const submitDraftComment = () => {
    if (!draftHighlight || !latestSubmission) return;

    const newFeedback: DeliveryThreadMessage = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      role: 'manager',
      type: 'feedback',
      action: undefined, // Just a comment
      content: draftCommentText,
      copyText: draftHighlight.snippet, 
      annotatedImageUrl: `${draftHighlight.id}|${draftHighlight.color}`, // store marker id and color
      editorName: currentUser?.name || 'Gestor',
      createdAt: new Date().toISOString()
    };

    const updatedSubmission = { ...latestSubmission, copyText: draftHighlight.htmlContent };
    
    onUpdate(delivery.id, {
      thread: delivery.thread.map(t => t.id === latestSubmission.id ? updatedSubmission : t).concat(newFeedback)
    });

    setDraftHighlight(null);
    setDraftCommentText('');
    setToolMode('cursor'); // Auto-revert to cursor after commenting
  };

  const handleEditFeedback = (feedbackId: string, newText: string) => {
    onUpdate(delivery.id, {
      thread: delivery.thread.map(t => t.id === feedbackId ? { ...t, content: newText } : t)
    });
  };

  const handleDeleteFeedback = (feedbackId: string) => {
    const feedbackToDelete = delivery.thread.find(t => t.id === feedbackId);
    if (!feedbackToDelete || !latestSubmission) return;

    // Se tivermos um snippet grifado e formos deletar, precisamos tentar limpar a tag <mark> do documento atual
    let updatedCopyText = latestSubmission.copyText;
    if (feedbackToDelete.annotatedImageUrl) {
      const markerId = feedbackToDelete.annotatedImageUrl.split('|')[0];
      // Regex para encontrar a tag mark com esse data-comment-id e extrair o seu miolo (grupo 2)
      const regex = new RegExp(`<mark[^>]*data-comment-id="${markerId}"[^>]*>([\\s\\S]*?)<\\/mark>`, 'gi');
      updatedCopyText = updatedCopyText.replace(regex, '$1');
    }

    const updatedSubmission = { ...latestSubmission, copyText: updatedCopyText };

    onUpdate(delivery.id, {
      thread: delivery.thread.filter(t => t.id !== feedbackId).map(t => t.id === latestSubmission.id ? updatedSubmission : t)
    });
  };

  const cancelDraftComment = () => {
    setDraftHighlight(null);
    setDraftCommentText('');
  };

  const handleApprove = () => {
    const newFeedback: DeliveryThreadMessage = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      role: 'manager',
      type: 'feedback',
      action: 'approved',
      content: 'Copy aprovada com sucesso!',
      editorName: currentUser?.name || 'Gestor',
      createdAt: new Date().toISOString()
    };
    onUpdate(delivery.id, { 
      status: 'approved',
      thread: [...delivery.thread, newFeedback]
    });
    onClose();
  };

  const handleReject = () => {
    if (!isRejecting) {
      setIsRejecting(true);
      return;
    }
    const newFeedback: DeliveryThreadMessage = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      role: 'manager',
      type: 'feedback',
      action: 'rejected',
      content: rejectReason || 'Necessita ajustes.',
      editorName: currentUser?.name || 'Gestor',
      createdAt: new Date().toISOString()
    };
    onUpdate(delivery.id, { 
      status: 'reworking',
      thread: [...delivery.thread, newFeedback]
    });
    setIsRejecting(false);
  };

  const handleReenviar = () => {
    try {
      const newSubmission: DeliveryThreadMessage = {
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        role: 'designer',
        type: 'submission',
        content: newDefense || 'Ajustes realizados',
        copyText: draftText,
        editorName: currentUser?.name || latestSubmission?.editorName || 'Redator',
        createdAt: new Date().toISOString()
      };
      onUpdate(delivery.id, { 
        status: 'review_requested',
        thread: [...delivery.thread, newSubmission]
      });
      onClose();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao reenviar: " + e.message);
    }
  };

  const handleResolveFeedback = (id: string, resolved: boolean) => {
    const newThread = delivery.thread.map(f => f.id === id ? { ...f, resolved } : f);
    onUpdate(delivery.id, { thread: newThread });
  };

  const renderTimeline = () => {
    const events: any[] = [];
    let pendingVistos: any[] = [];

    delivery.thread.forEach((t) => {
      if (t.type === 'submission') {
        events.push({ id: t.id, original: t, statusText: 'Enviado para aprovação', isSecondary: false, color: 'pink' });
        pendingVistos = [];
      } else if (t.type === 'feedback') {
        if (t.action === 'approved') {
          events.push({ id: t.id, original: t, statusText: 'Aprovado', isSecondary: false, color: 'emerald' });
          events.push(...pendingVistos);
          pendingVistos = [];
        } else if (t.action === 'rejected') {
          events.push({ id: t.id, original: t, statusText: 'Reprovado', isSecondary: false, color: 'red' });
          events.push(...pendingVistos);
          pendingVistos = [];
        } else {
          events.push({ id: t.id, original: t, statusText: 'Anotação adicionada', isSecondary: true, color: 'zinc' });
          if (t.resolved) {
            pendingVistos.push({ id: t.id + '-visto', original: t, statusText: 'Visto nos comentários', isSecondary: true, color: 'zinc' });
          }
        }
      }
    });

    events.push(...pendingVistos);

    return (
      <div className="flex flex-col gap-6 relative ml-1">
        <div className="absolute top-2 left-[3px] bottom-2 w-[1px] bg-zinc-800" />
        
        {events.map((ev, index) => {
          const t = ev.original;
          const isLast = index === events.length - 1;
          let iconColor = 'bg-zinc-600';
          let textColor = 'text-zinc-500';
          let bulletSize = 'w-2 h-2';
          
          if (!ev.isSecondary) {
             bulletSize = 'w-3 h-3 -ml-[2px]';
             iconColor = 'bg-pink-400';
             textColor = 'text-pink-400';
          }

          if (isLast && !ev.isSecondary) {
             iconColor = 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.4)]';
          }

          return (
            <div key={ev.id} className="relative flex items-start gap-3 z-10">
              <div className={`${bulletSize} rounded-full ${iconColor} mt-1.5 shrink-0`} />
              <div className="flex flex-col gap-0.5">
                <span className={`text-xs font-medium ${ev.isSecondary ? 'text-zinc-400' : textColor}`}>{ev.statusText}</span>
                <span className={`text-[10px] text-zinc-500 uppercase mt-0.5`}>
                  {t.editorName || 'Usuário'} ⬢ {new Date(t.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const draftColorStyles = draftHighlight ? colorStyles[draftHighlight.color] : colorStyles.yellow;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#121214] text-zinc-200 overflow-hidden font-sans">
      
      <div className="flex-1 flex overflow-hidden">

        
        {/* COLUNA: CENTRO (Flex) - Documento */}
        <div className="flex-1 flex flex-col bg-[#121214] overflow-hidden relative">
          <div className="p-4 border-b border-zinc-800/50 h-[60px] flex items-center justify-between shrink-0">
            <button onClick={onClose} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-xs font-medium tracking-wide transition-colors">
              <ChevronLeft size={14} /> VOLTAR
            </button>
            
            {/* TOOLBAR CENTRAL */}
            {viewMode !== 'redator-ajuste' && (
              <div className="flex items-center gap-1 bg-[#1C1C21] border border-zinc-800/50 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => setToolMode('cursor')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${toolMode === 'cursor' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  title="Modo Cursor (Selecionar e Copiar texto normalmente)"
                >
                  <MousePointer2 size={14} /> Cursor
                </button>
                <div className="w-px h-4 bg-zinc-800 mx-1" />
                <button
                  onClick={() => setToolMode('highlighter')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${toolMode === 'highlighter' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  title="Modo Marcador (Grifar trechos e adicionar comentários)"
                >
                  <Highlighter size={14} className={toolMode === 'highlighter' ? colorStyles[selectedColor].icon : ''} /> Marcador
                </button>
                
                {toolMode === 'highlighter' && (
                  <div className="flex items-center gap-1 ml-2 pl-2 border-l border-zinc-800">
                    <button onClick={() => setSelectedColor('yellow')} className={`w-5 h-5 rounded-full transition-transform ${selectedColor === 'yellow' ? 'scale-110 ring-2 ring-yellow-500/50 ring-offset-1 ring-offset-[#1C1C21]' : 'opacity-50 hover:opacity-100'} bg-yellow-500`} title="Amarelo (Atenção)" />
                    <button onClick={() => setSelectedColor('pink')} className={`w-5 h-5 rounded-full transition-transform ${selectedColor === 'pink' ? 'scale-110 ring-2 ring-pink-500/50 ring-offset-1 ring-offset-[#1C1C21]' : 'opacity-50 hover:opacity-100'} bg-pink-500`} title="Rosa (Problema)" />
                    <button onClick={() => setSelectedColor('green')} className={`w-5 h-5 rounded-full transition-transform ${selectedColor === 'green' ? 'scale-110 ring-2 ring-green-500/50 ring-offset-1 ring-offset-[#1C1C21]' : 'opacity-50 hover:opacity-100'} bg-green-500`} title="Verde (Sugestão)" />
                  </div>
                )}
              </div>
            )}
            
            <div className="w-20" /> {/* Spacer */}
          </div>
          <div className="flex-1 overflow-y-auto p-8 relative">
            
            {viewMode === 'gestor-rev1' && (
              <DynamicDocument 
                submission={latestSubmission} 
                tempHtml={draftHighlight?.htmlContent} 
                feedbacks={contentFeedbacks} 
                revNum={1} 
                isInteractive 
                toolMode={toolMode}
                onEditFeedback={handleEditFeedback}
                onDeleteFeedback={handleDeleteFeedback}
              />
            )}
            
            {viewMode === 'redator-ajuste' && (
              <div className="flex w-full max-w-[1400px] mx-auto h-full px-4 relative transition-all duration-300">
                <div className={`${isLeftCollapsed ? 'w-16' : (showPastComments ? 'w-[55%] pr-[240px]' : 'w-[45%] pr-8')} border-r border-zinc-800/30 relative overflow-y-auto transition-all duration-300`}>
                  {isLeftCollapsed ? (
                    <div className="flex flex-col items-center pt-4">
                      <button onClick={() => setIsLeftCollapsed(false)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded transition-colors" title="Expandir Anotações">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-zinc-500 uppercase">Antes (Com Anotações)</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowPastComments(!showPastComments)} className="text-[10px] font-medium text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700 px-2 py-1 rounded">
                            {showPastComments ? 'Ocultar Anotações' : 'Mostrar Anotações'}
                          </button>
                          <button onClick={() => setIsLeftCollapsed(true)} className="p-1 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded transition-colors" title="Recolher Coluna">
                            <ChevronLeft size={16} />
                          </button>
                        </div>
                      </div>
                      <DynamicDocument 
                        submission={latestSubmission} 
                        feedbacks={showPastComments ? contentFeedbacks : []} 
                        revNum={revisionNumber} 
                        isCompact 
                        allowResolve 
                        onResolveFeedback={handleResolveFeedback} 
                        hideAnnotations={!showPastComments}
                      />
                    </>
                  )}
                </div>
                <div className={`${isLeftCollapsed || !showPastComments ? 'flex-1 pl-8' : 'w-[45%] pl-8'} relative flex flex-col overflow-hidden transition-all duration-300`}>
                  <div className="mb-4 text-[10px] font-medium text-pink-500 uppercase shrink-0">
                    Edição: Revisão {revisionNumber + 1}
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col mb-8 relative">
                    {draftText ? (
                      <RichTextEditor 
                        taskId={delivery.id} 
                        content={draftText} 
                        onChange={setDraftText} 
                        variant="borderless" 
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                        Carregando editor...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {viewMode === 'gestor-rev2' && (
              <div className="flex w-full max-w-[1400px] mx-auto h-full px-4 relative transition-all duration-300">
                <div className={`${isLeftCollapsed ? 'w-16' : (showPastComments ? 'w-[55%] pr-[240px]' : 'w-[45%] pr-8')} border-r border-zinc-800/30 relative overflow-y-auto transition-all duration-300`}>
                  {isLeftCollapsed ? (
                    <div className="flex flex-col items-center pt-4">
                      <button onClick={() => setIsLeftCollapsed(false)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded transition-colors" title="Expandir Revisão Anterior">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-zinc-500 uppercase">Revisão Anterior (Com Anotações e Diff)</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowPastComments(!showPastComments)} className="text-[10px] font-medium text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700 px-2 py-1 rounded">
                            {showPastComments ? 'Ocultar Anotações' : 'Mostrar Anotações'}
                          </button>
                          <button onClick={() => setIsLeftCollapsed(true)} className="p-1 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded transition-colors" title="Recolher Coluna">
                            <ChevronLeft size={16} />
                          </button>
                        </div>
                      </div>
                      <DynamicDocument 
                        submission={previousSubmission} 
                        tempHtml={groupHtmlDiff(HtmlDiff.execute(previousSubmission?.copyText || '', latestSubmission?.copyText || ''))} 
                        feedbacks={showPastComments ? pastFeedbacks : []} 
                        revNum={revisionNumber > 1 ? revisionNumber - 1 : 1} 
                        isCompact 
                        hideAnnotations={!showPastComments}
                      />
                    </>
                  )}
                </div>
                <div className={`${isLeftCollapsed || !showPastComments ? 'flex-1 pl-8 pr-[240px]' : 'w-[45%] pl-8 pr-[240px]'} relative flex flex-col overflow-y-auto transition-all duration-300`}>
                  <div className="mb-4 text-[10px] font-medium text-emerald-500 uppercase shrink-0 text-left max-w-[480px] w-full mx-auto pl-4">
                    Nova Revisão Atual
                  </div>
                  <DynamicDocument 
                    submission={latestSubmission} 
                    tempHtml={draftHighlight?.htmlContent} 
                    feedbacks={currentFeedbacks} 
                    revNum={revisionNumber} 
                    isInteractive 
                    toolMode={toolMode}
                    onEditFeedback={handleEditFeedback}
                    onDeleteFeedback={handleDeleteFeedback}
                  />
                </div>
              </div>
            )}</div>
        </div>

        {/* COLUNA 3: DIREITA (320px) - Painel de Controle */}
        <div className="w-[320px] shrink-0 border-l border-zinc-800/50 bg-[#121214] flex flex-col">
          <div className="p-4 border-b border-zinc-800/50 h-[60px] flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Controle de Aprovação</span>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">REV {revisionNumber}</span>
          </div>
          
          <div className="p-5 flex flex-col gap-8 flex-1 overflow-y-auto">

            {/* DRAFT COMMENT SECTION */}
            {draftHighlight && (
              <div className={`flex flex-col gap-3 p-4 ${draftColorStyles.cardBg} border ${draftColorStyles.cardBorder} rounded-lg animate-fade-in`}>
                <span className={`text-[10px] font-bold ${draftColorStyles.icon} uppercase tracking-wide flex items-center gap-1.5`}>
                  <MessageSquarePlus size={12} /> Nova Anotação
                </span>
                <p className="text-[10px] text-zinc-500 italic leading-relaxed">"{draftHighlight.snippet}"</p>
                <textarea 
                  value={draftCommentText}
                  onChange={e => setDraftCommentText(e.target.value)}
                  autoFocus
                  className={`bg-[#1C1C21] border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 min-h-[80px] outline-none focus:${draftColorStyles.border.replace('border-l-','border-')}/50 resize-y mt-1`}
                  placeholder="Seu feedback sobre este trecho..."
                />
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={cancelDraftComment} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-1.5 px-3 rounded-md transition-colors text-[10px]">
                    Cancelar
                  </button>
                  <button onClick={submitDraftComment} disabled={!draftCommentText} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-1.5 px-3 rounded-md transition-colors text-[10px] disabled:opacity-50 disabled:cursor-not-allowed">
                    Salvar Anotação
                  </button>
                </div>
              </div>
            )}
            
            {/* DEFESA CRIATIVA / MOTIVO REPROVA�!ÒO */}
            {!draftHighlight && (
              viewMode === 'redator-ajuste' && rejectionFeedback ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">
                    Motivo da Reprovação Geral
                  </span>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3 text-xs text-red-200 leading-relaxed shadow-sm border-l-2 border-l-red-500">
                    {rejectionFeedback.content}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                    Defesa Criativa
                  </span>
                  <div className="bg-[#1C1C21] border border-white/5 rounded-md p-3 text-xs text-zinc-300 leading-relaxed shadow-inner">
                    {creativeDefense}
                  </div>
                </div>
              )
            )}
            
            <div className="w-full h-px bg-zinc-800/50" />

            {/* A�!�"ES DE VOTO */}
            {!draftHighlight && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Ações Finais</span>
                
                {viewMode === 'redator-ajuste' ? (
                  <div className="flex flex-col gap-3">
                    <textarea 
                      value={newDefense}
                      onChange={e => setNewDefense(e.target.value)}
                      className="bg-[#1C1C21] border border-zinc-800 rounded-md p-3 text-xs text-zinc-200 min-h-[100px] outline-none focus:border-pink-500/50 resize-y"
                      placeholder="Sua defesa criativa para as novas alterações..."
                    />
                    <button onClick={handleReenviar} className="w-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-md border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors">
                      Reenviar para Aprovação
                    </button>
                  </div>
                ) : delivery.status === 'approved' ? (
                  <div className="text-xs text-emerald-500 font-medium bg-emerald-500/10 px-4 py-3 rounded-md border border-emerald-500/20 text-center">
                    Copy Aprovada
                  </div>
                ) : delivery.status === 'rejected' ? (
                  <div className="text-xs text-red-500 font-medium bg-red-500/10 px-4 py-3 rounded-md border border-red-500/20 text-center">
                    Copy Reprovada
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {isRejecting ? (
                      <div className="flex flex-col gap-2">
                        <textarea 
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          className="bg-[#1C1C21] border border-red-900/50 rounded-md p-3 text-xs text-zinc-200 min-h-[80px] outline-none focus:border-red-500/50 resize-y"
                          placeholder="Motivo final da reprovação..."
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={() => setIsRejecting(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 px-3 rounded-md transition-colors text-[11px]">
                            Cancelar
                          </button>
                          <button onClick={handleReject} disabled={!rejectReason} className="flex-1 py-2 px-3 text-[11px] font-bold uppercase tracking-wider rounded-md border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50">
                            Reprovar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] text-zinc-500 mb-1 leading-relaxed">
                          Dica: Ative o <b>Modo Marcador</b> no topo da tela para grifar textos antes de aprovar ou reprovar.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={handleApprove} className="flex-1 py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-md border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors shadow-lg">
                            Aprovar
                          </button>
                          <button onClick={handleReject} className="flex-1 bg-red-950/20 border border-red-900 text-red-400 hover:bg-red-900/30 font-medium py-2.5 px-4 rounded-md transition-colors text-xs">
                            Reprovar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="w-full h-px bg-zinc-800/50" />

            {/* STATUS E TIMELINE */}
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-2 block">Status</span>
                <div className="text-sm font-medium text-pink-500">
                  {delivery.status === 'review_requested' ? 'Aguardando avaliação' : delivery.status === 'reworking' ? 'Em Ajustes' : delivery.status === 'approved' ? 'Aprovado' : delivery.status === 'rejected' ? 'Reprovado' : 'Pendente'}
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Linha do Tempo</span>
                {renderTimeline()}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
