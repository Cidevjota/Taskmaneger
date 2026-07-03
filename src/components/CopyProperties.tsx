import React, { useState, useEffect } from 'react';
import { Task, CopyBriefing, Delivery } from '../types';
import { Edit2, Check, ChevronDown, ChevronRight, Send, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import DeliveryApproval from './DeliveryApproval';
import CopyApprovalPanel from './CopyApprovalPanel';
import DeliveryForm from './DeliveryForm';
import RichTextEditor from './RichTextEditor';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface CopyPropertiesProps {
  task: Task;
  saveChange: (updates: Partial<Task>) => void;
  themeColor?: string;
}

const PERFIL_PRIMARIO_OPTIONS = [
  'Investidor pessoa física', 'Investidor pessoa jurídica', 'Família com filhos', 
  'Casal sem filhos', 'Single', 'Aposentado', 'Brasileiros no exterior'
];

const MOMENTO_COMPRA_OPTIONS = [
  '1ª moradia', '2ª moradia / lazer', '1º investimento', 'Portfólio imobiliário', 'Troca de imóvel'
];

const FAIXA_RENDA_OPTIONS = [
  'Classe B', 'Classe B+', 'Classe A', 'Alta renda / patrimônio elevado'
];

const DESEJO_SONHO_OPTIONS = [
  'Segurança e patrimônio duradouro', 'Liberdade financeira / renda passiva',
  'Qualidade de vida e conforto', 'Status e reconhecimento social',
  'Deixar algo para os filhos', 'Aproveitar a vida agora', 'Ter um lar verdadeiro'
];

const OBJECOES_OPTIONS = [
  'Preço alto / momento econômico', 'Medo de a construtora não entregar',
  'Já tentou antes e se frustrou', 'Não sabe se é o momento certo',
  'Cônjuge ainda não está convencido', 'Prefere renda variável (ações, FIIs)',
  'Burocracia e dificuldade de financiamento'
];

const OBJETIVO_MARKETING_OPTIONS = [
  'Gerar leads qualificados', 'Aquecer base existente', 'Lançamento', 'Visita ao decorado',
  'Convidar para evento', 'Gerar interesse / topo de funil', 'Reengajar lead frio'
];

const ETAPA_FUNIL_OPTIONS = [
  'Topo (descoberta)', 'Meio (consideração)', 'Fundo (decisão)'
];

const ACAO_UNICA_OPTIONS = [
  'Preencher formulário (lead)', 'Enviar mensagem no WhatsApp', 'Ligar para o plantão',
  'Agendar visita', 'Salvar / compartilhar o post', 'Assistir ao vídeo completo',
  'Acessar o site / landing page'
];

const TOM_PECA_OPTIONS = [
  'Sofisticado', 'Aspiracional', 'Direto e objetivo', 'Caloroso e próximo', 'Urgência', 
  'Exclusividade', 'Institucional', 'Descontraído'
];

const COMO_MARCA_PERCEBIDA_OPTIONS = [
  'Construtora mais confiável da região', 'Sinônimo de design premium',
  'Entregamos o que prometemos', 'Cuidamos do cliente após a venda',
  'Referência em inovação e qualidade', 'Empresa com propósito e história'
];

const CANAL_VEICULACAO_OPTIONS = [
  'Feed Instagram', 'Stories / Reels', 'Meta Ads (feed)', 'Meta Ads (vídeo)', 
  'WhatsApp', 'E-mail', 'SMS / push', 'Outdoor / OOH', 'Landing page'
];

const FORMATO_PECA_OPTIONS = [
  'Carrossel', 'Post estático', 'Vídeo curto (até 15s)', 'Vídeo longo', 
  'Roteiro de locução', 'Legenda de post'
];

const EXTENSAO_TEXTO_OPTIONS = [
  'Headline (até 10 palavras)', 'Copy curta (1-3 linhas)', 'Copy média (1 parágrafo)', 'Copy longa (múltiplos parágrafos)'
];

type TabId = 'copy' | 'aprovacao';

export default function CopyProperties({ task, saveChange, themeColor = 'text-pink-500' }: CopyPropertiesProps) {
  const [activeTab, setActiveTab] = useState<TabId>('copy');
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  
  const { allUsers: USERS, currentUser } = useAuth();
  const sortedUsers = currentUser
    ? [currentUser, ...USERS.filter(u => u.id !== currentUser.id)]
    : USERS;
  const { addNotification } = useNotifications();
  
  const [selectedCopyEditorId, setSelectedCopyEditorId] = useState<string>('');
  const [isEditorSelectOpen, setIsEditorSelectOpen] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [isApproverSelectOpen, setIsApproverSelectOpen] = useState(false);
  const [copyDefense, setCopyDefense] = useState('');
  const [selectedApprovalDeliveryId, setSelectedApprovalDeliveryId] = useState<string | null>(null);

  const safeArray = (val: any): string[] => Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);

  const [isEditing, setIsEditing] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [newEditorName, setNewEditorName] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [briefingForm, setBriefingForm] = useState<CopyBriefing>(() => {
    const existing = task.copyBriefing || {} as Partial<CopyBriefing>;
    const defaultEditors = existing.textoCopy 
      ? [{ id: Date.now().toString(), name: 'Texto Principal', content: existing.textoCopy }]
      : [{ id: Date.now().toString(), name: '', content: '' }];
      
    return {
      isFilled: existing.isFilled || false,
      perfilPrimario: safeArray(existing.perfilPrimario),
      momentoCompra: safeArray(existing.momentoCompra),
      faixaRenda: safeArray(existing.faixaRenda),
      desejoSonho: safeArray(existing.desejoSonho),
      objecoes: safeArray(existing.objecoes),
      objetivoMarketing: safeArray(existing.objetivoMarketing),
      etapaFunil: safeArray(existing.etapaFunil),
      acaoUnica: safeArray(existing.acaoUnica),
      tomPeca: safeArray(existing.tomPeca),
      comoMarcaPercebida: safeArray(existing.comoMarcaPercebida),
      canalVeiculacao: safeArray(existing.canalVeiculacao),
      formatoPeca: safeArray(existing.formatoPeca),
      extensaoTexto: safeArray(existing.extensaoTexto),
      textoCopy: existing.textoCopy || '',
      copyEditors: existing.copyEditors || defaultEditors,
      deliveries: existing.deliveries || []
    };
  });

  // Sync state when task changes (important since this component is never unmounted by TaskSheet)
  useEffect(() => {
    if (task) {
      const existing = task.copyBriefing || {} as Partial<CopyBriefing>;
      const defaultEditors = existing.textoCopy 
        ? [{ id: Date.now().toString(), name: 'Texto Principal', content: existing.textoCopy }]
        : [{ id: Date.now().toString(), name: '', content: '' }];
        
      setBriefingForm({
        isFilled: existing.isFilled || false,
        perfilPrimario: safeArray(existing.perfilPrimario),
        momentoCompra: safeArray(existing.momentoCompra),
        faixaRenda: safeArray(existing.faixaRenda),
        desejoSonho: safeArray(existing.desejoSonho),
        objecoes: safeArray(existing.objecoes),
        objetivoMarketing: safeArray(existing.objetivoMarketing),
        etapaFunil: safeArray(existing.etapaFunil),
        acaoUnica: safeArray(existing.acaoUnica),
        tomPeca: safeArray(existing.tomPeca),
        comoMarcaPercebida: safeArray(existing.comoMarcaPercebida),
        canalVeiculacao: safeArray(existing.canalVeiculacao),
        formatoPeca: safeArray(existing.formatoPeca),
        extensaoTexto: safeArray(existing.extensaoTexto),
        textoCopy: existing.textoCopy || '',
        copyEditors: existing.copyEditors || defaultEditors,
        deliveries: existing.deliveries || []
      });
      setIsEditing(false); // Reset to view mode on new task
    }
  }, [task.id, task.copyBriefing]);

  useEffect(() => {
    const handleOpenSection = (e: CustomEvent<{ section: string, targetId?: string }>) => {
      if (e.detail.section === 'copyProps' && e.detail.targetId && e.detail.targetId.startsWith('copy-delivery-')) {
        setActiveTab('aprovacao');
        setSelectedApprovalDeliveryId(null);
      }
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
    saveChange({ copyBriefing: updatedBriefing });
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
                  ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30 shadow-[0_0_8px_rgba(236,72,153,0.15)]'
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
          <button 
            onClick={() => setIsBriefingOpen(!isBriefingOpen)}
            className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor} hover:opacity-80 transition-opacity`}
          >
            {isBriefingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Briefing
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <Edit2 size={10} /> Editar
          </button>
        </div>
        
        {isBriefingOpen && (
          <div className="flex flex-col gap-8 animate-fade-in">
            {/* Para quem */}
            <div className="flex flex-col gap-3">
              <h4 className={`text-[10px] font-bold uppercase tracking-wider bg-zinc-900/50 px-2 py-1 rounded w-fit ${themeColor}`}>2. Para quem</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Perfil primário</span>
                <span className="text-xs text-zinc-200">{briefingForm.perfilPrimario.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Momento de compra</span>
                <span className="text-xs text-zinc-200">{briefingForm.momentoCompra.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Faixa de renda</span>
                <span className="text-xs text-zinc-200 whitespace-pre-wrap">{briefingForm.faixaRenda.join(', ') || '-'}</span>
              </div>
            </div>
          </div>

          {/* Dor e desejo */}
          <div className="flex flex-col gap-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-wider bg-zinc-900/50 px-2 py-1 rounded w-fit ${themeColor}`}>3. Dor e desejo</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Maior desejo ou sonho</span>
                <span className="text-xs text-zinc-200 whitespace-pre-wrap">{briefingForm.desejoSonho.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Objeções mais comuns</span>
                <span className="text-xs text-zinc-200 whitespace-pre-wrap">{briefingForm.objecoes.join(', ') || '-'}</span>
              </div>
            </div>
          </div>

          {/* Objetivo da peça */}
          <div className="flex flex-col gap-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-wider bg-zinc-900/50 px-2 py-1 rounded w-fit ${themeColor}`}>4. Objetivo da peça</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Objetivo de marketing</span>
                <span className="text-xs text-zinc-200">{briefingForm.objetivoMarketing.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Etapa do funil</span>
                <span className="text-xs text-zinc-200">{briefingForm.etapaFunil.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Ação única que devem tomar</span>
                <span className="text-xs text-zinc-200 whitespace-pre-wrap">{briefingForm.acaoUnica.join(', ') || '-'}</span>
              </div>
            </div>
          </div>

          {/* Tom e voz */}
          <div className="flex flex-col gap-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-wider bg-zinc-900/50 px-2 py-1 rounded w-fit ${themeColor}`}>5. Tom e voz</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Tom da peça</span>
                <span className="text-xs text-zinc-200">{briefingForm.tomPeca.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Como a marca quer ser percebida</span>
                <span className="text-xs text-zinc-200 whitespace-pre-wrap">{briefingForm.comoMarcaPercebida.join(', ') || '-'}</span>
              </div>
            </div>
          </div>

          {/* Formato e canal */}
          <div className="flex flex-col gap-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-wider bg-zinc-900/50 px-2 py-1 rounded w-fit ${themeColor}`}>6. Formato e canal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Canal de veiculação</span>
                <span className="text-xs text-zinc-200">{briefingForm.canalVeiculacao.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Formato da peça</span>
                <span className="text-xs text-zinc-200">{briefingForm.formatoPeca.join(', ') || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Extensão esperada</span>
                <span className="text-xs text-zinc-200">{briefingForm.extensaoTexto.join(', ') || '-'}</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-[#08080a]/40 rounded-md border border-zinc-900/40 overflow-hidden mt-2">
      {/* Briefing Content */}
      <div className="p-5 bg-transparent">
        {isEditing ? (
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
              <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
                Editar Briefing
              </h3>
              <button
                onClick={handleSaveBriefing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors"
              >
                <Check size={12} /> Salvar Briefing
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-8">
              {/* Para quem */}
              <div className="space-y-4">
                <h4 className={`text-xs font-bold ${themeColor}`}>2. Para quem</h4>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    Perfil primário
                  </span>
                  {renderChipGroup(PERFIL_PRIMARIO_OPTIONS, briefingForm.perfilPrimario, (newArr) => setBriefingForm({...briefingForm, perfilPrimario: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    Momento de compra
                  </span>
                  {renderChipGroup(MOMENTO_COMPRA_OPTIONS, briefingForm.momentoCompra, (newArr) => setBriefingForm({...briefingForm, momentoCompra: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Faixa de renda estimada</span>
                  {renderChipGroup(FAIXA_RENDA_OPTIONS, briefingForm.faixaRenda, (newArr) => setBriefingForm({...briefingForm, faixaRenda: newArr}))}
                </div>
              </div>

              <hr className="border-zinc-800/40" />

              {/* Dor e desejo */}
              <div className="space-y-4">
                <h4 className={`text-xs font-bold ${themeColor}`}>3. Dor e desejo</h4>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Qual é o maior desejo ou sonho por trás dessa compra?</span>
                  {renderChipGroup(DESEJO_SONHO_OPTIONS, briefingForm.desejoSonho, (newArr) => setBriefingForm({...briefingForm, desejoSonho: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Quais são as objeções mais comuns?</span>
                  {renderChipGroup(OBJECOES_OPTIONS, briefingForm.objecoes, (newArr) => setBriefingForm({...briefingForm, objecoes: newArr}))}
                </div>
              </div>

              <hr className="border-zinc-800/40" />

              {/* Objetivo da peça */}
              <div className="space-y-4">
                <h4 className={`text-xs font-bold ${themeColor}`}>4. Objetivo da peça</h4>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Objetivo de marketing</span>
                  {renderChipGroup(OBJETIVO_MARKETING_OPTIONS, briefingForm.objetivoMarketing, (newArr) => setBriefingForm({...briefingForm, objetivoMarketing: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Etapa do funil</span>
                  {renderChipGroup(ETAPA_FUNIL_OPTIONS, briefingForm.etapaFunil, (newArr) => setBriefingForm({...briefingForm, etapaFunil: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Qual é a única ação que o público deve tomar?</span>
                  {renderChipGroup(ACAO_UNICA_OPTIONS, briefingForm.acaoUnica, (newArr) => setBriefingForm({...briefingForm, acaoUnica: newArr}))}
                </div>
              </div>

              <hr className="border-zinc-800/40" />

              {/* Tom e voz */}
              <div className="space-y-4">
                <h4 className={`text-xs font-bold ${themeColor}`}>5. Tom e voz</h4>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tom da peça</span>
                  {renderChipGroup(TOM_PECA_OPTIONS, briefingForm.tomPeca, (newArr) => setBriefingForm({...briefingForm, tomPeca: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Como a marca quer ser percebida?</span>
                  {renderChipGroup(COMO_MARCA_PERCEBIDA_OPTIONS, briefingForm.comoMarcaPercebida, (newArr) => setBriefingForm({...briefingForm, comoMarcaPercebida: newArr}))}
                </div>
              </div>

              <hr className="border-zinc-800/40" />

              {/* Formato e canal */}
              <div className="space-y-4">
                <h4 className={`text-xs font-bold ${themeColor}`}>6. Formato e canal</h4>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Canal de veiculação</span>
                  {renderChipGroup(CANAL_VEICULACAO_OPTIONS, briefingForm.canalVeiculacao, (newArr) => setBriefingForm({...briefingForm, canalVeiculacao: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Formato da peça</span>
                  {renderChipGroup(FORMATO_PECA_OPTIONS, briefingForm.formatoPeca, (newArr) => setBriefingForm({...briefingForm, formatoPeca: newArr}))}
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Extensão esperada do texto</span>
                  {renderChipGroup(EXTENSAO_TEXTO_OPTIONS, briefingForm.extensaoTexto, (newArr) => setBriefingForm({...briefingForm, extensaoTexto: newArr}))}
                </div>
              </div>

            </div>
          </div>
        ) : !briefingForm.isFilled ? (
          <div className="flex items-center justify-start py-1">
            <button 
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors shadow-lg"
            >
              + Adicionar Briefing
            </button>
          </div>
        ) : renderReadonlyBriefing()}
      </div>
      
      {/* Tabs Header */}
      {(!isEditing || briefingForm.isFilled) && (
        <div className="flex items-center gap-8 px-5 pt-6 pb-0 overflow-x-auto bg-transparent border-b border-zinc-900/50">
          {[
            { id: 'copy', label: 'Copy' },
            { id: 'aprovacao', label: 'Aprovação' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`relative pb-3 text-xs uppercase font-bold tracking-widest transition-colors ${
                  isActive 
                    ? themeColor
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className={`absolute left-0 right-0 bottom-0 h-[2px] rounded-t-sm bg-current`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content */}
      <div className="px-5 py-6 min-h-[250px]">
        {activeTab === 'copy' && (
          <div className="flex flex-col gap-6 animate-fade-in relative">
            <div className="flex items-center justify-end pb-2">
            <button
              onClick={() => {
                const editors = briefingForm.copyEditors || [];
                if (editors.length >= 5) {
                  setAlertMessage('Limite máximo de 5 editores atingido.');
                  setShowAlert(true);
                } else {
                  setShowNamePrompt(true);
                }
              }}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors shadow-lg"
            >
              + Adicionar Editor
            </button>
          </div>

          <div className="flex flex-col gap-8">
            {(briefingForm.copyEditors || []).map((editor) => (
              <div key={editor.id} className="flex flex-col bg-zinc-900/20 border border-zinc-800/40 rounded-xl overflow-hidden shadow-lg relative">
                {/* Editor Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#121214] border-b border-zinc-800/60">
                  <h4 className="text-xs font-bold text-pink-400 uppercase tracking-widest">{editor.name || 'Novo Editor'}</h4>
                </div>
                
                {/* Editor Body */}
                <div className="relative">
                  {!editor.name ? (
                    <div className="p-8 flex flex-col items-center justify-center gap-4 bg-zinc-900/40 min-h-[150px]">
                      <span className="text-sm font-semibold text-zinc-400">Dê um nome a este editor para começar a escrever</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          placeholder="Ex: Título, Variável 1..."
                          className="bg-[#121214] border border-zinc-700/50 rounded-lg px-4 py-2 text-sm text-zinc-200 outline-none focus:border-pink-500/50 min-w-[250px]"
                          id={`inline-name-${editor.id}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                const newEditors = briefingForm.copyEditors!.map(ed => ed.id === editor.id ? { ...ed, name: val } : ed);
                                const updatedBriefing = { ...briefingForm, copyEditors: newEditors };
                                setBriefingForm(updatedBriefing);
                                saveChange({ copyBriefing: updatedBriefing });
                              }
                            }
                          }}
                        />
                        <button 
                          onClick={() => {
                            const val = (document.getElementById(`inline-name-${editor.id}`) as HTMLInputElement).value.trim();
                            if (val) {
                              const newEditors = briefingForm.copyEditors!.map(ed => ed.id === editor.id ? { ...ed, name: val } : ed);
                              const updatedBriefing = { ...briefingForm, copyEditors: newEditors };
                              setBriefingForm(updatedBriefing);
                              saveChange({ copyBriefing: updatedBriefing });
                            }
                          }}
                          className="px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-transparent">
                      <RichTextEditor
                        taskId={editor.id}
                        content={editor.content}
                        variant="borderless"
                        onChange={(newContent) => {
                          const newEditors = briefingForm.copyEditors!.map(ed => ed.id === editor.id ? { ...ed, content: newContent } : ed);
                          const combinedText = newEditors.map(ed => `<h3>${ed.name}</h3>${ed.content}`).join('<br/><hr/><br/>');
                          const updatedBriefing = { ...briefingForm, copyEditors: newEditors, textoCopy: combinedText };
                          setBriefingForm(updatedBriefing);
                          saveChange({ copyBriefing: updatedBriefing });
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        {activeTab === 'aprovacao' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Botão de Adição (oculto se estiver vendo o painel) */}
            {!selectedApprovalDeliveryId && (
              <div className="flex flex-col">
                {!isCreatingDelivery && !editingDeliveryId && (
                  <div className="flex justify-start">
                    <button 
                      onClick={() => setIsCreatingDelivery(true)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-zinc-800/80 rounded hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-xs font-medium text-zinc-300"
                    >
                      <span className="text-pink-500 font-bold">+</span>
                      Nova Aprovação
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Formulário de Criação / Edição */}
            {(isCreatingDelivery || editingDeliveryId) && (
              <div className="flex flex-col gap-4 bg-[#0a0a0c] border border-zinc-800/80 p-5 rounded-lg animate-fade-in">
                <h4 className="text-xs font-bold text-pink-400 uppercase tracking-widest">Nova Aprovação de Copy</h4>
                
                <div className="flex flex-col gap-2 relative">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Selecione o Editor</label>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEditorSelectOpen(!isEditorSelectOpen)}
                      className={`w-full flex items-center justify-between bg-[#121214] border ${isEditorSelectOpen ? 'border-pink-500/50 shadow-[0_0_0_2px_rgba(236,72,153,0.1)]' : 'border-zinc-800/80'} hover:border-zinc-700/80 rounded-lg px-4 py-2.5 text-sm text-left transition-all outline-none`}
                    >
                      <span className={selectedCopyEditorId ? 'text-zinc-200 font-medium' : 'text-zinc-500'}>
                        {selectedCopyEditorId 
                          ? (briefingForm.copyEditors?.find(e => e.id === selectedCopyEditorId)?.name || 'Editor não encontrado')
                          : 'Selecione um editor...'}
                      </span>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${isEditorSelectOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isEditorSelectOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsEditorSelectOpen(false)} />
                        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-50 bg-[#18181b] border border-zinc-800/80 rounded-lg shadow-xl overflow-hidden animate-fade-in flex flex-col py-1">
                          <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Editores Disponíveis</span>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                            {(briefingForm.copyEditors || []).filter(ed => ed.name && ed.content).length === 0 && (
                              <div className="px-3 py-4 text-center text-xs text-zinc-500 italic">
                                Nenhum editor com conteúdo.
                              </div>
                            )}
                            {(briefingForm.copyEditors || []).filter(ed => ed.name && ed.content).map(ed => (
                              <button
                                key={ed.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCopyEditorId(ed.id);
                                  setIsEditorSelectOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                                  selectedCopyEditorId === ed.id 
                                    ? 'bg-pink-500/10 text-pink-400 font-medium' 
                                    : 'text-zinc-300 hover:bg-zinc-800/60'
                                }`}
                              >
                                <span>{ed.name}</span>
                                {selectedCopyEditorId === ed.id && <Check size={14} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 relative">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Selecione o Aprovador</label>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsApproverSelectOpen(!isApproverSelectOpen)}
                      className={`w-full flex items-center justify-between bg-[#121214] border ${isApproverSelectOpen ? 'border-pink-500/50 shadow-[0_0_0_2px_rgba(236,72,153,0.1)]' : 'border-zinc-800/80'} hover:border-zinc-700/80 rounded-lg px-4 py-2.5 text-sm text-left transition-all outline-none`}
                    >
                      <span className={selectedApproverId ? 'text-zinc-200 font-medium' : 'text-zinc-500'}>
                        {selectedApproverId 
                          ? (USERS.find(u => u.id === selectedApproverId)?.name || 'Usuário não encontrado')
                          : 'Selecione um aprovador...'}
                      </span>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${isApproverSelectOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isApproverSelectOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsApproverSelectOpen(false)} />
                        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-50 bg-[#18181b] border border-zinc-800/80 rounded-lg shadow-xl overflow-hidden animate-fade-in flex flex-col py-1">
                          <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Aprovadores Disponíveis</span>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                            {sortedUsers.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setSelectedApproverId(u.id);
                                  setIsApproverSelectOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                                  selectedApproverId === u.id 
                                    ? 'bg-pink-500/10 text-pink-400 font-medium' 
                                    : 'text-zinc-300 hover:bg-zinc-800/60'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                                  <span>{u.name}</span>
                                </div>
                                {selectedApproverId === u.id && <Check size={14} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Defesa Criativa</label>
                  <textarea
                    value={copyDefense}
                    onChange={(e) => setCopyDefense(e.target.value)}
                    placeholder="Explique suas escolhas de copy..."
                    className="bg-[#121214] border border-zinc-800/80 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-pink-500/50 min-h-[100px] resize-y"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setIsCreatingDelivery(false);
                      setEditingDeliveryId(null);
                      setSelectedCopyEditorId('');
                      setSelectedApproverId('');
                      setCopyDefense('');
                    }}
                    className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={!selectedCopyEditorId}
                    onClick={() => {
                      const editor = briefingForm.copyEditors?.find(e => e.id === selectedCopyEditorId);
                      if (!editor) return;

                      const now = new Date().toISOString();
                      let newDeliveries = [...(briefingForm.deliveries || [])];
                      
                      if (editingDeliveryId) {
                        // Normally not editing existing copy submissions like this, but kept for compatibility
                        newDeliveries = newDeliveries.map(d => 
                          d.id === editingDeliveryId ? { ...d } : d
                        );
                      } else {
                        const newId = Date.now().toString();
                        newDeliveries.push({
                          id: newId,
                          status: 'pending',
                          approverId: selectedApproverId || undefined,
                          thread: [{
                            id: newId + '-sub',
                            role: 'designer',
                            type: 'submission',
                            content: copyDefense || 'Nova entrega de copy',
                            copyText: editor.content,
                            editorName: editor.name,
                            createdAt: now
                          }],
                          createdAt: now
                        });
                        
                        if (selectedApproverId) {
                          addNotification({
                            userId: selectedApproverId,
                            actorId: currentUser?.id || 'system',
                            taskId: task.id,
                            type: 'review_requested',
                            message: 'Aprovação de Copy',
                            details: `Você foi selecionado para aprovar a copy "${editor.name}" na tarefa "${task.title}".`,
                            targetId: `copy-delivery-${newId}`
                          });
                        }
                      }
                      
                      const updatedBriefing = { ...briefingForm, deliveries: newDeliveries };
                      setBriefingForm(updatedBriefing);
                      
                      const taskUpdates: Partial<Task> = { copyBriefing: updatedBriefing };
                      if (task.status !== 'approval') {
                        taskUpdates.status = 'approval';
                      }
                      saveChange(taskUpdates);
                      
                      setIsCreatingDelivery(false);
                      setEditingDeliveryId(null);
                      setSelectedCopyEditorId('');
                      setSelectedApproverId('');
                      setCopyDefense('');
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} /> Enviar copy para aprovação
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Cards ou Painel */}
            {!isCreatingDelivery && !editingDeliveryId && (
              <div className="flex flex-col gap-4">
                {selectedApprovalDeliveryId ? (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <button 
                      onClick={() => setSelectedApprovalDeliveryId(null)}
                      className="text-xs font-bold text-pink-500 hover:text-pink-400 self-start mb-2 tracking-wider flex items-center gap-1"
                    >
                      &larr; VOLTAR PARA LISTA
                    </button>
                    {selectedApprovalDeliveryId && briefingForm.deliveries && (
                      <CopyApprovalPanel 
                        delivery={briefingForm.deliveries.find(d => d.id === selectedApprovalDeliveryId)!}
                        currentText={
                          briefingForm.copyEditors?.find(e => {
                              const delivery = briefingForm.deliveries!.find(d => d.id === selectedApprovalDeliveryId)!;
                              const subs = delivery.thread?.filter(t => t.type === 'submission') || [];
                              const lastSub = subs.length > 0 ? subs[subs.length - 1] : null;
                              return e.name === lastSub?.editorName;
                          })?.content
                        }
                        onClose={() => setSelectedApprovalDeliveryId(null)}
                        onUpdate={(id, updates) => {
                          const oldDelivery = briefingForm.deliveries?.find(d => d.id === id);
                          const newDeliveries = briefingForm.deliveries!.map(d => 
                            d.id === id ? { ...d, ...updates } : d
                          );
                          const updatedBriefing = { ...briefingForm, deliveries: newDeliveries };
                          setBriefingForm(updatedBriefing);

                          let taskUpdates: Partial<Task> = { copyBriefing: updatedBriefing };
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

                          if (updates.status && oldDelivery?.status !== updates.status) {
                            if (updates.status === 'approved') {
                              if (task.assigneeId) {
                                addNotification({
                                  userId: task.assigneeId,
                                  actorId: currentUser?.id || '',
                                  message: 'Copy Aprovada! 🎉',
                                  details: `A copy da tarefa "${task.title}" foi aprovada.`,
                                  type: 'approved',
                                  taskId: task.id,
                                  targetId: `copy-delivery-${id}`
                                });
                              }
                            } else if (updates.status === 'reworking') {
                              if (task.assigneeId) {
                                addNotification({
                                  userId: task.assigneeId,
                                  actorId: currentUser?.id || '',
                                  message: 'Reprovação de Copy',
                                  details: `A copy da tarefa "${task.title}" foi reprovada e precisa de ajustes.`,
                                  type: 'rejected',
                                  taskId: task.id,
                                  targetId: `copy-delivery-${id}`
                                });
                              }
                            } else if (updates.status === 'review_requested') {
                              const targetUserId = oldDelivery?.approverId;
                              if (targetUserId) {
                                addNotification({
                                  userId: targetUserId,
                                  actorId: currentUser?.id || '',
                                  message: 'Revisão Solicitada',
                                  details: `O redator solicitou revisão da copy na tarefa "${task.title}".`,
                                  type: 'review_requested',
                                  taskId: task.id,
                                  targetId: `copy-delivery-${id}`
                                });
                              }
                            }
                          }
                        }}
                      />
                    )}
                  </div>
                ) : (
                  briefingForm.deliveries?.map((delivery) => {
                    const latestSubmission = delivery.thread?.filter(t => t.type === 'submission').pop();
                    const editorName = latestSubmission?.editorName || 'COPY SEM NOME';
                    const createdAtDate = new Date(latestSubmission?.createdAt || delivery.createdAt);
                    const formattedDate = createdAtDate.toLocaleDateString('pt-BR') + ' às ' + createdAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const submissions = delivery.thread?.filter(t => t.type === 'submission') || [];
                    const revisionNumber = submissions.length || 1;

                    let statusDisplay = 'Aguardando avaliação';
                    let statusColor = 'text-pink-500';
                    let statusBg = 'bg-pink-500/10 border-pink-500/20';

                    if (delivery.status === 'reworking') {
                      statusDisplay = 'Em Ajustes';
                      statusColor = 'text-yellow-500';
                      statusBg = 'bg-yellow-500/10 border-yellow-500/20';
                    } else if (delivery.status === 'approved') {
                      statusDisplay = 'Aprovado';
                      statusColor = 'text-emerald-500';
                      statusBg = 'bg-emerald-500/10 border-emerald-500/20';
                    } else if (delivery.status === 'rejected') {
                      statusDisplay = 'Reprovado';
                      statusColor = 'text-red-500';
                      statusBg = 'bg-red-500/10 border-red-500/20';
                    }

                    return (
                      <div 
                        id={`target-copy-delivery-${delivery.id}`}
                        key={delivery.id} 
                        onClick={() => setSelectedApprovalDeliveryId(delivery.id)}
                        className="group flex items-center justify-between p-3 rounded-md border border-zinc-800/40 bg-transparent hover:bg-zinc-800/30 hover:border-zinc-700/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="h-6 px-2 rounded bg-[#1C1C21] flex items-center justify-center text-[10px] font-mono text-zinc-500 shrink-0 border border-zinc-800/50">
                            REV {revisionNumber}
                          </div>
                          <div className={`h-6 px-2 rounded-sm border flex items-center justify-center text-[10px] font-medium shrink-0 ${statusColor} ${statusBg}`}>
                            {statusDisplay}
                          </div>
                          <div className="flex flex-col gap-0.5 ml-2">
                            <span className="text-zinc-200 font-medium text-sm truncate" title={editorName}>{editorName}</span>
                            <span className="text-zinc-500 text-xs">Responsável | {formattedDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0 gap-2">
                           <div className="text-zinc-500 group-hover:text-pink-400 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-medium pr-2">
                             Abrir Painel &rarr;
                           </div>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(delivery.id); }} 
                             className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" 
                             title="Excluir Aprovação"
                           >
                             <Trash2 size={14} />
                           </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 w-full max-w-sm shadow-2xl animate-slide-down">
            <h3 className="text-lg font-bold text-zinc-200">Nome do Editor</h3>
            <p className="text-xs text-zinc-400">Qual será o nome deste novo editor? (Ex: Copy Principal, Assunto do Email)</p>
            <input 
              type="text"
              autoFocus
              value={newEditorName}
              onChange={e => setNewEditorName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newEditorName.trim()) {
                  const newEditors = [...(briefingForm.copyEditors || []), { id: Date.now().toString(), name: newEditorName.trim(), content: '' }];
                  const updatedBriefing = { ...briefingForm, copyEditors: newEditors };
                  setBriefingForm(updatedBriefing);
                  saveChange({ copyBriefing: updatedBriefing });
                  setNewEditorName('');
                  setShowNamePrompt(false);
                }
              }}
              className="bg-[#0c0c0e] border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-pink-500/50 w-full"
              placeholder="Digite o nome..."
            />
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => {
                  setShowNamePrompt(false);
                  setNewEditorName('');
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (newEditorName.trim()) {
                    const newEditors = [...(briefingForm.copyEditors || []), { id: Date.now().toString(), name: newEditorName.trim(), content: '' }];
                    const updatedBriefing = { ...briefingForm, copyEditors: newEditors };
                    setBriefingForm(updatedBriefing);
                    saveChange({ copyBriefing: updatedBriefing });
                    setNewEditorName('');
                    setShowNamePrompt(false);
                  }
                }}
                disabled={!newEditorName.trim()}
                className="px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 disabled:opacity-50 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121214] border border-red-900/30 rounded-2xl p-6 flex flex-col gap-4 w-full max-w-sm shadow-[0_0_40px_rgba(220,38,38,0.1)] animate-slide-down">
            <h3 className="text-lg font-bold text-red-500">Atenção</h3>
            <p className="text-sm text-zinc-300">{alertMessage}</p>
            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setShowAlert(false)}
                className="px-5 py-2 text-sm font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-900/50 rounded-lg transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmModal
          isOpen={true}
          title="Excluir Aprovação"
          message="Tem certeza que deseja excluir esta aprovação de copy? Todo o histórico de revisões será perdido. Esta ação não pode ser desfeita."
          confirmText="Excluir"
          onConfirm={() => {
            const newDeliveries = briefingForm.deliveries?.filter(d => d.id !== deleteConfirmId) || [];
            const updatedBriefing = { ...briefingForm, deliveries: newDeliveries };
            setBriefingForm(updatedBriefing);
            saveChange({ copyBriefing: updatedBriefing });
            setDeleteConfirmId(null);
          }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
