import React, { useState, useEffect } from 'react';
import { Task, PlanningBriefing, Attachment } from '../types';
import { ChevronDown, ChevronRight, FileText, Upload, Plus, File as FileIcon, X, Trash2, Check, Edit2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface PlanningPropertiesProps {
  task: Task;
  saveChange: (updates: Partial<Task>) => void;
  themeColor?: string;
}

export default function PlanningProperties({ task, saveChange, themeColor = 'text-blue-400' }: PlanningPropertiesProps) {
  const [briefingData, setBriefingData] = useState<PlanningBriefing>(
    task.planningBriefing || { text: '', attachments: [], isFilled: false }
  );
  const [isEditing, setIsEditing] = useState(!briefingData.isFilled);
  const [activeTab, setActiveTab] = useState<'descricao' | 'arquivos'>('descricao');

  useEffect(() => {
    if (task.planningBriefing) {
      setBriefingData(task.planningBriefing);
      if (task.planningBriefing.isFilled && isEditing) {
        setIsEditing(false);
      }
    }
  }, [task.planningBriefing]);

  const handleSaveBriefing = () => {
    const newData = { ...briefingData, isFilled: true };
    setBriefingData(newData);
    saveChange({ planningBriefing: newData });
    setIsEditing(false);
  };

  const handleUpdateText = (text: string) => {
    const newData = { ...briefingData, text };
    setBriefingData(newData);
    saveChange({ planningBriefing: newData });
  };

  const handleAddSimulatedAttachment = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const newAttachment: Attachment = {
          id: `file-${Date.now()}`,
          name: file.name,
          url: URL.createObjectURL(file), // Visual placeholder
          size: file.size
        };
        const newData = { 
          ...briefingData, 
          attachments: [...(briefingData.attachments || []), newAttachment] 
        };
        setBriefingData(newData);
        saveChange({ planningBriefing: newData });
      }
    };
    input.click();
  };

  const handleRemoveAttachment = (id: string) => {
    const newData = {
      ...briefingData,
      attachments: (briefingData.attachments || []).filter(a => a.id !== id)
    };
    setBriefingData(newData);
    saveChange({ planningBriefing: newData });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleToggleArrayItem = (field: keyof PlanningBriefing, item: string) => {
    const currentArray = (briefingData[field] as string[]) || [];
    const newArray = currentArray.includes(item)
      ? currentArray.filter((i: string) => i !== item)
      : [...currentArray, item];
    const newData = { ...briefingData, [field]: newArray };
    setBriefingData(newData);
    saveChange({ planningBriefing: newData });
  };

  const handleFieldChange = (field: keyof PlanningBriefing, value: string) => {
    const newData = { ...briefingData, [field]: value };
    setBriefingData(newData);
    saveChange({ planningBriefing: newData });
  };

  const renderReadonlyBriefing = () => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
            Briefing de Planejamento
          </h3>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <Edit2 size={10} /> Editar
          </button>
        </div>
        
        <div className="flex flex-col gap-6 animate-fade-in pl-2">
          
          {briefingData.objetivosPrincipais && briefingData.objetivosPrincipais.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Objetivo</span>
              <p className="text-sm text-zinc-300">{briefingData.objetivosPrincipais.join(', ')} {briefingData.objetivoAberto ? `- ${briefingData.objetivoAberto}` : ''}</p>
            </div>
          )}

          {briefingData.motivacoes && briefingData.motivacoes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Motivação</span>
              <p className="text-sm text-zinc-300">{briefingData.motivacoes.join(', ')} {briefingData.motivacaoAberta ? `- ${briefingData.motivacaoAberta}` : ''}</p>
            </div>
          )}

          {briefingData.campanhaConectada && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Campanha conectada</span>
              <p className="text-sm text-zinc-300">{briefingData.campanhaConectada}</p>
            </div>
          )}

          {briefingData.publicoAlvo && briefingData.publicoAlvo.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Público-alvo</span>
              <p className="text-sm text-zinc-300">{briefingData.publicoAlvo.join(', ')}</p>
            </div>
          )}

          {briefingData.nivelConhecimento && briefingData.nivelConhecimento.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Nível de conhecimento</span>
              <p className="text-sm text-zinc-300">{briefingData.nivelConhecimento.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCheckboxGroup = (title: string, field: keyof PlanningBriefing, options: string[], openField?: { key: keyof PlanningBriefing, placeholder: string }) => (
    <div className="space-y-3">
      <h4 className={`text-[12px] font-bold ${themeColor}`}>{title}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = ((briefingData[field] as string[]) || []).includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleToggleArrayItem(field, opt)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                isSelected
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                  : 'bg-[#1f2937]/30 text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2937]/60 border border-transparent'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {openField && (
        <input 
          type="text" 
          value={(briefingData[openField.key] as string) || ''}
          onChange={e => handleFieldChange(openField.key, e.target.value)}
          placeholder={openField.placeholder}
          className="mt-1 bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500/50 w-full max-w-sm"
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col bg-[#08080a]/40 rounded-md border border-zinc-900/40 animate-slide-down overflow-hidden mt-2">
      {/* SECTION 1: BRIEFING QUESTIONNAIRE */}
      <div className="p-5 border-b border-zinc-900/50">
        {isEditing ? (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-semibold font-sans uppercase tracking-wider flex items-center gap-1.5 ${themeColor}`}>
                Briefing Planejamento
              </h3>
            </div>
            
            <div className="flex flex-col gap-6">
              {renderCheckboxGroup(
                "1. Qual é o objetivo principal dessa ação?",
                "objetivosPrincipais",
                ['Gerar leads', 'Posicionamento', 'Aumentar reconhecimento', 'Vender unidades', 'Fortalecer relacionamento', 'Fazer/Divulgar Evento', 'Manutenção'],
                { key: 'objetivoAberto', placeholder: 'Outro objetivo...' }
              )}
              
              {renderCheckboxGroup(
                "2. O que está motivando essa ação agora?",
                "motivacoes",
                ['Lançamento de novo empreendimento', 'Fase de obras', 'Últimas unidades disponíveis', 'Data sazonal', 'Manter relacionamento', 'Resposta a movimento da concorrência'],
                { key: 'motivacaoAberta', placeholder: 'Outra motivação...' }
              )}

              <div className="flex flex-col gap-2">
                <h4 className={`text-[12px] font-bold ${themeColor}`}>3. Essa ação está conectada a uma campanha maior já em andamento?</h4>
                <input 
                  type="text" 
                  value={briefingData.campanhaConectada || ''}
                  onChange={e => handleFieldChange('campanhaConectada', e.target.value)}
                  placeholder="Ex: Sim, campanha de fim de ano..."
                  className="mt-1 bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500/50 w-full max-w-sm"
                />
              </div>

              {renderCheckboxGroup(
                "4. Quem é o público dessa ação?",
                "publicoAlvo",
                ['Alto padrão', 'Médio alto padrão', 'Investidores', 'Corretores', 'Clientes atuais']
              )}

              {renderCheckboxGroup(
                "5. Esse público já conhece a marca/empreendimento?",
                "nivelConhecimento",
                ['Sim, já é cliente/Corretor', 'Conhece empreendimentos por anúncios', 'Já visitou decorado / mas não comprou', 'Já ouviu falar do empreendimento/construtora', 'Não conhece, é primeiro contato']
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end pt-4 border-t border-zinc-800/40">
              <button
                onClick={handleSaveBriefing}
                className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-md border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
              >
                <Check size={14} /> Salvar Briefing
              </button>
            </div>
          </div>
        ) : !briefingData.isFilled ? (
          <div className="flex items-center justify-start">
            <button 
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors shadow-lg"
            >
              + Adicionar Briefing de Planejamento
            </button>
          </div>
        ) : (
          renderReadonlyBriefing()
        )}
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-8 px-5 pt-6 pb-0 overflow-x-auto bg-transparent border-b border-zinc-900/50">
        {[
          { id: 'descricao', label: 'Descrição Livre' },
          { id: 'arquivos', label: 'Arquivos & Documentos' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'descricao' | 'arquivos')}
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

      {/* Tab Content */}
      <div className="px-5 py-6 min-h-[250px]">
        {activeTab === 'descricao' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <RichTextEditor 
              taskId={`planning-${task.id}`}
              content={briefingData.text} 
              onChange={handleUpdateText}
              variant="borderless"
            />
          </div>
        )}

        {activeTab === 'arquivos' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div 
              onClick={handleAddSimulatedAttachment}
              className="border-2 border-dashed border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-800/30 transition-colors rounded-lg flex flex-col items-center justify-center p-8 cursor-pointer group max-w-2xl"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors">
                <Upload size={20} className="text-zinc-400" />
              </div>
              <span className="text-sm font-medium text-zinc-300">Clique para anexar arquivo</span>
              <span className="text-xs text-zinc-500 mt-1">Simulação de upload em memória</span>
            </div>

            {/* Attachments List */}
            {briefingData.attachments && briefingData.attachments.length > 0 && (
              <div className="flex flex-col gap-2 mt-4 max-w-2xl">
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">Arquivos Anexados ({briefingData.attachments.length})</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {briefingData.attachments.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-3 rounded-md bg-zinc-800/40 border border-zinc-700/30 group hover:border-zinc-600 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded bg-zinc-700/50 flex items-center justify-center shrink-0">
                          <FileIcon size={18} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium text-zinc-200 truncate pr-2" title={file.name}>{file.name}</span>
                          <span className="text-xs text-zinc-500">{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveAttachment(file.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors shrink-0"
                        title="Remover arquivo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
