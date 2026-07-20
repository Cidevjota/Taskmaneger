import React, { useState, useRef } from 'react';
import { X, Camera, Save, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { uploadToStorage, UPLOAD_LIMITS } from '../lib/storage';
import PreferencesModal from './PreferencesModal';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { currentUser, updateProfile } = useAuth();
  const { addNotification } = useNotifications();
  
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [role, setRole] = useState(currentUser?.role || '');
  const [password, setPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatarUrl || '');
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.avatar) {
      setError(`A imagem deve ter no máximo ${UPLOAD_LIMITS.avatar / (1024 * 1024)}MB.`);
      return;
    }
    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  };

  if (!currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const updates: any = {};
      if (name !== currentUser.name) updates.name = name;
      if (email !== currentUser.email) updates.email = email;
      if (role !== currentUser.role) updates.role = role;

      if (pendingAvatarFile) {
        const url = await uploadToStorage('avatars', currentUser.id, pendingAvatarFile, UPLOAD_LIMITS.avatar);
        updates.avatarUrl = url;
      }

      const res = await updateProfile(updates, password || undefined);

      if (res.success) {
        addNotification({
          userId: currentUser.id,
          actorId: 'system',
          taskId: 'system',
          type: 'properties_changed',
          message: 'Perfil atualizado',
          details: 'Seus dados foram salvos com sucesso.'
        });
        onClose();
      } else {
        setError(res.error || 'Erro ao salvar o perfil.');
        setIsSaving(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar imagem.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121214] border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-200">Editar Perfil</h2>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          
          {/* Avatar Section */}
          <div className="flex items-center gap-4 mb-2">
            <div className="relative group shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt={name} className="w-16 h-16 rounded-full object-cover border border-zinc-700" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold border border-zinc-700">
                  {currentUser.initials || 'US'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider mb-2 block">Foto de Perfil</label>
              <div>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md border border-zinc-700/50 transition-colors shadow-sm"
                >
                  <Camera size={13} />
                  Escolher Imagem...
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#08080a] border border-zinc-800 rounded-md py-1.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Cargo</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Designer, Dev..."
                className="w-full bg-[#08080a] border border-zinc-800 rounded-md py-1.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#08080a] border border-zinc-800 rounded-md py-1.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Nova Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe em branco para não alterar"
              className="w-full bg-[#08080a] border border-zinc-800 rounded-md py-1.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2 rounded-md">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-zinc-800/50">
            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-colors"
            >
              <Settings size={13} />
              Preferências
            </button>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md shadow-sm transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salvar Alterações
            </button>
            </div>
          </div>
        </form>
      </div>
      {showPreferences && <PreferencesModal onClose={() => setShowPreferences(false)} />}
    </div>
  );
}
