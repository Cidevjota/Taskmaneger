import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NOTIFICATION_GROUPS, DEADLINE_MILESTONES, isNotificationTypeEnabled } from '../lib/notificationTypes';

interface PreferencesModalProps {
  onClose: () => void;
}

export default function PreferencesModal({ onClose }: PreferencesModalProps) {
  const { currentUser, updateProfile } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NOTIFICATION_GROUPS.forEach(group => {
      group.types.forEach(({ type }) => {
        initial[type] = isNotificationTypeEnabled(currentUser?.preferences, type);
      });
    });
    return initial;
  });
  const [deadlinePrefs, setDeadlinePrefs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEADLINE_MILESTONES.forEach(({ key }) => {
      initial[key] = isNotificationTypeEnabled(currentUser?.preferences, 'deadline', key);
    });
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) return null;

  const toggle = (type: string) => {
    setPrefs(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleDeadline = (key: string) => {
    setDeadlinePrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateProfile({
      preferences: {
        ...currentUser.preferences,
        notifications: {
          ...prefs,
          deadline: deadlinePrefs,
        },
      },
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121214] border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]">

        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-200">Preferências de Notificação</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 overflow-y-auto">
          <p className="text-xs text-zinc-500">
            Escolha quais notificações você deseja receber. Você ainda poderá ver tudo na Central de Notificações.
          </p>
          {NOTIFICATION_GROUPS.map(group => (
            <div key={group.label} className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">{group.label}</label>
              <div className="flex flex-col gap-1.5">
                {group.types.map(({ type, label }) => (
                  <label
                    key={type}
                    className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <span className="text-xs text-zinc-300">{label}</span>
                    <input
                      type="checkbox"
                      checked={!!prefs[type]}
                      onChange={() => toggle(type)}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Deadline milestones — each fires as its own alert, so each gets its own toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Prazo Vencendo</label>
            <div className="flex flex-col gap-1.5">
              {DEADLINE_MILESTONES.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <span className="text-xs text-zinc-300">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!deadlinePrefs[key]}
                    onChange={() => toggleDeadline(key)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
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
