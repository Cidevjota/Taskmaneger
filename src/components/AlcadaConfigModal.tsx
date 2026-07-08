import React, { useState } from 'react';
import { X, Settings, User, ChevronDown, Save, Loader2 } from 'lucide-react';
import { useAuth, UserProfile } from '../context/AuthContext';
import { SiengeAlcadaConfig } from '../types';

interface AlcadaConfigModalProps {
  config: SiengeAlcadaConfig;
  onClose: () => void;
  onSave: (config: SiengeAlcadaConfig) => Promise<void> | void;
}

function ResponsavelPicker({
  label,
  users,
  value,
  onChange,
}: {
  label: string;
  users: UserProfile[];
  value?: string;
  onChange: (userId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = users.find(u => u.id === value);

  return (
    <div className="space-y-1.5 relative">
      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
        <User size={13} className="text-zinc-500" />
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(p => !p)}
        className="w-full bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-100 flex items-center justify-between cursor-pointer transition-all"
      >
        <div className="flex items-center gap-2">
          {selected ? (
            <>
              {selected.avatarUrl ? (
                <img src={selected.avatarUrl} alt={selected.name} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">
                  {selected.initials}
                </div>
              )}
              <span>{selected.name}</span>
            </>
          ) : (
            <span className="text-zinc-500">Selecionar responsável...</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181b] border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="max-h-48 overflow-y-auto">
              {users.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { onChange(user.id); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800/50 transition-colors ${value === user.id ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300'}`}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">
                      {user.initials}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-[10px] text-zinc-500">{user.role}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AlcadaConfigModal({ config, onClose, onSave }: AlcadaConfigModalProps) {
  const { allUsers } = useAuth();
  const [alcada1UserId, setAlcada1UserId] = useState(config.alcada1UserId || '');
  const [alcada2UserId, setAlcada2UserId] = useState(config.alcada2UserId || '');
  const [alcada3UserId, setAlcada3UserId] = useState(config.alcada3UserId || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        alcada1UserId: alcada1UserId || undefined,
        alcada2UserId: alcada2UserId || undefined,
        alcada3UserId: alcada3UserId || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className="bg-[#121214] border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Settings size={15} className="text-zinc-400" />
            Responsáveis por Alçada
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-zinc-500">
            Defina quem recebe a notificação em cada etapa de aprovação dos títulos.
          </p>
          <ResponsavelPicker label="1ª Alçada" users={allUsers} value={alcada1UserId} onChange={setAlcada1UserId} />
          <ResponsavelPicker label="2ª Alçada" users={allUsers} value={alcada2UserId} onChange={setAlcada2UserId} />
          <ResponsavelPicker label="3ª Alçada" users={allUsers} value={alcada3UserId} onChange={setAlcada3UserId} />
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800/50 shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md shadow-sm transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
