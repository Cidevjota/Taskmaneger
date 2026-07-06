import React, { useState } from 'react';
import { Delivery } from '../types';
import { User } from '../lib/users';
import { Check, X, Image as ImageIcon, Link as LinkIcon, FileText, User as UserIcon, ChevronDown, Plus } from 'lucide-react';

interface DeliveryFormProps {
  initialData?: Delivery;
  users?: User[];
  onSave: (deliveryData: Partial<Delivery>) => void;
  onCancel: () => void;
}

export default function DeliveryForm({ initialData, users = [], onSave, onCancel }: DeliveryFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    if (initialData?.imageUrls && initialData.imageUrls.length > 0) return initialData.imageUrls;
    if (initialData?.imageUrl) return [initialData.imageUrl];
    return [''];
  });
  const [figmaLink, setFigmaLink] = useState(initialData?.figmaLink || '');
  const [creativeDefense, setCreativeDefense] = useState(initialData?.creativeDefense || '');
  const [approverId, setApproverId] = useState(initialData?.approverId || '');
  const [isApproverSelectOpen, setIsApproverSelectOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const validImageUrls = imageUrls.filter(url => url.trim() !== '');
    if (validImageUrls.length === 0 || (users && users.length > 0 && !approverId)) return;

    let finalLink = figmaLink.trim();
    if (finalLink && !/^https?:\/\//i.test(finalLink)) {
      finalLink = 'https://' + finalLink;
    }

    setIsSubmitting(true);
    onSave({
      imageUrl: validImageUrls[0], // Backwards compatibility
      imageUrls: validImageUrls,
      thumbnailUrl: validImageUrls[0], // Em um cenário real, o backend geraria a miniatura
      figmaLink: finalLink,
      creativeDefense,
      approverId: approverId || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#0a0a0c] border border-zinc-800/80 rounded-lg animate-slide-down">
      <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
          {initialData ? 'Editar Criativo' : 'Adicionar Novo Criativo'}
        </h4>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase flex items-center gap-1.5">
            <ImageIcon size={12} /> {imageUrls.length > 1 ? 'Imagens do Criativo *' : 'Imagem do Criativo *'}
          </label>
          <div className="flex flex-col gap-3">
            {imageUrls.map((url, idx) => (
              <div 
                key={idx}
                className={`bg-[#121214] border ${url ? 'border-zinc-800' : 'border-zinc-800 border-dashed'} rounded-md p-4 flex flex-col items-center justify-center gap-2 transition-colors focus-within:border-yellow-500/50 relative`}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      e.preventDefault();
                      const blob = items[i].getAsFile();
                      if (blob) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            const newUrls = [...imageUrls];
                            newUrls[idx] = event.target.result as string;
                            setImageUrls(newUrls);
                          }
                        };
                        reader.readAsDataURL(blob);
                      }
                    }
                  }
                }}
                tabIndex={0}
              >
                {url ? (
                  <div className="relative group w-full flex justify-center">
                    {url.startsWith('data:image') || url.startsWith('http') ? (
                      <img src={url} alt={`Preview ${idx + 1}`} className="max-h-40 object-contain rounded" />
                    ) : (
                      <span className="text-xs text-yellow-400 break-all">{url}</span>
                    )}
                    <button 
                      type="button" 
                      onClick={() => {
                        const newUrls = [...imageUrls];
                        newUrls[idx] = '';
                        setImageUrls(newUrls);
                      }}
                      className="absolute top-2 right-2 bg-red-500/80 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remover Imagem"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon size={24} className="text-zinc-600" />
                    <p className="text-xs text-zinc-400 text-center">
                      Clique aqui e aperte <strong>Ctrl+V</strong> para colar o print do layout,<br/>
                      ou insira uma URL válida abaixo.
                    </p>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...imageUrls];
                        newUrls[idx] = e.target.value;
                        setImageUrls(newUrls);
                      }}
                      placeholder="https://exemplo.com/imagem.png"
                      className="w-full max-w-sm mt-2 bg-[#0a0a0c] border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                  </>
                )}
                {imageUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrls(imageUrls.filter((_, i) => i !== idx));
                    }}
                    className="absolute top-2 right-2 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Remover Campo"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            
            <button
              type="button"
              onClick={() => setImageUrls([...imageUrls, ''])}
              className="self-start flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-yellow-400 py-1.5 px-3 rounded border border-zinc-800 hover:border-yellow-500/30 hover:bg-yellow-500/5 transition-all"
            >
              <Plus size={12} />
              Adicionar mais uma imagem
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase flex items-center gap-1.5">
            <LinkIcon size={12} /> Link do arquivo no drive
          </label>
          <input
            type="text"
            value={figmaLink}
            onChange={(e) => setFigmaLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="bg-[#121214] border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </div>

        {users && users.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase flex items-center gap-1.5">
              <UserIcon size={12} /> Aprovador *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsApproverSelectOpen(!isApproverSelectOpen)}
                className={`w-full flex items-center justify-between bg-[#121214] border ${isApproverSelectOpen ? 'border-yellow-500/50 shadow-[0_0_0_2px_rgba(234,179,8,0.1)]' : 'border-zinc-800'} hover:border-zinc-700 rounded-md px-3 py-2.5 text-xs text-left transition-all outline-none`}
              >
                <span className={approverId ? 'text-zinc-200 font-medium' : 'text-zinc-500'}>
                  {approverId 
                    ? (users.find(u => u.id === approverId)?.name || 'Usuário não encontrado')
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
                      {users.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setApproverId(u.id);
                            setIsApproverSelectOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                            approverId === u.id 
                              ? 'bg-yellow-500/10 text-yellow-500 font-medium' 
                              : 'text-zinc-300 hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                            <span>{u.name}</span>
                          </div>
                          {approverId === u.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase flex items-center gap-1.5">
            <FileText size={12} /> Defesa Criativa (Opcional)
          </label>
          <textarea
            value={creativeDefense}
            onChange={(e) => setCreativeDefense(e.target.value)}
            placeholder="Explique o conceito por trás deste criativo..."
            className="bg-[#121214] border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 transition-colors min-h-[80px] resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={imageUrls.filter(u => u.trim() !== '').length === 0 || isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded border border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={14} /> {isSubmitting ? 'Salvando...' : (initialData ? 'Salvar Edição' : 'Cadastrar Criativo')}
          </button>
        </div>
      </form>
    </div>
  );
}
