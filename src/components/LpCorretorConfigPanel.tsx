import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff, GripVertical, Image as ImageIcon, Link2, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { LpCorretorConfig, LpCorretorFichaItem, LpCorretorImagem, SiengeCalculoRegra, SiengeTabelaVendaColuna } from '../types';
import { LpCorretorSlugConflictError, fetchLpCorretorConfigs, saveLpCorretorConfig } from '../lib/api';
import { REGRA_PREFIX, lpCorretorUrl, slugifyLpSlug } from '../lib/lpCorretor';
import { mergeColunasRegras } from '../lib/siengeVendasTabela';
import { UPLOAD_LIMITS, sanitizeFileName, uploadToStorage } from '../lib/storage';

interface LpCorretorConfigPanelProps {
  projectId: string;
  projectName: string;
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  onClose: () => void;
}

const INPUT_CLASS = 'w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors';
const LABEL_CLASS = 'text-[10px] font-semibold text-zinc-500 uppercase tracking-wider';

function emptyConfig(projectId: string, projectName: string): LpCorretorConfig {
  const now = new Date().toISOString();
  return {
    projectId,
    slug: slugifyLpSlug(projectName) || projectId,
    publicada: false,
    titulo: projectName,
    subtitulo: null,
    bannerUrl: null,
    imagens: [],
    fichaTecnica: [],
    bookUrl: null,
    observacoes: null,
    cvcrmUrlTemplate: null,
    colunasVisiveis: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Upload para o bucket público de anexos, sob um prefixo por empreendimento. */
async function uploadLpFile(projectId: string, file: File): Promise<string> {
  const path = `lp-corretor/${projectId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  return uploadToStorage('attachments', path, file, UPLOAD_LIMITS.task);
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 pt-4 border-t border-zinc-800/70 first:pt-0 first:border-0">
      <div>
        <h4 className="text-xs font-semibold text-zinc-200">{titulo}</h4>
        {descricao && <p className="text-[11px] text-zinc-500 mt-0.5">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

export default function LpCorretorConfigPanel({ projectId, projectName, colunas, regras, onClose }: LpCorretorConfigPanelProps) {
  const [config, setConfig] = useState<LpCorretorConfig | null>(null);
  const [salvo, setSalvo] = useState<LpCorretorConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState<'banner' | 'imagens' | 'book' | null>(null);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const imagensInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  // Config isolada do resto do app (não vive nas queries de App.tsx): carrega
  // ao abrir o painel e grava no botão Salvar.
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    fetchLpCorretorConfigs()
      .then(list => {
        if (!ativo) return;
        const existente = list.find(c => c.projectId === projectId) || emptyConfig(projectId, projectName);
        setConfig(existente);
        setSalvo(existente);
        setCarregando(false);
      })
      .catch(e => { if (ativo) { setErro(e.message || 'Erro ao carregar a configuração.'); setCarregando(false); } });
    return () => { ativo = false; };
  }, [projectId, projectName]);

  const merged = useMemo(() => mergeColunasRegras(colunas, regras), [colunas, regras]);
  const dirty = !!config && !!salvo && JSON.stringify(config) !== JSON.stringify(salvo);

  const patch = (p: Partial<LpCorretorConfig>) => setConfig(c => (c ? { ...c, ...p } : c));

  const toggleColuna = (key: string) => {
    if (!config) return;
    const visiveis = config.colunasVisiveis.includes(key)
      ? config.colunasVisiveis.filter(k => k !== key)
      : [...config.colunasVisiveis, key];
    patch({ colunasVisiveis: visiveis });
  };

  const handleUpload = async (tipo: 'banner' | 'imagens' | 'book', files: FileList | null) => {
    if (!files || files.length === 0 || !config) return;
    setEnviando(tipo);
    setErro(null);
    try {
      if (tipo === 'imagens') {
        const urls = await Promise.all(Array.from(files).map(f => uploadLpFile(projectId, f)));
        const novas: LpCorretorImagem[] = urls.map(url => ({ id: crypto.randomUUID(), url, legenda: '' }));
        patch({ imagens: [...config.imagens, ...novas] });
      } else {
        const url = await uploadLpFile(projectId, files[0]);
        patch(tipo === 'banner' ? { bannerUrl: url } : { bookUrl: url });
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao enviar o arquivo.');
    } finally {
      setEnviando(null);
    }
  };

  const salvar = async () => {
    if (!config) return;
    const slug = slugifyLpSlug(config.slug);
    if (!slug) { setErro('Informe um endereço (slug) válido para a página.'); return; }
    setSalvando(true);
    setErro(null);
    const normalizado: LpCorretorConfig = {
      ...config,
      slug,
      titulo: config.titulo?.trim() || null,
      subtitulo: config.subtitulo?.trim() || null,
      observacoes: config.observacoes?.trim() || null,
      cvcrmUrlTemplate: config.cvcrmUrlTemplate?.trim() || null,
      bookUrl: config.bookUrl?.trim() || null,
      fichaTecnica: config.fichaTecnica.filter(i => i.label.trim() || i.valor.trim()),
    };
    try {
      await saveLpCorretorConfig(normalizado);
      setConfig(normalizado);
      setSalvo(normalizado);
    } catch (e: any) {
      setErro(e instanceof LpCorretorSlugConflictError ? e.message : (e.message || 'Erro ao salvar.'));
    } finally {
      setSalvando(false);
    }
  };

  const copiarLink = () => {
    if (!config) return;
    navigator.clipboard.writeText(lpCorretorUrl(slugifyLpSlug(config.slug))).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  if (carregando || !config) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 bg-zinc-900/40 border border-zinc-800 rounded-xl text-xs text-zinc-500">
        <Loader2 size={14} className="animate-spin" /> Carregando configuração da LP...
      </div>
    );
  }

  const url = lpCorretorUrl(slugifyLpSlug(config.slug));

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Tabela Corretor</h3>
          <p className="text-[11px] text-zinc-500">
            Página pública com a tabela de preços de {projectName}, aberta por link e otimizada para celular.
            Só as colunas marcadas abaixo saem do banco — nenhuma outra informação do sistema fica acessível.
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Publicação + link */}
      <div className="flex flex-col gap-2.5 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {config.publicada ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-zinc-600" />}
            <span className="text-xs font-semibold text-zinc-200">{config.publicada ? 'Publicada' : 'Não publicada'}</span>
            <span className="text-[11px] text-zinc-600">{config.publicada ? '— qualquer pessoa com o link acessa' : '— o link retorna "tabela indisponível"'}</span>
          </div>
          <button
            type="button"
            onClick={() => patch({ publicada: !config.publicada })}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${config.publicada ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.publicada ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-2">
            <Link2 size={12} className="text-zinc-600 shrink-0" />
            <span className="text-[11px] text-zinc-600 shrink-0">/tabela/</span>
            <input
              type="text"
              value={config.slug}
              onChange={e => patch({ slug: e.target.value })}
              onBlur={e => patch({ slug: slugifyLpSlug(e.target.value) })}
              placeholder="endereco-da-pagina"
              className="flex-1 min-w-0 bg-transparent text-[11px] text-zinc-100 placeholder-zinc-600 outline-none"
            />
          </div>
          <button type="button" onClick={copiarLink} title="Copiar link" className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900/60 border border-zinc-800 rounded-lg transition-colors shrink-0">
            {copiado ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir página" className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900/60 border border-zinc-800 rounded-lg transition-colors shrink-0">
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <Secao titulo="Banner principal" descricao="Imagem de topo da página. Sem banner, a capa do empreendimento é usada.">
        <div className="flex items-center gap-3">
          {config.bannerUrl ? (
            <div className="relative shrink-0">
              <img src={config.bannerUrl} alt="" className="w-28 h-16 object-cover rounded-lg border border-zinc-800" />
              <button
                type="button"
                onClick={() => patch({ bannerUrl: null })}
                title="Remover banner"
                className="absolute -top-1.5 -right-1.5 p-1 bg-zinc-900 border border-zinc-700 rounded-full text-zinc-400 hover:text-red-400 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="w-28 h-16 rounded-lg border border-dashed border-zinc-800 flex items-center justify-center text-zinc-700 shrink-0">
              <ImageIcon size={16} />
            </div>
          )}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={e => { handleUpload('banner', e.target.files); e.target.value = ''; }} />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={enviando === 'banner'}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {enviando === 'banner' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Enviar banner
            </button>
            <input type="text" value={config.titulo || ''} onChange={e => patch({ titulo: e.target.value })} placeholder="Título exibido no banner" className={INPUT_CLASS} />
            <input type="text" value={config.subtitulo || ''} onChange={e => patch({ subtitulo: e.target.value })} placeholder="Subtítulo (ex.: bairro, entrega prevista)" className={INPUT_CLASS} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Imagens do Produto" descricao="Galeria do menu de informações.">
        <input ref={imagensInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { handleUpload('imagens', e.target.files); e.target.value = ''; }} />
        {config.imagens.length > 0 && (
          <div className="flex flex-col gap-2">
            {config.imagens.map(img => (
              <div key={img.id} className="flex items-center gap-2">
                <GripVertical size={12} className="text-zinc-700 shrink-0" />
                <img src={img.url} alt="" className="w-12 h-12 object-cover rounded-lg border border-zinc-800 shrink-0" />
                <input
                  type="text"
                  value={img.legenda}
                  onChange={e => patch({ imagens: config.imagens.map((i: LpCorretorImagem) => i.id === img.id ? { ...i, legenda: e.target.value } : i) })}
                  placeholder="Legenda (opcional)"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => patch({ imagens: config.imagens.filter(i => i.id !== img.id) })}
                  className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => imagensInputRef.current?.click()}
          disabled={enviando === 'imagens'}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 self-start"
        >
          {enviando === 'imagens' ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} strokeWidth={3} />} Adicionar imagens
        </button>
      </Secao>

      <Secao titulo="Ficha Técnica" descricao="Pares de informação exibidos em lista (ex.: Metragem — 42 m² a 78 m²).">
        {config.fichaTecnica.length > 0 && (
          <div className="flex flex-col gap-2">
            {config.fichaTecnica.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={e => patch({ fichaTecnica: config.fichaTecnica.map((i: LpCorretorFichaItem) => i.id === item.id ? { ...i, label: e.target.value } : i) })}
                  placeholder="Item"
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={item.valor}
                  onChange={e => patch({ fichaTecnica: config.fichaTecnica.map((i: LpCorretorFichaItem) => i.id === item.id ? { ...i, valor: e.target.value } : i) })}
                  placeholder="Valor"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => patch({ fichaTecnica: config.fichaTecnica.filter(i => i.id !== item.id) })}
                  className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => patch({ fichaTecnica: [...config.fichaTecnica, { id: crypto.randomUUID(), label: '', valor: '' }] })}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors self-start"
        >
          <Plus size={11} strokeWidth={3} /> Adicionar item
        </button>
      </Secao>

      <Secao titulo="Book" descricao="PDF ou link externo do material de vendas.">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={config.bookUrl || ''}
            onChange={e => patch({ bookUrl: e.target.value })}
            placeholder="https://... (ou envie um PDF)"
            className={INPUT_CLASS}
          />
          <input ref={bookInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { handleUpload('book', e.target.files); e.target.value = ''; }} />
          <button
            type="button"
            onClick={() => bookInputRef.current?.click()}
            disabled={enviando === 'book'}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors shrink-0 disabled:opacity-50"
          >
            {enviando === 'book' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} PDF
          </button>
        </div>
      </Secao>

      <Secao
        titulo="Colunas visíveis na tabela"
        descricao="Unidade, valor e situação sempre aparecem. As demais colunas — inclusive as calculadas — só saem do banco se marcadas aqui."
      >
        {merged.length === 0 ? (
          <p className="text-[11px] text-zinc-600">Este empreendimento ainda não tem colunas cadastradas.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {merged.map(m => {
              const key = m.kind === 'coluna' ? m.item.key : `${REGRA_PREFIX}${m.item.id}`;
              const label = m.kind === 'coluna' ? m.item.label : m.item.titulo;
              const ativa = config.colunasVisiveis.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleColuna(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${
                    ativa ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {ativa && <Check size={10} strokeWidth={3} />}
                  {label}
                  {m.kind === 'regra' && <span className="text-[9px] opacity-60 uppercase">calc.</span>}
                </button>
              );
            })}
          </div>
        )}
      </Secao>

      <Secao
        titulo="Botão Reservar (CVCRM)"
        descricao="Link aberto ao tocar em Reservar, exibido apenas nas unidades disponíveis. Use {unidade} onde o nome da unidade deve entrar; sem o placeholder, todas apontam para o mesmo endereço."
      >
        <input
          type="text"
          value={config.cvcrmUrlTemplate || ''}
          onChange={e => patch({ cvcrmUrlTemplate: e.target.value })}
          placeholder="https://empresa.cvcrm.com.br/reserva?empreendimento=123&unidade={unidade}"
          className={INPUT_CLASS}
        />
      </Secao>

      <Secao titulo="Observações" descricao="Texto exibido logo abaixo da tabela.">
        <textarea
          value={config.observacoes || ''}
          onChange={e => patch({ observacoes: e.target.value })}
          rows={4}
          placeholder="Ex.: condições de pagamento, validade da tabela, sinal mínimo..."
          className={`${INPUT_CLASS} resize-y leading-relaxed`}
        />
      </Secao>

      {erro && <p className="text-[11px] text-red-400">{erro}</p>}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/70">
        {dirty && <span className="text-[11px] text-amber-400 mr-auto">Alterações não salvas</span>}
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !dirty}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors"
        >
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />} Salvar
        </button>
      </div>
    </div>
  );
}
