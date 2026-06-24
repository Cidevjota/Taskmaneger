import React, { useState } from 'react';
import { 
  Settings, 
  Terminal, 
  Moon, 
  Sun, 
  Palette, 
  Keyboard, 
  Database, 
  Sparkles, 
  Sliders, 
  Info,
  Layers
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface SettingsViewProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onResetMockData: () => void;
}

export default function SettingsView({
  isDarkMode,
  onToggleDarkMode,
  onResetMockData
}: SettingsViewProps) {
  const [selectedThemePreset, setSelectedThemePreset] = useState<'linear' | 'notion' | 'oled'>('linear');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isAlert?: boolean;
    confirmAction?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const saveThemePreset = (preset: 'linear' | 'notion' | 'oled') => {
    setSelectedThemePreset(preset);
    // Auto sync dark state based on preset
    if (preset === 'notion' && isDarkMode) {
      onToggleDarkMode(); // Switch to light
    } else if ((preset === 'linear' || preset === 'oled') && !isDarkMode) {
      onToggleDarkMode(); // Switch to dark
    }
  };

  const handleShortcutTest = () => {
    setModalState({
      isOpen: true,
      title: 'Atalho testado!',
      message: 'Para abrir a Paleta de Comandos de verdade, basta pressionar Cmd + K (ou Ctrl + K) a qualquer momento.',
      isAlert: true,
      confirmAction: () => setModalState(prev => ({ ...prev, isOpen: false }))
    });
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto select-none space-y-6 max-w-4xl text-zinc-200 bg-[#08080a]">
      
      {/* Title page */}
      <div className="flex items-center gap-2.5 bg-zinc-950/50 p-4 rounded-lg border border-zinc-900">
        <Settings size={15} className="text-zinc-400" />
        <div>
          <h2 className="text-xs font-semibold text-zinc-350 uppercase tracking-widest font-mono">Ajustes Globais</h2>
          <p className="text-[10px] text-zinc-550 font-sans">Gerenciar preferências visuais, atalhos de produtividade e dados do seu workspace local.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Visual Settings block */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold font-mono text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-zinc-900 shrink-0">
            <Palette size={12} className="text-zinc-450" />
            <span>Aparência & Tema</span>
          </h3>

          <div className="space-y-4">
            {/* Toggle dark mode button */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium block text-zinc-300">Modo Escuro Permanente</span>
                <span className="text-[10px] text-zinc-650">Suporte a paletas escuras premium (Linear e Vercel)</span>
              </div>
              <button
                className="w-10 h-6 bg-zinc-900 border border-zinc-805 rounded-full relative flex items-center p-0.5 transition-all outline-none cursor-not-allowed"
                disabled
              >
                <div className="w-4 h-4 rounded-full bg-zinc-400 shadow-md transform translate-x-4 flex items-center justify-center">
                  <Moon size={9} className="text-zinc-900" />
                </div>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-xs font-medium block text-zinc-350">Tema do Workspace</span>
              <div className="grid grid-cols-3 gap-2 text-xs font-sans font-medium">
                <button
                  onClick={() => saveThemePreset('linear')}
                  className={`p-2.5 rounded border text-left flex flex-col justify-between transition-all ${
                    selectedThemePreset === 'linear'
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm'
                      : 'bg-zinc-950 border-zinc-900 text-zinc-550 hover:bg-zinc-900/40'
                  }`}
                >
                  <span className="font-semibold text-zinc-200">Linear Dark</span>
                  <span className="text-[9px] text-zinc-555">Grafite Subtil</span>
                </button>

                <button
                  onClick={() => saveThemePreset('notion')}
                  className={`p-2.5 rounded border text-left flex flex-col justify-between transition-all ${
                    selectedThemePreset === 'notion'
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm'
                      : 'bg-zinc-950 border-zinc-900 text-zinc-555 hover:bg-zinc-900/40'
                  }`}
                >
                  <span className="font-semibold text-zinc-200">Notion Dark</span>
                  <span className="text-[9px] text-zinc-555">Contraste Claro</span>
                </button>

                <button
                  onClick={() => saveThemePreset('oled')}
                  className={`p-2.5 rounded border text-left flex flex-col justify-between transition-all ${
                    selectedThemePreset === 'oled'
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-sm'
                      : 'bg-zinc-950 border-zinc-900 text-zinc-555 hover:bg-zinc-900/40'
                  }`}
                >
                  <span className="font-semibold text-zinc-200">OLED Pure</span>
                  <span className="text-[9px] text-zinc-555">Preto Absoluto</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Shortcuts overview list block */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold font-mono text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-zinc-900">
            <Keyboard size={12} className="text-zinc-450" />
            <span>Produtividade (Hotkeys)</span>
          </h3>

          <div className="space-y-3 font-mono text-[10px] text-zinc-500 select-none">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span>Paleta de Comandos</span>
              <kbd className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900 text-zinc-400">�R� + K</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span>Criar Nova Tarefa</span>
              <kbd className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900 text-zinc-400">Clique rápido (C)</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span>Fechar Modais / Gaveta</span>
              <kbd className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900 text-zinc-400">ESC</kbd>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span>Alternar Sidebar</span>
              <kbd className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900 text-zinc-400">Trigger Lateral</kbd>
            </div>

            <button
              onClick={handleShortcutTest}
              className="w-full mt-2 h-7 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[10px] rounded text-zinc-300 flex items-center justify-center gap-1.5 font-semibold transition-colors"
            >
              <span>Testar Evento Cmd+K</span>
            </button>
          </div>
        </div>

        {/* Database administration block */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold font-mono text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-zinc-900">
            <Database size={12} className="text-zinc-450" />
            <span>Estado da Aplicação</span>
          </h3>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 pl-1 bg-amber-500/5 p-2.5 rounded border border-amber-500/10 text-[10px] text-amber-550 leading-relaxed">
              <Info size={12} className="shrink-0 text-amber-600" />
              <span>
                Esta aplicação salva todas as alterações de forma reativa localmente para que os seus dados permaneçam mantidos na próxima visita de teste.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-medium block text-zinc-350">Redefinir registros locais</span>
                <span className="text-[10px] text-zinc-650">Apagar as alterações locais e carregar o lote original do SaaS</span>
              </div>
              <button
                onClick={() => {
                  setModalState({
                    isOpen: true,
                    title: 'Atenção',
                    message: 'Deseja realmente redefinir o banco de dados? Isso apagará todas as tarefas criadas.',
                    isAlert: false,
                    confirmAction: () => {
                      onResetMockData();
                      setModalState({
                        isOpen: true,
                        title: 'Sucesso',
                        message: 'Dados restaurados com sucesso para o lote original!',
                        isAlert: true,
                        confirmAction: () => setModalState(prev => ({ ...prev, isOpen: false }))
                      });
                    }
                  });
                }}
                className="h-8 bg-red-950/20 hover:bg-red-900/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-xs font-medium px-3.5 rounded transition-all"
              >
                Limpar Database
              </button>
            </div>
          </div>
        </div>

        {/* Brand visual showcase instead of server logs/telemetry */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-lg p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-bold font-mono text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-zinc-900">
              <Sparkles size={12} className="text-zinc-450" />
              <span>Identidade Visual</span>
            </h3>

            <p className="text-[11px] text-zinc-500 font-sans leading-relaxed">
              Inspirado pela simplicidade e velocidade do Linear App. Focado em tipografia balanceada, cantos arredondados discretos e interação simplificada para maximizar o foco do desenvolvedor.
            </p>
          </div>

          <div className="pt-4 flex items-center gap-2 text-[9px] text-zinc-650 font-mono">
            <span>�� PRODUTO EM DESIGN DE ALTA FIDELIDADE</span>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        cancelText={modalState.isAlert ? null : "Cancelar"}
        confirmText={modalState.isAlert ? "OK" : "Confirmar"}
        onConfirm={() => {
          if (modalState.confirmAction) modalState.confirmAction();
        }}
        onCancel={() => {
          setModalState(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}
