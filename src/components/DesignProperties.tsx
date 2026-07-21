import React, { useState, useEffect } from 'react';
import { Task, DesignBriefing } from '../types';
import { Edit2, Check, ChevronDown, ChevronUp, Plus, X, ExternalLink } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import DeliveryApproval from './DeliveryApproval';
import DeliveryForm from './DeliveryForm';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchTaskBriefings } from '../lib/api';
import { uploadDeliveryImages } from '../lib/deliveryImages';
import { useSyncManager } from '../lib/SyncManager';

interface DesignPropertiesProps {
  task: Task;
  allTasks?: Task[];
  saveChange: (updates: Partial<Task>) => void;
  themeColor?: string;
  disabled?: boolean;
  /** Briefing columns still loading from the DB — creatives are not known yet. */
  briefingsLoading?: boolean;
}

const OBJETIVOS_OPTIONS = [
  'Gerar Leads', 'Gerar Interesse', 'Visitas ao stand', 'Apresentação institucional',
  'Lançamento de Produto', 'Engajamento', 'Reforço de marca', 'Convidar',
  'Divulgar Promoção', 'Comunicado'
];

const TIPO_PECA_OPTIONS = [
  'Feed', 'Stories', 'Banner site', 'Vídeo', 'Landing page',
  'Cartão', 'Impresso', 'E-mail marketing', 'Apresentação', 'Anúncio Meta', 'Anúncio Google'
];

const FORMATOS_DINAMICOS: Record<string, string[]> = {
  "Feed": [
    "1:1 (Quadrado) - 1080x1080px",
    "4:5 (Retrato) - 1080x1350px",
    "16:9 (Paisagem) - 1080x566px",
    "Personalizado"
  ],
  "Stories": [
    "9:16 (Vertical) - 1080x1920px",
    "Personalizado"
  ],
  "Cartão": [
    "Físico Padrão - 9x5cm",
    "Físico Europeu - 8.5x5.5cm",
    "Digital Interativo - 1080x1920px",
    "Personalizado"
  ],
  "Anúncio Meta": [
    "Feed/Carrossel (1:1) - 1080x1080px",
    "Feed Vídeo/Imagem (4:5) - 1080x1350px",
    "Stories/Reels/Audience Network (9:16) - 1080x1920px",
    "Resultados de Pesquisa/In-Stream (1.91:1) - 1200x628px",
    "Personalizado"
  ],
  "Anúncio Google": [
    "Retângulo Médio - 300x250px",
    "Retângulo Grande - 336x280px",
    "Leaderboard - 728x90px",
    "Leaderboard para celular - 320x50px",
    "Arranha-céu Largo - 160x600px",
    "Arranha-céu Inteligente - 300x600px",
    "Outdoor - 970x250px",
    "Banner para Vídeo (YouTube) - 300x60px",
    "Quadrado Padrão - 250x250px",
    "Personalizado"
  ],
  "Banner site": [
    "Hero Desktop - 1920x1080px",
    "Mobile - 360x640px",
    "Personalizado"
  ],
  "Landing page": [
    "Hero Desktop - 1920x1080px",
    "Mobile - 360x640px",
    "Personalizado"
  ],
  "Vídeo": [
    "Quadrado (1:1) - 1080x1080px",
    "Vertical (9:16) - 1080x1920px",
    "Paisagem (16:9) - 1920x1080px",
    "Stories/Reels (9:16) - 1080x1920px",
    "YouTube (16:9) - 1920x1080px",
    "Personalizado"
  ],
  "Impresso": [
    "A4 - 210x297mm",
    "A3 - 297x420mm",
    "A5 - 148x210mm",
    "Flyer - 150x210mm",
    "Banner Roll-up - 800x2000mm",
    "Outdoor - 9000x3000mm",
    "Personalizado"
  ],
  "E-mail marketing": [
    "Desktop - 600px de largura",
    "Mobile - 320px de largura",
    "Personalizado"
  ]
};

// Pieces that support focus direction (mobile first / desktop first)
const DIRECAO_FOCO_PIECES = ['Landing page', 'E-mail marketing', 'Banner site'];

const DIRECAO_FOCO_OPTIONS = [
  'Mobile First', 'Desktop First', 'Responsivo (ambos)', 'App'
];

const DIRECAO_CRIATIVA_OPTIONS = [
  'Institucional', 'Corporativo', 'Sofisticado', 'Luxo', 'Imponente', 'Lifestyle',
  'Aspiracional', 'Familiar', 'Comercial', 'Conversão', 'Oferta', 'Urgência',
  'Visual Leve', 'Técnico', 'Chamativo', 'Dramático'
];

type TabId = 'copy' | 'aprovacao';

export default function DesignProperties({ task, allTasks = [], saveChange, themeColor = 'text-blue-500', disabled = false, briefingsLoading = false }: DesignPropertiesProps) {
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isCopyEditorVisible, setIsCopyEditorVisible] = useState(!!task.designBriefing?.copyContent);
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(false);
  const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
  const { allUsers: USERS, currentUser } = useAuth();
  const { getPendingField, saveImmediately } = useSyncManager();
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);
  const [deliverySaveError, setDeliverySaveError] = useState<string | null>(null);
  const sortedUsers = currentUser
    ? [currentUser, ...USERS.filter(u => u.id !== currentUser.id)]
    : USERS;
  const { addNotification } = useNotifications();
  const [briefingForm, setBriefingForm] = useState<DesignBriefing>(task.designBriefing || {
    isFilled: false,
    objetivos: [],
    tipoPeca: [],
    formatosEspecificos: {},
    formatosPersonalizados: {},
    mensagemPrincipal: '',
    direcaoCriativa: [],
    direcaoFoco: [],
    inspiracoes: [''],
    copyContent: '',
    copyEditors: []
  });

  const normalizedEditors = briefingForm.copyEditors?.length 
    ? briefingForm.copyEditors 
    : (briefingForm.copyContent ? [{ id: 'legacy-copy', name: 'Copy', content: briefingForm.copyContent }] : []);

  const [activeEditorId, setActiveEditorId] = useState<string | null>(normalizedEditors[0]?.id || null);
  const [editingTabNameId, setEditingTabNameId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEditorId && normalizedEditors.length > 0) {
      setActiveEditorId(normalizedEditors[0].id);
    }
  }, [normalizedEditors.length, activeEditorId]);

  useEffect(() => {
    if (task) {
      setBriefingForm(task.designBriefing || {
        isFilled: false,
        objetivos: [],
        tipoPeca: [],
        formatosEspecificos: {},
        formatosPersonalizados: {},
        mensagemPrincipal: '',
        direcaoCriativa: [],
        direcaoFoco: [],
        inspiracoes: [''],
        copyContent: '',
        copyEditors: task.designBriefing?.copyEditors || []
      });
      setIsEditing(false);
      setIsCopyEditorVisible(!!task.designBriefing?.copyContent || (task.designBriefing?.copyEditors || []).length > 0);
    }
  }, [task.id, task.designBriefing, disabled]);

  useEffect(() => {
    const handleOpenSection = (e: CustomEvent<{ section: string, targetId?: string }>) => {
    };
    window.addEventListener('openTaskSection', handleOpenSection as EventListener);
    return () => window.removeEventListener('openTaskSection', handleOpenSection as EventListener);
  }, []);

  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) return array.filter(i => i !== item);
    return [...array, item];
  };

  // Re-fetches the latest designBriefing from the server and applies only the
  // fields the recipe intends to change, so a save from this (possibly stale)
  // screen never clobbers deliveries/fields that changed elsewhere meanwhile.
  const saveDesignBriefing = async (
    recipe: (base: DesignBriefing) => { partial: Partial<DesignBriefing>; taskUpdates?: Partial<Task> }
  ) => {
    let base: DesignBriefing = briefingForm;
    try {
      const fresh = await fetchTaskBriefings(task.id);
      if (fresh?.designBriefing) base = fresh.designBriefing;
    } catch {
      // If the refetch fails, fall back to local state rather than blocking the save.
    }
    // A previous saveDesignBriefing call may still be sitting in SyncManager's
    // debounce queue, not yet flushed to the DB. If we based this save purely on
    // the DB SELECT above, it would be stale and this save would overwrite that
    // pending write when it flushes (dropping whatever it added, e.g. a delivery).
    const pending = getPendingField(task.id, 'designBriefing');
    if (pending) base = pending;
    const { partial, taskUpdates } = recipe(base);
    const merged = { ...base, ...partial };
    setBriefingForm(merged);
    saveChange({ designBriefing: merged, ...(taskUpdates || {}) });
    return merged;
  };

  // Used for delivery (creative) changes: approval, rejection, and new
  // submissions all hinge on this actually landing in the DB, so unlike
  // saveDesignBriefing this awaits the real write and only calls `notify`
  // (used to fire approval notifications) after it succeeds. This closes the
  // window where a notification was sent for a creative that was still
  // sitting in a debounced, not-yet-persisted save.
  const saveDeliveryChange = async (
    recipe: (base: DesignBriefing) => { partial: Partial<DesignBriefing>; taskUpdates?: Partial<Task>; notify?: () => void }
  ): Promise<boolean> => {
    let base: DesignBriefing = briefingForm;
    try {
      const fresh = await fetchTaskBriefings(task.id);
      if (fresh?.designBriefing) base = fresh.designBriefing;
    } catch {
      // If the refetch fails, fall back to local state rather than blocking the save.
    }
    const pending = getPendingField(task.id, 'designBriefing');
    if (pending) base = pending;

    const { partial, taskUpdates, notify } = recipe(base);

    setIsSavingDelivery(true);
    setDeliverySaveError(null);
    try {
      // Pasted screenshots and rejection annotations come in as base64 data URLs.
      // Push them to Storage first so the briefing column only ever stores links —
      // otherwise it grows to megabytes and stalls the approval screen on open.
      const deliveries = await uploadDeliveryImages(task.id, partial.deliveries);
      const merged = { ...base, ...partial, ...(deliveries ? { deliveries } : {}) };

      await saveImmediately(task.id, { designBriefing: merged, ...(taskUpdates || {}) });
      setBriefingForm(merged);
      notify?.();
      return true;
    } catch (err) {
      console.error('Failed to save delivery change:', err);
      setDeliverySaveError('Falha ao salvar. Verifique sua conexão e tente novamente.');
      return false;
    } finally {
      setIsSavingDelivery(false);
    }
  };

  const handleSaveBriefing = () => {
    setIsEditing(false);
    const { deliveries, ...briefingFields } = briefingForm;
    saveDesignBriefing(() => ({ partial: { ...briefingFields, isFilled: true } }));
  };

  useEffect(() => {
    if (!task) return;
    if (JSON.stringify(briefingForm.copyEditors) === JSON.stringify(task.designBriefing?.copyEditors) &&
        briefingForm.copyContent === task.designBriefing?.copyContent) return;
    const timer = setTimeout(() => {
      saveDesignBriefing(() => ({ 
        partial: { 
          copyContent: briefingForm.copyContent,
          copyEditors: briefingForm.copyEditors 
        } 
      }));
    }, 800);
    return () => clearTimeout(timer);
  }, [briefingForm.copyContent, briefingForm.copyEditors]);

  const relatedCopyTasks = React.useMemo(() => {
    return allTasks.filter(t => 
      t.labels.some(l => l.name === 'Copy') && (
        t.parentTaskId === task.id || 
        (task.parentTaskId && t.id === task.parentTaskId)
      )
    );
  }, [allTasks, task]);

  const approvedCopies = React.useMemo(() => {
    const copies: { taskId: string; editorId: string; content: string; title: string }[] = [];
    relatedCopyTasks.forEach(ct => {
      if (ct.copyBriefing?.copyEditors) {
        ct.copyBriefing.copyEditors.forEach(editor => {
          if (editor.content) {
             copies.push({
               taskId: ct.id,
               editorId: editor.id,
               content: editor.content,
               title: `${ct.title} - ${editor.name}`
             });
          }
        });
      }
    });
    return copies;
  }, [relatedCopyTasks]);

  const handleImportCopy = (editorId: string) => {
    if (!editorId) return;
    const selectedCopy = approvedCopies.find(c => c.editorId === editorId);
    if (selectedCopy) {
      setBriefingForm(prev => ({ ...prev, copyContent: selectedCopy.content }));
      saveDesignBriefing(() => ({ partial: { copyContent: selectedCopy.content } }));
    }
    setIsCopyDropdownOpen(false);
  };

  const handleCopyChange = (newCopy: string) => {
    if (!activeEditorId) return;
    const newEditors = normalizedEditors.map(e => e.id === activeEditorId ? { ...e, content: newCopy } : e);
    // Maintain backwards compatibility with copyContent for the first tab
    const firstContent = newEditors[0]?.content || '';
    setBriefingForm(prev => ({ ...prev, copyEditors: newEditors, copyContent: firstContent }));
  };

  const handleRenameTab = (id: string, newName: string) => {
    if (!newName.trim()) return;
    const newEditors = normalizedEditors.map(e => e.id === id ? { ...e, name: newName.trim() } : e);
    setBriefingForm(prev => ({ ...prev, copyEditors: newEditors }));
    setEditingTabNameId(null);
  };

  const handleAddTab = () => {
    const newId = Date.now().toString();
    const newEditors = [...normalizedEditors, { id: newId, name: `Card ${normalizedEditors.length + 1}`, content: '' }];
    setBriefingForm(prev => ({ ...prev, copyEditors: newEditors }));
    setActiveEditorId(newId);
  };

  const handleRemoveTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newEditors = normalizedEditors.filter(e => e.id !== id);
    setBriefingForm(prev => ({ ...prev, copyEditors: newEditors }));
    if (activeEditorId === id) {
      setActiveEditorId(newEditors[0]?.id || null);
    }
    if (newEditors.length === 0) {
      setIsCopyEditorVisible(false);
    }
  };

  const handleFormatChange = (peca: string, formato: string) => {
    const currentFormats = briefingForm.formatosEspecificos?.[peca] || [];
    const newFormats = toggleArrayItem(currentFormats, formato);
    setBriefingForm({
      ...briefingForm,
      formatosEspecificos: {
        ...briefingForm.formatosEspecificos,
        [peca]: newFormats
      }
    });
  };

  const handleCustomFormatChange = (peca: string, field: 'width' | 'height' | 'unit', value: string) => {
    const currentCustom = briefingForm.formatosPersonalizados?.[peca] || { width: '', height: '', unit: 'px' };
    setBriefingForm({
      ...briefingForm,
      formatosPersonalizados: {
        ...briefingForm.formatosPersonalizados,
        [peca]: { ...currentCustom, [field]: value }
      }
    });
  };

  const renderChipGroup = (
    options: string[], 
    selected: string[], 
    onChange: (newSelected: string[]) => void
  ) => {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => onChange(toggleArrayItem(selected, opt))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.15)]'
                  : 'bg-[#1f2937]/30 text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2937]/60 border border-transparent'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  };

  const renderReadonlyBriefing = () => {
    const validInspiracoes = (briefingForm.inspiracoes || []).filter(s => s.trim());
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
          <div 
            className="flex items-center gap-2 cursor-pointer group select-none"
            onClick={() => setIsBriefingCollapsed(!isBriefingCollapsed)}
          >
            <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
              Briefing da Peça
            </h3>
            <button className="text-zinc-500 group-hover:text-zinc-300 transition-colors p-1">
              {isBriefingCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
          {!disabled && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded transition-colors"
            >
              <Edit2 size={10} /> Editar
            </button>
          )}
        </div>
        
        {!isBriefingCollapsed && (
          <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex flex-wrap gap-x-12 gap-y-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Objetivo da Peça</span>
              <span className="text-xs text-zinc-200">{briefingForm.objetivos.join(', ') || 'Não definido'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Direção Criativa</span>
              <span className="text-xs text-zinc-200">{briefingForm.direcaoCriativa.join(', ') || 'Não definido'}</span>
            </div>
            {(briefingForm.direcaoFoco || []).length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Direção de Foco</span>
                <span className="text-xs text-zinc-200">{(briefingForm.direcaoFoco || []).join(', ')}</span>
              </div>
            )}
          </div>

          {briefingForm.mensagemPrincipal && (
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mensagem Principal</span>
              <span className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">{briefingForm.mensagemPrincipal}</span>
            </div>
          )}

          {validInspiracoes.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Inspirações</span>
              <div className="flex flex-wrap gap-2">
                {validInspiracoes.map((url, idx) => (
                  <a
                    key={idx}
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-all group"
                  >
                    <ExternalLink size={10} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                    Inspiração {idx + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 mt-2 border-t border-zinc-800/40 pt-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tipo da Peça</span>
            {briefingForm.tipoPeca.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {briefingForm.tipoPeca.map(peca => {
                  const formatos = briefingForm.formatosEspecificos?.[peca] || [];
                  const custom = briefingForm.formatosPersonalizados?.[peca];
                  
                  return (
                    <div key={peca} className="flex flex-col bg-zinc-900/40 px-3 py-2 rounded-md border border-zinc-800/40">
                      <span className="text-xs font-semibold text-zinc-300">{peca}</span>
                      {formatos.length > 0 && (
                        <div className="flex flex-col mt-1 space-y-0.5">
                          {formatos.map(f => (
                            <div key={f} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                              <span className="w-1 h-1 rounded-full bg-yellow-500/50" />
                              {f === 'Personalizado' && custom 
                                ? `${custom.width} x ${custom.height} ${custom.unit}`
                                : f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-zinc-200">Não definido</span>
            )}
          </div>
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-[#08080a]/40 rounded-md border border-zinc-900/40 animate-slide-down overflow-hidden mt-2">
      <div className="grid grid-cols-2 gap-8 px-5 pt-5 pb-5">
        
        <div className="flex flex-col gap-4">
          {!task.designBriefing?.isFilled && !isEditing ? (
            <div className="flex flex-col items-center justify-center py-6 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/10">
              <span className="text-zinc-500 text-xs mb-2">Nenhum briefing criado para esta peça</span>
              {!disabled && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-yellow-500/30 text-yellow-500/80 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:text-yellow-400 transition-colors"
                >
                  <Plus size={12} /> Adicionar Briefing
                </button>
              )}
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-4 bg-[#08080a] p-5 rounded-xl border border-zinc-900/50">
              <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
                <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
                  Briefing da Peça
                </h3>
              </div>
              <div className="flex flex-col gap-8 animate-fade-in">
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Objetivo:</span>
                {renderChipGroup(OBJETIVOS_OPTIONS, briefingForm.objetivos, (val) => setBriefingForm({ ...briefingForm, objetivos: val }))}
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Mensagem Principal</span>
                <textarea
                  value={briefingForm.mensagemPrincipal}
                  disabled={disabled}
                  onChange={(e) => setBriefingForm({ ...briefingForm, mensagemPrincipal: e.target.value })}
                  placeholder="Escreva a mensagem principal..."
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 resize-y min-h-[80px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Direção Criativa:</span>
                {renderChipGroup(DIRECAO_CRIATIVA_OPTIONS, briefingForm.direcaoCriativa, (val) => setBriefingForm({ ...briefingForm, direcaoCriativa: val }))}
              </div>

              {briefingForm.tipoPeca.some(p => DIRECAO_FOCO_PIECES.includes(p)) && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Direção de Foco:</span>
                  {renderChipGroup(DIRECAO_FOCO_OPTIONS, briefingForm.direcaoFoco || [], (val) => setBriefingForm({ ...briefingForm, direcaoFoco: val }))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Tipo da Peça:</span>
                {renderChipGroup(TIPO_PECA_OPTIONS, briefingForm.tipoPeca, (val) => setBriefingForm({ ...briefingForm, tipoPeca: val }))}
                
                <div className="flex flex-col gap-3 mt-1">
                  {briefingForm.tipoPeca.map(peca => {
                    const formatsForPeca = FORMATOS_DINAMICOS[peca];
                    if (!formatsForPeca) return null;

                    const selectedFormats = briefingForm.formatosEspecificos?.[peca] || [];
                    const isCustomSelected = selectedFormats.includes('Personalizado');
                    const customData = briefingForm.formatosPersonalizados?.[peca] || { width: '', height: '', unit: 'px' };

                    return (
                      <div key={peca} className="p-3 bg-[#0d1117]/50 border-l-2 border-yellow-500/50 rounded-r-lg animate-fade-in flex flex-col gap-2 ml-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Formatos Específicos - {peca}:</span>
                        {renderChipGroup(formatsForPeca, selectedFormats, (newSelected) => {
                          const newFormatos = { ...briefingForm.formatosEspecificos, [peca]: newSelected };
                          setBriefingForm({ ...briefingForm, formatosEspecificos: newFormatos });
                        })}
                        
                        {isCustomSelected && (
                          <div className="flex items-center gap-2 mt-2 animate-fade-in bg-zinc-900/50 p-2 rounded-md border border-zinc-800">
                            <input
                              type="number"
                              placeholder="Largura"
                              disabled={disabled}
                              value={customData.width}
                              onChange={(e) => handleCustomFormatChange(peca, 'width', e.target.value)}
                              className="w-20 bg-[#121214] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-yellow-500/50 disabled:opacity-50"
                            />
                            <span className="text-zinc-500 text-[10px]">x</span>
                            <input
                              type="number"
                              placeholder="Altura"
                              disabled={disabled}
                              value={customData.height}
                              onChange={(e) => handleCustomFormatChange(peca, 'height', e.target.value)}
                              className="w-20 bg-[#121214] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-yellow-500/50 disabled:opacity-50"
                            />
                            <select
                              value={customData.unit}
                              disabled={disabled}
                              onChange={(e) => handleCustomFormatChange(peca, 'unit', e.target.value)}
                              className="bg-[#121214] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-yellow-500/50 disabled:opacity-50"
                            >
                              <option value="px">px</option>
                              <option value="cm">cm</option>
                              <option value="mm">mm</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Inspirações:</span>
                <div className="flex flex-col gap-2">
                  {(briefingForm.inspiracoes || ['']).map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <div className="flex-1 flex items-center gap-2 bg-[#121214] border border-zinc-800/80 hover:border-zinc-700 focus-within:border-yellow-500/50 rounded-lg px-3 py-2 transition-all">
                        <ExternalLink size={11} className="text-zinc-600 shrink-0" />
                        <input
                          type="text"
                          value={url}
                          disabled={disabled}
                          onChange={(e) => {
                            const newList = [...(briefingForm.inspiracoes || [''])];
                            newList[idx] = e.target.value;
                            setBriefingForm({ ...briefingForm, inspiracoes: newList });
                          }}
                          placeholder={`https://... (link de inspiração ${idx + 1})`}
                          className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-600 outline-none disabled:opacity-50"
                        />
                      </div>
                      {(briefingForm.inspiracoes || ['']).length > 1 && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const newList = (briefingForm.inspiracoes || ['']).filter((_, i) => i !== idx);
                            setBriefingForm({ ...briefingForm, inspiracoes: newList.length > 0 ? newList : [''] });
                          }}
                          className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Remover"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const newList = [...(briefingForm.inspiracoes || ['']), ''];
                      setBriefingForm({ ...briefingForm, inspiracoes: newList });
                    }}
                    className="self-start flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-200 py-1 px-2 rounded hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} />
                    Adicionar mais uma inspiração
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-900/50">
              <button
                onClick={handleSaveBriefing}
                disabled={disabled}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={14} /> Salvar Briefing
              </button>
            </div>
          </div>
          ) : (
            renderReadonlyBriefing()
          )}
        </div>

        <div className="flex flex-col gap-4 h-full">

          {!isCopyEditorVisible ? (
            <div className="flex flex-col items-center justify-center py-6 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/10">
              <span className="text-zinc-500 text-xs mb-2">Nenhum copy criado para esta peça</span>
              {!disabled && (
                <button
                  onClick={() => {
                    setIsCopyEditorVisible(true);
                    if (normalizedEditors.length === 0) {
                      handleAddTab();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-yellow-500/30 text-yellow-500/80 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:text-yellow-400 transition-colors"
                >
                  <Plus size={12} /> Adicionar Copy
                </button>
              )}
            </div>
          ) : (
          <div className="flex-1 flex flex-col animate-fade-in bg-[#08080a] border border-zinc-900/60 rounded-xl resize-y overflow-hidden min-h-[300px]" style={{ height: '450px' }}>
            <div className="flex items-center gap-6 px-5 pt-4 pb-2 bg-transparent border-b border-zinc-800/40 overflow-x-auto overflow-y-hidden custom-scrollbar">
              {normalizedEditors.map((editor) => {
                const isActive = activeEditorId === editor.id;
                return (
                  <div 
                    key={editor.id}
                    onClick={() => {
                      if (isActive && !disabled) {
                        setEditingTabNameId(editor.id);
                      } else {
                        setActiveEditorId(editor.id);
                      }
                    }}
                    className={`group flex items-center justify-between pb-1 cursor-pointer transition-colors border-b-2 relative -bottom-[9px] ${
                      isActive 
                        ? `border-yellow-500/50 text-zinc-100 active` 
                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {editingTabNameId === editor.id && !disabled ? (
                      <input
                        autoFocus
                        defaultValue={editor.name}
                        onBlur={(e) => handleRenameTab(editor.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameTab(editor.id, e.currentTarget.value);
                          if (e.key === 'Escape') setEditingTabNameId(null);
                        }}
                        className="w-full min-w-[120px] bg-transparent outline-none text-sm text-zinc-100 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate select-none tracking-wide">
                          {editor.name}
                        </span>
                        {!disabled && (
                          <button
                            onClick={(e) => handleRemoveTab(e, editor.id)}
                            className="flex items-center justify-center w-4 h-4 rounded hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 group-[.active]:opacity-100"
                            title="Excluir"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!disabled && (
                <button
                  onClick={handleAddTab}
                  className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 transition-colors ml-1 relative -bottom-[4px]"
                  title="Novo Copy"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            
            <div className="flex-1 flex flex-col p-5 relative h-full">
            {approvedCopies.length > 0 && (
              <div className="mb-3 border-b border-zinc-800/40 pb-2 relative">
                <button
                  onClick={() => !disabled && setIsCopyDropdownOpen(!isCopyDropdownOpen)}
                  disabled={disabled}
                  className="w-full flex items-center justify-between bg-transparent text-zinc-500 hover:text-zinc-300 text-xs py-1 cursor-pointer focus:outline-none focus:ring-0 border-none transition-colors outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Importar Copy...</span>
                  <ChevronDown size={12} className={`transition-transform ${isCopyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isCopyDropdownOpen && !disabled && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsCopyDropdownOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1b1e] border border-zinc-800 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden animate-fade-in py-1">
                      {approvedCopies.map(copy => (
                        <button
                          key={copy.editorId}
                          onClick={() => handleImportCopy(copy.editorId)}
                          className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
                        >
                          {copy.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex-1 relative min-h-0 max-h-[350px] overflow-y-auto custom-scrollbar">
              <RichTextEditor
              taskId={`copy-${task.id}-${activeEditorId}`}
              content={normalizedEditors.find(e => e.id === activeEditorId)?.content || ''}
              onChange={handleCopyChange}
              variant="borderless"
              wrapperClassName="max-h-[350px]"
              readOnly={disabled}
            />
            </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Seção de Aprovação (Full Width) */}
      <div className="px-5 py-6 mt-6 border-t border-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4 mb-6">
          <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
            Aprovação de Criativos
          </h3>
        </div>

        <div className="flex flex-col gap-6 animate-fade-in">

            {/* Formulário de Criação / Edição */}
            {(isCreatingDelivery || editingDeliveryId) && (
              <>
              <DeliveryForm
                users={sortedUsers}
                initialData={briefingForm.deliveries?.find(d => d.id === editingDeliveryId)}
                onCancel={() => {
                  setIsCreatingDelivery(false);
                  setEditingDeliveryId(null);
                }}
                onSave={async (data) => {
                  const wasEditing = !!editingDeliveryId;
                  const success = await saveDeliveryChange((base) => {
                    let newDeliveries = [...(base.deliveries || [])];
                    let notify: (() => void) | undefined;
                    if (editingDeliveryId) {
                      newDeliveries = newDeliveries.map(d =>
                        d.id === editingDeliveryId ? { ...d, ...data } : d
                      );
                    } else {
                      const now = new Date().toISOString();
                      const newId = Date.now().toString();
                      newDeliveries.push({
                        id: newId,
                        ...data,
                        status: 'pending',
                        thread: [{
                          id: newId + '-sub',
                          role: 'designer',
                          type: 'submission',
                          content: data.creativeDefense || 'Nova entrega',
                          createdAt: now
                        }],
                        createdAt: now
                      } as any);

                      if (data.approverId) {
                        // Deferred: only actually sent once saveDeliveryChange confirms
                        // the delivery was persisted, so an approver never gets pinged
                        // for a creative that isn't in the DB yet.
                        notify = () => addNotification({
                          userId: data.approverId!,
                          actorId: currentUser?.id || 'system',
                          taskId: task.id,
                          type: 'review_requested',
                          message: 'Aprovação de Criativo',
                          details: `Você foi selecionado para aprovar um criativo na tarefa "${task.title}".`,
                          targetId: `design-delivery-${newId}`
                        });
                      }
                    }

                    const taskUpdates: Partial<Task> = {};
                    if (!wasEditing && task.status !== 'approval') {
                      taskUpdates.status = 'approval';
                    }

                    return { partial: { deliveries: newDeliveries }, taskUpdates, notify };
                  });

                  if (success) {
                    setIsCreatingDelivery(false);
                    setEditingDeliveryId(null);
                  }
                  return success;
                }}
              />
              {isSavingDelivery && (
                <div className="flex items-center gap-2 text-xs text-yellow-400/80 -mt-4">
                  <span className="w-3 h-3 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
                  Salvando criativo...
                </div>
              )}
              {deliverySaveError && (
                <div className="text-xs text-red-400 -mt-4">{deliverySaveError}</div>
              )}
              </>
            )}

            {/* Lista de Criativos Detalhados */}
            {!isCreatingDelivery && !editingDeliveryId && (
              // The creatives live in design_briefing, which is fetched on demand and
              // carries base64 images — it can take seconds. Until it lands we must not
              // render "nenhum criativo", which reads as "there is nothing to approve".
              briefingsLoading && !(briefingForm.deliveries && briefingForm.deliveries.length > 0) ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="w-3 h-3 border-2 border-zinc-700 border-t-yellow-500 rounded-full animate-spin" />
                    Carregando criativos...
                  </div>
                  <div className="h-[280px] rounded-xl border border-zinc-800/60 bg-zinc-900/20 animate-pulse" />
                </div>
              ) : briefingForm.deliveries && briefingForm.deliveries.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {isSavingDelivery && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400/80">
                      <span className="w-3 h-3 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
                      Salvando alterações...
                    </div>
                  )}
                  {deliverySaveError && (
                    <div className="text-xs text-red-400">{deliverySaveError}</div>
                  )}
                  {briefingForm.deliveries.map((delivery, i) => (
                    <div key={delivery.id} id={`target-design-delivery-${delivery.id}`}>
                      <DeliveryApproval
                        delivery={delivery}
                        index={i + 1}
                        disabled={disabled || isSavingDelivery}
                        onUpdate={(id, updates) => {
                        saveDeliveryChange((base) => {
                          const oldDelivery = base.deliveries?.find(d => d.id === id);
                          const newDeliveries = (base.deliveries || []).map(d =>
                            d.id === id ? { ...d, ...updates } : d
                          );

                          const taskUpdates: Partial<Task> = {};
                          if (updates.status) {
                            let newTaskStatus = task.status;
                            if (updates.status === 'pending' || updates.status === 'review_requested') {
                              newTaskStatus = 'approval';
                            } else if (updates.status === 'rejected' || updates.status === 'reworking') {
                              newTaskStatus = 'rework';
                            }

                            if (updates.status === 'approved') {
                              const allApproved = newDeliveries.length > 0 && newDeliveries.every(d => d.status === 'approved');
                              if (allApproved) {
                                newTaskStatus = 'implementation';
                              }
                            }

                            if (newTaskStatus !== task.status) {
                              taskUpdates.status = newTaskStatus;
                            }
                          }

                          const notifications: (() => void)[] = [];

                          if (updates.status === 'rejected' && oldDelivery?.status !== 'rejected') {
                            if (task.assigneeId) {
                              notifications.push(() => addNotification({
                                userId: task.assigneeId!,
                                actorId: currentUser?.id || '',
                                message: 'Reprovação de Criativo',
                                details: `O criativo da tarefa "${task.title}" foi reprovado e precisa de ajustes.`,
                                type: 'rejected',
                                taskId: task.id,
                                targetId: `design-delivery-${id}`
                              }));
                            }
                          }

                          if (updates.status === 'approved' && oldDelivery?.status !== 'approved') {
                            if (task.assigneeId) {
                              notifications.push(() => addNotification({
                                userId: task.assigneeId!,
                                actorId: currentUser?.id || '',
                                message: 'Criativo Aprovado! 🎉',
                                details: `O criativo da tarefa "${task.title}" foi aprovado.`,
                                type: 'approved',
                                taskId: task.id,
                                targetId: `design-delivery-${id}`
                              }));
                            }
                          }

                          if ((updates.status === 'reworking' && oldDelivery?.status !== 'reworking') ||
                              (updates.status === 'review_requested' && oldDelivery?.status !== 'review_requested')) {

                            const rejectMsg = [...(oldDelivery?.thread || [])].reverse().find(t => t.action === 'rejected');
                            const targetUserId = oldDelivery?.approverId || rejectMsg?.authorId;

                            if (targetUserId) {
                              notifications.push(() => addNotification({
                                userId: targetUserId,
                                actorId: currentUser?.id || '',
                                message: updates.status === 'reworking' ? 'Em Refação' : 'Revisão Solicitada',
                                details: updates.status === 'reworking'
                                  ? `O designer concordou em refazer o criativo da tarefa "${task.title}".`
                                  : `O designer solicitou uma revisão da reprovação do criativo na tarefa "${task.title}".`,
                                type: 'review_requested',
                                taskId: task.id,
                                targetId: `design-delivery-${id}`
                              }));
                            }
                          }

                          return {
                            partial: { deliveries: newDeliveries },
                            taskUpdates,
                            notify: notifications.length > 0 ? () => notifications.forEach(n => n()) : undefined
                          };
                        });
                      }}
                      onDelete={(id) => {
                        setDeleteConfirmId(id);
                      }}
                    />
                  </div>
                  ))}
                  {!isCreatingDelivery && !editingDeliveryId && !disabled && (
                    <div className="flex flex-col items-center justify-center py-6 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/10">
                      <button
                        onClick={() => setIsCreatingDelivery(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-yellow-500/30 text-yellow-500/80 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:text-yellow-400 transition-colors"
                      >
                        <Plus size={12} /> Adicionar Criativo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/10">
                  <span className="text-zinc-500 text-xs mb-2">Nenhum criativo foi adicionado ainda.</span>
                  {!disabled && (
                    <button
                      onClick={() => setIsCreatingDelivery(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-yellow-500/30 text-yellow-500/80 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:text-yellow-400 transition-colors"
                    >
                      <Plus size={12} /> Adicionar Criativo
                    </button>
                  )}
                </div>
              )
            )}
          </div>
      </div>

      <ConfirmModal 
        isOpen={!!deleteConfirmId}
        title="Excluir Criativo"
        message="Tem certeza que deseja excluir este criativo? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        onConfirm={() => {
          if (deleteConfirmId) {
            const idToDelete = deleteConfirmId;
            saveDeliveryChange((base) => ({
              partial: { deliveries: (base.deliveries || []).filter(d => d.id !== idToDelete) }
            }));
          }
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
