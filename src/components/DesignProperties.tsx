import React, { useState, useEffect } from 'react';
import { Task, DesignBriefing } from '../types';
import { Edit2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import DeliveryApproval from './DeliveryApproval';
import DeliveryForm from './DeliveryForm';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface DesignPropertiesProps {
  task: Task;
  saveChange: (updates: Partial<Task>) => void;
  themeColor?: string;
}

const OBJETIVOS_OPTIONS = [
  'Gerar Leads', 'Gerar Interesse', 'Visitas ao stand', 'Apresentação institucional',
  'Lançamento de Produto', 'Engajamento', 'Reforço de marca', 'Convidar',
  'Divulgar Promoção', 'Comunicado'
];

const TIPO_PECA_OPTIONS = [
  'Feed', 'Stories', 'Banner site', 'Video', 'Landing page',
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
  ]
};

const DIRECAO_CRIATIVA_OPTIONS = [
  'Institucional', 'Corporativo', 'Sofisticado', 'Luxo', 'Imponente', 'Lifestyle',
  'Aspiracional', 'Familiar', 'Comercial', 'Conversão', 'Oferta', 'Urgência',
  'Visual Leve', 'Técnico', 'Chamativo', 'Dramático'
];

type TabId = 'copy' | 'aprovacao';

export default function DesignProperties({ task, saveChange, themeColor = 'text-blue-500' }: DesignPropertiesProps) {
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(!task.designBriefing?.isFilled);
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(false);
  const { allUsers: USERS, currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [briefingForm, setBriefingForm] = useState<DesignBriefing>(task.designBriefing || {
    isFilled: false,
    objetivos: [],
    tipoPeca: [],
    formatosEspecificos: {},
    formatosPersonalizados: {},
    mensagemPrincipal: '',
    direcaoCriativa: [],
    copyContent: ''
  });

  // Sync state when task changes (important since this component is never unmounted by TaskSheet)
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
        copyContent: ''
      });
      setIsEditing(!task.designBriefing?.isFilled);
    }
  }, [task.id]);

  useEffect(() => {
    const handleOpenSection = (e: CustomEvent<{ section: string, targetId?: string }>) => {
      // With the new layout, approval is always visible below, so we don't need to switch tabs anymore
      // We can keep the listener just in case we need to scroll or handle other things
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

  // Auto-save debounced for copyContent
  useEffect(() => {
    if (!task) return;
    if (briefingForm.copyContent === task.designBriefing?.copyContent) return;
    const timer = setTimeout(() => {
      saveChange({ designBriefing: briefingForm });
    }, 800);
    return () => clearTimeout(timer);
  }, [briefingForm.copyContent]);

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
              onClick={() => onChange(toggleArrayItem(selected, opt))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <Edit2 size={10} /> Editar
          </button>
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
          </div>

          {briefingForm.mensagemPrincipal && (
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mensagem Principal</span>
              <span className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">{briefingForm.mensagemPrincipal}</span>
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
      {/* 2 Colunas: Briefing e Copy */}
      <div className="grid grid-cols-2 gap-8 px-5 pt-5 pb-5">
        
        {/* Coluna 1: Briefing da Peça */}
        <div className="flex flex-col gap-4">
          {isEditing ? (
            <div className="flex flex-col gap-4 bg-[#08080a] p-5 rounded-xl border border-zinc-900/50">
              <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
                <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
                  Briefing da Peça
                </h3>
              </div>
              <div className="flex flex-col gap-8 animate-fade-in">
              {/* Objetivo */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Objetivo:</span>
                {renderChipGroup(OBJETIVOS_OPTIONS, briefingForm.objetivos, (val) => setBriefingForm({ ...briefingForm, objetivos: val }))}
              </div>

              {/* Mensagem Principal */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Mensagem Principal</span>
                <textarea
                  value={briefingForm.mensagemPrincipal}
                  onChange={(e) => setBriefingForm({ ...briefingForm, mensagemPrincipal: e.target.value })}
                  placeholder="Escreva a mensagem principal..."
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 resize-y min-h-[80px] transition-all"
                />
              </div>

              {/* Direção Criativa */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Direção Criativa:</span>
                {renderChipGroup(DIRECAO_CRIATIVA_OPTIONS, briefingForm.direcaoCriativa, (val) => setBriefingForm({ ...briefingForm, direcaoCriativa: val }))}
              </div>

              {/* Tipo da Peça */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-medium text-zinc-500 font-sans uppercase tracking-widest">Tipo da Peça:</span>
                {renderChipGroup(TIPO_PECA_OPTIONS, briefingForm.tipoPeca, (val) => setBriefingForm({ ...briefingForm, tipoPeca: val }))}
                
                {/* Dynamic Formats Blocks based on selected Tipo da Peça */}
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
                        
                        {/* Custom Format Inputs */}
                        {isCustomSelected && (
                          <div className="flex items-center gap-2 mt-2 animate-fade-in bg-zinc-900/50 p-2 rounded-md border border-zinc-800">
                            <input
                              type="number"
                              placeholder="Largura"
                              value={customData.width}
                              onChange={(e) => handleCustomFormatChange(peca, 'width', e.target.value)}
                              className="w-20 bg-[#121214] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-yellow-500/50"
                            />
                            <span className="text-zinc-500 text-[10px]">x</span>
                            <input
                              type="number"
                              placeholder="Altura"
                              value={customData.height}
                              onChange={(e) => handleCustomFormatChange(peca, 'height', e.target.value)}
                              className="w-20 bg-[#121214] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-yellow-500/50"
                            />
                            <select
                              value={customData.unit}
                              onChange={(e) => handleCustomFormatChange(peca, 'unit', e.target.value)}
                              className="bg-[#121214] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-yellow-500/50"
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
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-900/50">
              <button
                onClick={handleSaveBriefing}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 transition-colors"
              >
                <Check size={14} /> Salvar Briefing
              </button>
            </div>
          </div>
          ) : (
            renderReadonlyBriefing()
          )}
        </div>

        {/* Coluna 2: Copy */}
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
            <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
              Copy
            </h3>
          </div>
          <div className="flex-1 flex flex-col gap-3 animate-fade-in bg-[#121214] border border-zinc-800/40 rounded-lg p-2 min-h-[300px]">
            <RichTextEditor
              taskId={`copy-${task.id}`}
              content={briefingForm.copyContent || ''}
              onChange={handleCopyChange}
              variant="borderless"
            />
          </div>
        </div>
      </div>

      {/* Seção de Aprovação (Full Width) */}
      <div className="px-5 py-6 mt-6 border-t border-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4 mb-6">
          <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
            Aprovação de Criativos
          </h3>
          {!isCreatingDelivery && !editingDeliveryId && (
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
                users={USERS}
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
