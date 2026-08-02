import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Images, Loader2, MapPin, ListChecks, X, ArrowUpRight } from 'lucide-react';
import { LpCorretorPublicData, LpCorretorPublicUnidade, SiengeVendaSituacao } from '../types';
import { fetchLpCorretorPublic } from '../lib/api';
import { LP_SITUACAO_LABELS, buildReservaUrl, formatLpValor, formatMoeda, mergeLpColunas, sortUnidades } from '../lib/lpCorretor';
import { LP_EMPRESA, canaisDeContato } from '../lib/lpCorretorEmpresa';

// Página pública, sem sessão: renderizada fora do AuthProvider (ver main.tsx),
// então nada aqui pode depender de currentUser nem tocar em outra rota do app.

const SITUACAO_BADGE: Record<SiengeVendaSituacao, string> = {
  disponivel: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30',
  vendida: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
  permuta: 'text-violet-300 bg-violet-500/10 border-violet-400/30',
  bloqueada: 'text-amber-300 bg-amber-500/10 border-amber-400/30',
};

type SecaoAberta = 'imagens' | 'ficha' | 'book' | null;

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#08080a] flex items-center justify-center">
      <Loader2 size={22} className="text-zinc-600 animate-spin" />
    </div>
  );
}

function NaoEncontrada() {
  return (
    <div className="min-h-screen bg-[#08080a] flex flex-col items-center justify-center gap-3 px-8 text-center">
      <img src={LP_EMPRESA.logoUrl} alt={LP_EMPRESA.nome} className="h-8 w-auto opacity-40 mb-2" />
      <h1 className="text-base font-bold text-zinc-200">Tabela indisponível</h1>
      <p className="text-sm text-zinc-500 max-w-xs">
        Este link não está mais ativo ou a tabela ainda não foi publicada. Fale com a equipe comercial para receber o link atualizado.
      </p>
    </div>
  );
}

/** Galeria com scroll horizontal por snap + visualização em tela cheia. */
function Galeria({ imagens }: { imagens: { id: string; url: string; legenda: string }[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (imagens.length === 0) {
    return <p className="px-5 pb-5 text-sm text-zinc-500">Nenhuma imagem publicada ainda.</p>;
  }
  return (
    <>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-5 pb-5 -mx-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {imagens.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => setAberta(img.url)}
            className="snap-center shrink-0 w-[78%] max-w-sm text-left"
          >
            <img src={img.url} alt={img.legenda || 'Imagem do produto'} loading="lazy" className="w-full aspect-[4/3] object-cover rounded-2xl border border-zinc-800" />
            {img.legenda && <p className="mt-2 text-xs text-zinc-500">{img.legenda}</p>}
          </button>
        ))}
      </div>
      {aberta && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setAberta(null)}>
          <button type="button" className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white" aria-label="Fechar">
            <X size={22} />
          </button>
          <img src={aberta} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
        </div>
      )}
    </>
  );
}

function SecaoAcordeao({ id, titulo, icone, aberta, onToggle, children }: {
  id: SecaoAberta;
  titulo: string;
  icone: React.ReactNode;
  aberta: boolean;
  onToggle: (id: SecaoAberta) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-900">
      <button
        type="button"
        onClick={() => onToggle(aberta ? null : id)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-zinc-900/50 transition-colors"
      >
        <span className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">{icone}</span>
        <span className="flex-1 text-sm font-semibold text-zinc-100">{titulo}</span>
        <ChevronDown size={16} className={`text-zinc-600 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

/** Card de uma unidade — formato principal, pensado para leitura no celular. */
function UnidadeCard({ unidade, entradas, cvcrmTemplate }: {
  unidade: LpCorretorPublicUnidade;
  entradas: ReturnType<typeof mergeLpColunas>;
  cvcrmTemplate: string | null;
}) {
  const disponivel = unidade.situacao === 'disponivel';
  const reservaUrl = disponivel ? buildReservaUrl(cvcrmTemplate, unidade.unidade) : null;
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${disponivel ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-900/20 border-zinc-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Unidade</p>
          <p className={`text-lg font-bold leading-tight ${disponivel ? 'text-zinc-50' : 'text-zinc-500'}`}>{unidade.unidade}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${SITUACAO_BADGE[unidade.situacao]}`}>
          {LP_SITUACAO_LABELS[unidade.situacao]}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor</span>
        <span className={`text-base font-bold ${disponivel ? 'text-zinc-50' : 'text-zinc-500 line-through decoration-zinc-700'}`}>
          {unidade.valorTabela > 0 ? formatMoeda(unidade.valorTabela) : '—'}
        </span>
      </div>

      {entradas.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1 border-t border-zinc-800/70">
          {entradas.map(e => (
            <div key={e.id} className="min-w-0">
              <dt className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider truncate">{e.label}</dt>
              <dd className={`text-xs font-medium truncate ${disponivel ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {formatLpValor(e.tipo, e.read(unidade))}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {unidade.descricao && <p className="text-xs text-zinc-500">{unidade.descricao}</p>}

      {reservaUrl && (
        <a
          href={reservaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 active:bg-blue-700 transition-colors"
        >
          Reservar <ArrowUpRight size={15} strokeWidth={2.5} />
        </a>
      )}
    </div>
  );
}

export default function LpCorretorPage({ slug }: { slug: string }) {
  const [data, setData] = useState<LpCorretorPublicData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [secao, setSecao] = useState<SecaoAberta>(null);
  const [filtro, setFiltro] = useState<SiengeVendaSituacao | 'todas'>('disponivel');

  useEffect(() => {
    let ativo = true;
    fetchLpCorretorPublic(slug)
      .then(d => { if (ativo) { setData(d); setCarregando(false); } })
      .catch(() => { if (ativo) { setErro(true); setCarregando(false); } });
    return () => { ativo = false; };
  }, [slug]);

  useEffect(() => {
    if (data) document.title = `${data.config.titulo || data.projeto.nome} — Tabela de Valores`;
  }, [data]);

  const entradas = useMemo(() => (data ? mergeLpColunas(data.colunas, data.regras) : []), [data]);
  const unidades = useMemo(() => (data ? sortUnidades(data.unidades) : []), [data]);
  const disponiveis = unidades.filter(u => u.situacao === 'disponivel').length;
  const visiveis = filtro === 'todas' ? unidades : unidades.filter(u => u.situacao === filtro);

  if (carregando) return <Skeleton />;
  if (erro || !data) return <NaoEncontrada />;

  const { config, projeto } = data;
  const banner = config.bannerUrl || projeto.coverImage;
  const canais = canaisDeContato();
  const temInfo = config.imagens.length > 0 || config.fichaTecnica.length > 0 || !!config.bookUrl;

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-100 antialiased">
      <div className="mx-auto w-full max-w-lg">
        {/* Banner principal */}
        <header className="relative">
          {banner ? (
            <img src={banner} alt={projeto.nome} className="w-full h-[62vh] min-h-[340px] object-cover" />
          ) : (
            <div className="w-full h-[38vh] min-h-[220px] bg-gradient-to-br from-zinc-900 to-[#08080a]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/40 to-transparent" />
          <div className="absolute inset-x-0 top-0 p-5">
            <img src={LP_EMPRESA.logoUrl} alt={LP_EMPRESA.nome} className="h-6 w-auto drop-shadow-lg" />
          </div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
            <h1 className="text-2xl font-bold leading-tight drop-shadow">{config.titulo || projeto.nome}</h1>
            {config.subtitulo && <p className="mt-1 text-sm text-zinc-300">{config.subtitulo}</p>}
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {disponiveis} {disponiveis === 1 ? 'unidade disponível' : 'unidades disponíveis'}
            </div>
          </div>
        </header>

        {/* Menu de informações */}
        {temInfo && (
          <nav className="border-t border-zinc-900">
            <SecaoAcordeao id="imagens" titulo="Imagens do Produto" icone={<Images size={15} />} aberta={secao === 'imagens'} onToggle={setSecao}>
              <Galeria imagens={config.imagens} />
            </SecaoAcordeao>

            <SecaoAcordeao id="ficha" titulo="Ficha Técnica" icone={<ListChecks size={15} />} aberta={secao === 'ficha'} onToggle={setSecao}>
              {config.fichaTecnica.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-zinc-500">Ficha técnica ainda não publicada.</p>
              ) : (
                <dl className="px-5 pb-5 flex flex-col">
                  {config.fichaTecnica.map(item => (
                    <div key={item.id} className="flex items-baseline justify-between gap-4 py-2.5 border-b border-zinc-900 last:border-0">
                      <dt className="text-xs text-zinc-500 shrink-0">{item.label}</dt>
                      <dd className="text-sm font-medium text-zinc-200 text-right">{item.valor}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </SecaoAcordeao>

            <SecaoAcordeao id="book" titulo="Book" icone={<BookOpen size={15} />} aberta={secao === 'book'} onToggle={setSecao}>
              {config.bookUrl ? (
                <div className="px-5 pb-5">
                  <a
                    href={config.bookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-sm font-bold text-zinc-100 bg-zinc-900 border border-zinc-800 active:bg-zinc-800 transition-colors"
                  >
                    Abrir book do empreendimento <ArrowUpRight size={15} />
                  </a>
                </div>
              ) : (
                <p className="px-5 pb-5 text-sm text-zinc-500">Book ainda não publicado.</p>
              )}
            </SecaoAcordeao>
          </nav>
        )}

        {/* Tabela de valores */}
        <section className="px-5 pt-6 pb-2">
          <h2 className="text-sm font-bold text-zinc-100">Tabela de Valores</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Atualizada em {new Date(config.atualizadoEm).toLocaleDateString('pt-BR')}
          </p>
        </section>

        <div className="sticky top-0 z-20 bg-[#08080a]/95 backdrop-blur border-b border-zinc-900 px-5 py-3">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['disponivel', 'todas', 'vendida', 'permuta', 'bloqueada'] as const).map(f => {
              const total = f === 'todas' ? unidades.length : unidades.filter(u => u.situacao === f).length;
              if (total === 0 && f !== 'todas' && f !== 'disponivel') return null;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                    filtro === f ? 'bg-blue-500/15 text-blue-300 border-blue-400/40' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800'
                  }`}
                >
                  {f === 'todas' ? 'Todas' : LP_SITUACAO_LABELS[f]} <span className="opacity-60">{total}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {visiveis.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-10">Nenhuma unidade nesta situação.</p>
          ) : (
            visiveis.map(u => (
              <UnidadeCard key={u.id} unidade={u} entradas={entradas} cvcrmTemplate={config.cvcrmUrlTemplate} />
            ))
          )}
        </div>

        {/* Rodapé com observações */}
        {config.observacoes && (
          <section className="mx-5 mb-8 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-900">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Observações</h3>
            <p className="text-xs leading-relaxed text-zinc-400 whitespace-pre-line">{config.observacoes}</p>
          </section>
        )}

        {/* Footer institucional */}
        <footer className="border-t border-zinc-900 px-5 py-8 flex flex-col gap-4">
          <img src={LP_EMPRESA.logoUrl} alt={LP_EMPRESA.nome} className="h-6 w-auto opacity-80" />
          {LP_EMPRESA.descricao && <p className="text-xs text-zinc-500 leading-relaxed">{LP_EMPRESA.descricao}</p>}

          {canais.length > 0 && (
            <div className="flex flex-col gap-2">
              {canais.map(c => (
                <a
                  key={c.label}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 active:bg-zinc-800 transition-colors"
                >
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{c.label}</span>
                  <span className="text-xs font-medium text-zinc-200 truncate">{c.texto}</span>
                </a>
              ))}
            </div>
          )}

          {LP_EMPRESA.endereco && (
            <p className="flex items-start gap-1.5 text-xs text-zinc-500">
              <MapPin size={13} className="shrink-0 mt-0.5" /> {LP_EMPRESA.endereco}
            </p>
          )}

          <div className="pt-3 border-t border-zinc-900 text-[10px] text-zinc-600 leading-relaxed">
            {LP_EMPRESA.creci && <p>{LP_EMPRESA.creci}</p>}
            <p>
              Valores sujeitos a alteração sem aviso prévio. Esta tabela é de uso exclusivo dos corretores
              credenciados e não constitui proposta comercial.
            </p>
            <p className="mt-1">© {new Date().getFullYear()} {LP_EMPRESA.nome}. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
