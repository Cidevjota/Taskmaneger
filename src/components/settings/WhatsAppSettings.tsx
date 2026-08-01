import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Loader2, Save, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { fetchWhatsAppConfig, saveWhatsAppConfig, fetchWhatsAppOutbox } from '../../lib/api';
import { WhatsAppConfig, WhatsAppOutboxItem } from '../../types';
import { formatPhoneDisplay } from '../../lib/phone';

const STATUS_STYLE: Record<WhatsAppOutboxItem['status'], { label: string; className: string; icon: React.ElementType }> = {
  sent:    { label: 'Enviado',  className: 'text-emerald-400', icon: CheckCircle2 },
  pending: { label: 'Na fila',  className: 'text-amber-400',   icon: Clock },
  failed:  { label: 'Falhou',   className: 'text-red-400',     icon: XCircle },
};

/**
 * Configuração da integração com o WAHA (WhatsApp self-hosted na VPS).
 * A API key não aparece aqui de propósito: ela vive como secret da Edge
 * Function `send-whatsapp`, longe do bundle do frontend.
 */
export default function WhatsAppSettings() {
  const [config, setConfig] = useState<WhatsAppConfig>({ enabled: false, session: 'default' });
  const [outbox, setOutbox] = useState<WhatsAppOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, items] = await Promise.all([fetchWhatsAppConfig(), fetchWhatsAppOutbox(15)]);
      setConfig(cfg);
      setOutbox(items);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await saveWhatsAppConfig(config);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full bg-[#08080a] border border-zinc-800 rounded-md py-1.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600';
  const labelClass = 'text-[10px] uppercase font-semibold text-zinc-500 tracking-wider';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500 py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Carregando configuração...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
          <MessageCircle size={14} className="text-emerald-400" />
          WhatsApp (WAHA)
        </h3>
        <p className="text-[11px] text-zinc-500">
          Avisa o responsável no WhatsApp quando um título entra na alçada dele. Quem não tiver
          telefone cadastrado continua recebendo apenas a notificação interna.
        </p>
      </div>

      <div className="bg-zinc-950/30 border border-zinc-900 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium block text-zinc-300">Integração ativa</span>
            <span className="text-[10px] text-zinc-600">
              Desligado, nada é enfileirado — as notificações internas seguem normais.
            </span>
          </div>
          <button
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            role="switch"
            aria-checked={config.enabled}
            className="w-10 h-6 bg-zinc-900 border border-zinc-800 rounded-full relative flex items-center p-0.5 transition-all hover:border-zinc-700"
          >
            <div className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${config.enabled ? 'translate-x-4 bg-emerald-400' : 'translate-x-0 bg-zinc-500'}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>URL do servidor WAHA</label>
            <input
              type="url"
              value={config.baseUrl || ''}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://waha.seudominio.com.br"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Sessão</label>
            <input
              type="text"
              value={config.session}
              onChange={(e) => setConfig({ ...config, session: e.target.value })}
              placeholder="default"
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-[10px] text-zinc-600 bg-zinc-900/40 border border-zinc-900 rounded p-2.5 leading-relaxed">
          A API key do WAHA e o token de disparo ficam como secrets da Edge Function
          (<code className="text-zinc-500">WAHA_API_KEY</code>, <code className="text-zinc-500">WHATSAPP_DISPATCH_TOKEN</code>),
          nunca no navegador. Ver <code className="text-zinc-500">docs/waha-setup.md</code>.
        </p>

        {error && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2 rounded-md">{error}</div>}
        {success && <div className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-md">Configuração salva.</div>}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </button>
        </div>
      </div>

      {/* Diagnóstico: sem isso, uma sessão caída falha em silêncio. */}
      <div className="bg-zinc-950/30 border border-zinc-900 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-zinc-300">Últimos envios</h4>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded transition-colors"
          >
            <RefreshCw size={11} />
            Atualizar
          </button>
        </div>

        {outbox.length === 0 ? (
          <p className="text-[11px] text-zinc-600 py-3 text-center">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {outbox.map(item => {
              const style = STATUS_STYLE[item.status];
              const Icon = style.icon;
              return (
                <div key={item.id} className="flex items-start gap-2.5 text-[11px] border-b border-zinc-900/70 pb-1.5 last:border-0">
                  <Icon size={12} className={`${style.className} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300">{formatPhoneDisplay(item.phone)}</span>
                      <span className={style.className}>{style.label}</span>
                      {item.attempts > 1 && <span className="text-zinc-600">{item.attempts} tentativas</span>}
                    </div>
                    <p className="text-zinc-600 truncate">{item.message.split('\n')[0]}</p>
                    {item.lastError && <p className="text-red-400/70 truncate">{item.lastError}</p>}
                  </div>
                  <span className="text-zinc-700 shrink-0">
                    {new Date(item.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
