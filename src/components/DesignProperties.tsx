import React, { useState, useEffect } from 'react';
import { Task, DesignBriefing } from '../types';
import { Edit2, Check, ChevronDown, ChevronUp, Plus, X, ExternalLink } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import DeliveryApproval from './DeliveryApproval';
import DeliveryForm from './DeliveryForm';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface DesignPropertiesProps {
  task: Task;
  allTasks?: Task[];
  saveChange: (updates: Partial<Task>) => void;
  themeColor?: string;
  disabled?: boolean;
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

export default function DesignProperties({ task, allTasks = [], saveChange, themeColor = 'text-blue-500', disabled = false }: DesignPropertiesProps) {
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(!task.designBriefing?.isFilled && !disabled);
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(false);
  const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
  const { allUsers: USERS, currentUser } = useAuth();
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
    copyContent: ''
  });

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
        copyContent: ''
      });
      setIsEditing(!task.designBriefing?.isFilled && !disabled);
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

  const handleSaveBriefing = () => {
    const updatedBriefing = { ...briefingForm, isFilled: true };
    setBriefingForm(updatedBriefing);
    setIsEditing(false);
    saveChange({ designBriefing: updatedBriefing });
  };

  useEffect(() => {
    if (!task) return;
    if (briefingForm.copyContent === task.designBriefing?.copyContent) return;
    const timer = setTimeout(() => {
      saveChange({ designBriefing: briefingForm });
    }, 800);
    return () => clearTimeout(timer);
  }, [briefingForm.copyContent]);

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
      saveChange({ designBriefing: { ...briefingForm, copyContent: selectedCopy.content } });
    }
    setIsCopyDropdownOpen(false);
  };

  const handleCopyChange = (newCopy: string) => {
    setBriefingForm(prev => ({ ...prev, copyContent: newCopy }));
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
          {isEditing ? (
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
          <h4 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Edit2 size={16} className={themeColor} />
            Copy
          </h4>
          <div className="flex-1 flex flex-col animate-fade-in bg-[#121214] border border-zinc-800/40 rounded-lg p-3 min-h-[300px]">
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
            <div className="flex-1 relative">
              <RichTextEditor
              taskId={`copy-${task.id}`}
              content={briefingForm.copyContent || ''}
              onChange={handleCopyChange}
              variant="borderless"
              readOnly={disabled}
            />
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Aprovação (Full Width) */}
      <div className="px-5 py-6 mt-6 border-t border-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4 mb-6">
          <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
            Aprovação de Criativos
          </h3>
          {!isCreatingDelivery && !editingDeliveryId && !disabled && (
            <button 
              onClick={() => setIsCreatingDelivery(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-yellow-500 hover:bg-yellow-400 text-yellow-950 uppercase tracking-wider rounded transition-colors"
            >
              + Novo Criativo
            </button>
          )}
        </div>

        <div className="flex flex-col gap-6 animate-fade-in">

            {/* Formulário de Criação / Edição */}
            {(isCreatingDelivery || editingDeliveryId) && (
              <DeliveryForm
                users={sortedUsers}
                initialData={briefingForm.deliveries?.find(d => d.id === editingDeliveryId)}
                onCancel={() => {
                  setIsCreatingDelivery(false);
                  setEditingDeliveryId(null);
                }}
                onSave={(data) => {
                  let newDeliveries = [...(briefingForm.deliveries || [])];
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
                      addNotification({
                        userId: data.approverId,
                        actorId: currentUser?.id || 'system',
                        taskId: task.id,
                        type: 'review_requested',
                        message: 'Aprovação de Criativo',
                        details: `Você foi selecionado para aprovar um criativo na tarefa "${task.title}".`,
                        targetId: `design-delivery-${newId}`
                      });
                    }
                  }
                  
                  const updated = { ...briefingForm, deliveries: newDeliveries };
                  setBriefingForm(updated);
                  
                  const taskUpdates: Partial<Task> = { designBriefing: updated };
                  if (!editingDeliveryId && task.status !== 'approval') {
                    taskUpdates.status = 'approval';
                  }
                  saveChange(taskUpdates);
                  
                  setIsCreatingDelivery(false);
                  setEditingDeliveryId(null);
                }}
              />
            )}

            {/* Lista de Criativos Detalhados */}
            {!isCreatingDelivery && !editingDeliveryId && (
              briefingForm.deliveries && briefingForm.deliveries.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {briefingForm.deliveries.map((delivery, i) => (
                    <div key={delivery.id} id={`target-design-delivery-${delivery.id}`}>
                      <DeliveryApproval
                        delivery={delivery}
                        index={i + 1}
                        disabled={disabled}
                        onUpdate={(id, updates) => {
                        const oldDelivery = briefingForm.deliveries?.find(d => d.id === id);
                        const newDeliveries = briefingForm.deliveries?.map(d => 
                          d.id === id ? { ...d, ...updates } : d
                        );
                        const updated = { ...briefingForm, deliveries: newDeliveries };
                        setBriefingForm(updated);

                        let taskUpdates: Partial<Task> = { designBriefing: updated };
                        if (updates.status) {
                          let newTaskStatus = task.status;
                          if (updates.status === 'pending' || updates.status === 'review_requested') {
                            newTaskStatus = 'approval';
                          } else if (updates.status === 'rejected' || updates.status === 'reworking') {
                            newTaskStatus = 'rework';
                          }
                          
                          if (updates.status === 'approved') {
                            const allApproved = newDeliveries && newDeliveries.length > 0 && newDeliveries.every(d => d.status === 'approved');
                            if (allApproved) {
                              newTaskStatus = 'implementation';
                            }
                          }
                          
                          if (newTaskStatus !== task.status) {
                            taskUpdates.status = newTaskStatus;
                          }
                        }
                        
                        saveChange(taskUpdates);

                        if (updates.status === 'rejected' && oldDelivery?.status !== 'rejected') {
                          if (task.assigneeId) {
                            addNotification({
                              userId: task.assigneeId,
                              actorId: currentUser?.id || '',
                              message: 'Reprovação de Criativo',
                              details: `O criativo da tarefa "${task.title}" foi reprovado e precisa de ajustes.`,
                              type: 'rejected',
                              taskId: task.id,
                              targetId: `design-delivery-${id}`
                            });
                          }
                        }

                        if (updates.status === 'approved' && oldDelivery?.status !== 'approved') {
                          if (task.assigneeId) {
                            addNotification({
                              userId: task.assigneeId,
                              actorId: currentUser?.id || '',
                              message: 'Criativo Aprovado! 🎉',
                              details: `O criativo da tarefa "${task.title}" foi aprovado.`,
                              type: 'approved',
                              taskId: task.id,
                              targetId: `design-delivery-${id}`
                            });
                          }
                        }

                        if ((updates.status === 'reworking' && oldDelivery?.status !== 'reworking') || 
                            (updates.status === 'review_requested' && oldDelivery?.status !== 'review_requested')) {
                          
                          const rejectMsg = [...(oldDelivery?.thread || [])].reverse().find(t => t.action === 'rejected');
                          const targetUserId = oldDelivery?.approverId || rejectMsg?.authorId;

                          if (targetUserId) {
                            addNotification({
                              userId: targetUserId,
                              actorId: currentUser?.id || '',
                              message: updates.status === 'reworking' ? 'Em Refação' : 'Revisão Solicitada',
                              details: updates.status === 'reworking' 
                                ? `O designer concordou em refazer o criativo da tarefa "${task.title}".`
                                : `O designer solicitou uma revisão da reprovação do criativo na tarefa "${task.title}".`,
                              type: 'review_requested',
                              taskId: task.id,
                              targetId: `design-delivery-${id}`
                            });
                          }
                        }
                      }}
                      onDelete={(id) => {
                        setDeleteConfirmId(id);
                      }}
                    />
                  </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 animate-fade-in border border-dashed border-zinc-800/60 rounded-lg">
                  <p className="text-xs">Nenhum criativo foi adicionado ainda.</p>
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
            const newDeliveries = briefingForm.deliveries?.filter(d => d.id !== deleteConfirmId);
            const updated = { ...briefingForm, deliveries: newDeliveries };
            setBriefingForm(updated);
            saveChange({ designBriefing: updated });
          }
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
