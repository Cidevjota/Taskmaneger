import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Images, Loader2, MapPin, ListChecks, Moon, Sun, X, ArrowUpRight, MessageCircle, Phone, Mail, Instagram, Globe, Download } from 'lucide-react';
import { LpCorretorImagem, LpCorretorFichaItem, LpCorretorPlanta, LpCorretorPublicData, LpCorretorPublicUnidade, SiengeVendaSituacao } from '../types';
import { fetchLpCorretorPublic } from '../lib/api';
import { LP_SITUACAO_LABELS, LP_TEMA_STORAGE_KEY, LpTema, aplicarTemaLp, buildReservaUrl, colunaMetragem, faixaDe, formatLpValor, formatMoeda, mergeLpColunas, plantasDaUnidade, sortUnidades, temaLpSalvo, valorNumerico } from '../lib/lpCorretor';
import { baixarTabelaPdf } from '../lib/lpCorretorPdf';
import { LP_EMPRESA, canaisDeContato } from '../lib/lpCorretorEmpresa';

// Página pública, sem sessão: renderizada fora do AuthProvider (ver main.tsx),
// então nada aqui pode depender de currentUser nem tocar em outra rota do app.
//
// Responsividade em três faixas: celular (coluna única, acordeão), tablet a
// partir de sm e desktop a partir de lg (hero alto, seções de informação lado a
// lado e tabela em largura total).

// Permuta e bloqueada nunca chegam aqui: a RPC as entrega como "vendida", para
// o corretor não ver o motivo interno da indisponibilidade.
const SITUACAO_DOT: Record<SiengeVendaSituacao, string> = {
  disponivel: 'bg-emerald-400',
  reservado: 'bg-amber-400',
  vendida: 'bg-zinc-600',
  permuta: 'bg-zinc-600',
  bloqueada: 'bg-zinc-600',
};

// Ícone por canal de contato do rodapé — lucide não tem o glifo oficial do
// WhatsApp, MessageCircle é o substituto convencional.
const CANAL_ICONE: Record<string, React.ReactNode> = {
  WhatsApp: <MessageCircle size={15} />,
  Telefone: <Phone size={15} />,
  'E-mail': <Mail size={15} />,
  Instagram: <Instagram size={15} />,
  Site: <Globe size={15} />,
};

type SecaoAberta = 'ficha' | null;
type Faixa = [number, number];

// Recuo lateral padrão das seções, coerente em todas as larguras.
const GUTTER = 'px-5 sm:px-6 lg:px-8';

// O mesmo recuo do GUTTER, porém aplicado às células das pontas — a tabela rola
// na horizontal, então o padding não pode viver no container (ele rolaria junto
// e a primeira coluna encostaria na borda). Vive na <tr> e não em cada célula
// porque o `[&>td]:px-2` da linha, tendo especificidade maior que um `pl-8`
// solto na célula, vencia o recuo e alinhava a tabela 24px à esquerda de todo o
// resto da página.
const ROW_GUTTER =
  '[&>:first-child]:pl-5 [&>:last-child]:pr-5 ' +
  'sm:[&>:first-child]:pl-6 sm:[&>:last-child]:pr-6 ' +
  'lg:[&>:first-child]:pl-8 lg:[&>:last-child]:pr-8';

function Skeleton() {
  return (
    <div className="min-h-[100svh] bg-[#08080a] flex items-center justify-center">
      <Loader2 size={22} className="text-zinc-600 animate-spin" />
    </div>
  );
}

function NaoEncontrada() {
  return (
    <div className="min-h-[100svh] bg-[#08080a] flex flex-col items-center justify-center gap-3 px-8 text-center">
      <img src={LP_EMPRESA.logoUrl} alt={LP_EMPRESA.nome} className="h-8 w-auto opacity-40 mb-2" />
      <h1 className="text-base font-bold text-zinc-200">Tabela indisponível</h1>
      <p className="text-sm text-zinc-500 max-w-xs">
        Este link não está mais ativo ou a tabela ainda não foi publicada. Fale com a equipe comercial para receber o link atualizado.
      </p>
    </div>
  );
}

/**
 * Legenda escrita sobre a própria imagem, no canto inferior esquerdo. O
 * degradê atrás do texto é o que garante a leitura: branco puro sobre uma foto
 * clara — céu, fachada ensolarada — desapareceria sem ele.
 */
function LegendaSobreposta({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 pt-8 pb-3 px-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
      <p className="text-xs font-medium text-white text-left drop-shadow">{texto}</p>
    </div>
  );
}

/**
 * Galeria do celular: scroll com snap, que dá o gesto de arrastar nativo do
 * toque. As imagens ocupam a largura disponível e mantêm a própria proporção —
 * sem corte e sem estourar o recuo da seção. O desktop usa SliderImagens.
 */
function Galeria({ imagens }: { imagens: LpCorretorImagem[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (imagens.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhuma imagem publicada ainda.</p>;
  }
  return (
    <>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {imagens.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => setAberta(img.url)}
            className="relative snap-center shrink-0 w-full aspect-[4/3] rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden text-left"
          >
            <img
              src={img.url}
              alt={img.legenda || 'Imagem do produto'}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <LegendaSobreposta texto={img.legenda} />
          </button>
        ))}
      </div>
      {aberta && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setAberta(null)}>
          <button type="button" className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white" aria-label="Fechar">
            <X size={22} />
          </button>
          <img src={aberta} alt="" className="max-h-full max-w-full object-contain rounded-md" />
        </div>
      )}
    </>
  );
}

/** Lado direito de uma linha de informação quando ela aponta para um arquivo. */
function LinkAbrir({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
    >
      Abrir <ArrowUpRight size={13} />
    </a>
  );
}

/**
 * Informações do produto. Cada linha mostra um valor em texto ou, quando o
 * item tem link, o mesmo "Abrir" do book — é o que permite pendurar memorial,
 * tour virtual e afins sem inventar uma seção nova para cada um. O book segue
 * como a última linha, não como seção própria.
 */
function Informacoes({ itens, bookUrl }: { itens: LpCorretorFichaItem[]; bookUrl: string | null }) {
  if (itens.length === 0 && !bookUrl) {
    return <p className="text-sm text-zinc-500">Informações ainda não publicadas.</p>;
  }
  return (
    <dl className="flex flex-col">
      {itens.map(item => {
        const url = item.url?.trim();
        return (
          <div key={item.id} className="flex items-baseline justify-between gap-4 py-2.5 border-b border-zinc-900 last:border-0">
            <dt className="text-xs text-zinc-500 shrink-0">{item.label}</dt>
            <dd className="text-sm font-medium text-zinc-200 text-right">
              {url ? <LinkAbrir url={url} /> : item.valor}
            </dd>
          </div>
        );
      })}
      {bookUrl && (
        <div className="flex items-center justify-between gap-4 py-2.5 border-t border-zinc-900">
          <dt className="text-xs text-zinc-500 shrink-0">Book</dt>
          <dd className="text-right"><LinkAbrir url={bookUrl} /></dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Slider do desktop: avança sozinho em loop e pausa quando o ponteiro entra ou
 * o foco cai dentro dele — carrossel que continua girando enquanto a pessoa
 * examina uma imagem é hostil. No celular a galeria segue como scroll com snap,
 * que dá o gesto de arrastar nativo.
 *
 * A navegação é contador + miniaturas, não pontinhos: um empreendimento publica
 * de vinte a trinta renders, e nessa quantidade o ponto não diz nada — nem
 * quantas faltam (são dezenas de traços iguais), nem para onde se está indo
 * (todo ponto é idêntico ao vizinho). A miniatura responde as duas coisas e
 * ainda deixa o corretor pular direto para a imagem que quer mostrar ao
 * cliente, em vez de avançar de um em um até chegar nela.
 */
function SliderImagens({ imagens, intervaloMs = 5000 }: { imagens: LpCorretorImagem[]; intervaloMs?: number }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const tirasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pausado || imagens.length < 2 || ampliada) return;
    const t = setInterval(() => setIndice(i => (i + 1) % imagens.length), intervaloMs);
    return () => clearInterval(t);
  }, [pausado, imagens.length, intervaloMs, ampliada]);

  // Traz a miniatura ativa para o centro da faixa. O scrollLeft é calculado à
  // mão de propósito: scrollIntoView() sobe pela árvore e arrastaria a página
  // inteira a cada troca automática de imagem.
  useEffect(() => {
    const faixa = tirasRef.current;
    const ativa = faixa?.children[indice] as HTMLElement | undefined;
    if (!faixa || !ativa) return;
    faixa.scrollTo({
      left: ativa.offsetLeft - faixa.clientWidth / 2 + ativa.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [indice]);

  if (imagens.length === 0) return <p className="text-sm text-zinc-500">Nenhuma imagem publicada ainda.</p>;

  const atual = imagens[Math.min(indice, imagens.length - 1)];
  const irPara = (i: number) => setIndice((i + imagens.length) % imagens.length);

  return (
    <div
      className="flex flex-col gap-3"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
    >
      <div className="relative group">
        {/* Caixa de proporção fixa com object-cover: a imagem preenche toda a
            coluna (aceitando corte) e a altura não pula a cada troca. */}
        <button
          type="button"
          onClick={() => setAmpliada(atual.url)}
          className="relative block w-full aspect-[16/10] rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden"
        >
          <img src={atual.url} alt={atual.legenda || 'Imagem do produto'} className="w-full h-full object-cover" />
          <LegendaSobreposta texto={atual.legenda} />
        </button>
        {imagens.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => irPara(indice - 1)}
              aria-label="Imagem anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/60 text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => irPara(indice + 1)}
              aria-label="Próxima imagem"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/60 text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {imagens.length > 1 && (
        <div className="flex flex-col gap-2 min-w-0">
          {/* Contador: a informação que o pontinho nunca deu — em que ponto da
              série se está e quantas imagens existem ao todo. */}
          {/* Alinhado à direita e sozinho: a legenda da imagem já está escrita
              sobre a própria foto, repeti-la aqui só duplicaria a informação. */}
          <div className="flex justify-end min-w-0">
            <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
              {indice + 1}<span className="text-zinc-600"> / {imagens.length}</span>
            </span>
          </div>

          {/* Faixa de miniaturas. Rola na horizontal, então trinta imagens não
              mudam a altura do bloco nem espremem nada: a lista cresce para o
              lado, do jeito que o olho já espera numa galeria. */}
          <div
            ref={tirasRef}
            className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {imagens.map((img, i) => {
              const ativa = i === indice;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndice(i)}
                  aria-label={img.legenda || `Ir para a imagem ${i + 1}`}
                  aria-current={ativa}
                  className={`relative shrink-0 w-[76px] h-[50px] rounded-[3px] overflow-hidden border transition-all ${
                    ativa
                      ? 'border-blue-500 opacity-100'
                      : 'border-zinc-800 opacity-45 hover:opacity-90 hover:border-zinc-700'
                  }`}
                >
                  {/* lazy: só as miniaturas visíveis na faixa são baixadas —
                      são as imagens em tamanho cheio, sem versão reduzida. */}
                  <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ampliada && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setAmpliada(null)}>
          <button type="button" className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white" aria-label="Fechar">
            <X size={22} />
          </button>
          <img src={ampliada} alt="" className="max-h-full max-w-full object-contain rounded-md" />
        </div>
      )}
    </div>
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
        aria-expanded={aberta}
        className={`w-full flex items-center gap-3 ${GUTTER} py-4 min-h-[56px] text-left active:bg-zinc-900/50 transition-colors`}
      >
        <span className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">{icone}</span>
        <span className="flex-1 text-sm font-semibold text-zinc-100">{titulo}</span>
        <ChevronDown size={16} className={`text-zinc-600 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta && <div className={`${GUTTER} pb-5 animate-fade-in`}>{children}</div>}
    </div>
  );
}

/** Coluna de informação do desktop — sempre aberta, sem acordeão. */
function SecaoDesktop({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">{icone}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/**
 * Filtro de faixa com dois controles sobrepostos. Os `range` nativos ficam com
 * pointer-events desligado no trilho e ligado só no polegar, senão o de cima
 * cobriria o de baixo e uma das pontas nunca seria arrastável.
 */
function FaixaSlider({ min, max, step, valor, onChange, formatar }: {
  min: number;
  max: number;
  step: number;
  valor: Faixa;
  onChange: (f: Faixa) => void;
  formatar: (n: number) => string;
}) {
  const [lo, hi] = valor;
  const amplitude = max - min;
  const pct = (n: number) => (amplitude <= 0 ? 0 : ((n - min) / amplitude) * 100);
  const inativo = amplitude <= 0;

  const thumb = 'pointer-events-none absolute inset-x-0 w-full appearance-none bg-transparent h-8 ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 ' +
    '[&::-webkit-slider-thumb]:rounded-[3px] [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-300/60 [&::-webkit-slider-thumb]:cursor-pointer ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-[3px] [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-blue-300/60 [&::-moz-range-thumb]:cursor-pointer';

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-[2px] bg-zinc-800" />
        {!inativo && (
          <div className="absolute h-1 rounded-[2px] bg-blue-500/70" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        )}
        <input
          type="range" min={min} max={max} step={step} value={lo} disabled={inativo}
          onChange={e => onChange([Math.min(Number(e.target.value), hi), hi])}
          aria-label="Valor mínimo"
          className={thumb}
        />
        <input
          type="range" min={min} max={max} step={step} value={hi} disabled={inativo}
          onChange={e => onChange([lo, Math.max(Number(e.target.value), lo)])}
          aria-label="Valor máximo"
          className={thumb}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400">
        <span>{formatar(lo)}</span>
        <span>{formatar(hi)}</span>
      </div>
    </div>
  );
}

/**
 * Conteúdo da linha expandida: plantas à esquerda, campos à direita. É onde
 * cabem os dados que a linha compacta não mostra — no celular a tabela rola na
 * horizontal e boa parte das colunas fica fora da tela.
 */
function DetalheUnidade({ unidade, entradas, plantas, colspan, reservaUrl, larguraVisivel }: {
  unidade: LpCorretorPublicUnidade;
  /** Todas as colunas visíveis (linha + detalhe) — o card mostra todas elas. */
  entradas: ReturnType<typeof mergeLpColunas>;
  plantas: LpCorretorPlanta[];
  colspan: number;
  reservaUrl: string | null;
  /** Largura visível do container que rola — define a largura do card. */
  larguraVisivel: number;
}) {
  const [indice, setIndice] = useState(0);
  const planta = plantas[indice];
  return (
    <tr className="animate-fade-in">
      {/* O card é sticky à esquerda e tem a largura da área visível, não a da
          tabela: rolar a tabela na horizontal move as outras linhas por baixo
          dele, enquanto ele permanece parado e inteiro na tela. */}
      <td colSpan={colspan} className="p-0 bg-zinc-900/30 border-b border-zinc-900">
        <div className="sticky left-0" style={{ width: larguraVisivel || undefined }}>
          <div className={`${GUTTER} py-5`}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Plantas. A coluna inteira para em 500px — não só a imagem — para a
              legenda e os indicadores acompanharem a largura da planta em vez
              de atravessarem o card. */}
          <div className="flex flex-col gap-2 min-w-0 max-w-[500px]">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Plantas</p>
            {planta ? (
              <>
                {/* Esticar a planta para a largura toda do card no desktop só
                    engrossaria o traço sem revelar mais nada; abaixo do teto ela
                    acompanha a coluna, mantendo a proporção. O limite de altura
                    segura a planta em pé (retrato), que de outro modo empurraria
                    as informações da unidade para fora da tela — object-contain
                    a encolhe dentro da caixa em vez de cortá-la, e as sobras
                    laterais somem contra o fundo branco. Ele é branco porque a
                    planta vem com traço escuro sobre transparente e sumiria no
                    tema escuro da página. */}
                <img
                  src={planta.url}
                  alt={planta.legenda || `Planta da unidade ${unidade.unidade}`}
                  loading="lazy"
                  className="w-full h-auto max-h-[400px] object-contain rounded-md border border-zinc-800 bg-white p-[15px]"
                />
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <span className="text-xs text-zinc-400 truncate">{planta.legenda || `Planta ${indice + 1}`}</span>
                  {plantas.length > 1 && (
                    // Aqui o ponto continua servindo: uma unidade tem duas ou
                    // três plantas, não trinta. flex-wrap é só a rede de
                    // segurança para um empreendimento fora da curva.
                    <div className="flex flex-wrap items-center justify-end gap-1 min-w-0 max-w-[50%]">
                      {plantas.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setIndice(i)}
                          aria-label={p.legenda || `Planta ${i + 1}`}
                          className={`w-6 h-1.5 rounded-[2px] transition-colors ${i === indice ? 'bg-blue-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-600">Nenhuma planta publicada para esta unidade.</p>
            )}
          </div>

          {/* Demais informações */}
          <div className="flex flex-col gap-3 min-w-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Informações da unidade</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Situação</dt>
                <dd className="text-xs font-medium text-zinc-300">{LP_SITUACAO_LABELS[unidade.situacao]}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Valor</dt>
                <dd className="text-xs font-medium text-zinc-300">{unidade.valorTabela > 0 ? formatMoeda(unidade.valorTabela) : '—'}</dd>
              </div>
              {entradas.map(e => (
                // O card mostra todas as colunas visíveis, mesmo as que já
                // aparecem na linha compacta — inclusive no desktop, onde a
                // linha some por baixo do card ao expandir.
                <div key={e.id} className="min-w-0">
                  <dt className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider truncate">{e.label}</dt>
                  <dd className="text-xs font-medium text-zinc-300">{formatLpValor(e.tipo, e.read(unidade))}</dd>
                </div>
              ))}
            </dl>
            {unidade.descricao && <p className="text-xs text-zinc-500">{unidade.descricao}</p>}
            {reservaUrl && (
              <a
                href={reservaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full sm:w-auto sm:self-start sm:px-6 min-h-[44px] py-3 rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors"
              >
                Reservar <ArrowUpRight size={15} strokeWidth={2.5} />
              </a>
            )}
          </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/**
 * Tabela compacta: uma linha por unidade, que se expande ao ser tocada. No
 * celular rola na horizontal com a coluna da unidade fixa à esquerda — é a
 * única referência de qual linha se está lendo. No desktop cabe inteira.
 */
function UnidadesTabela({ unidades, visiveisIds, entradas, chavesLinha, plantas, cvcrmTemplate }: {
  /** Todas as unidades da versão — o PDF sai completo, sem filtro. */
  unidades: LpCorretorPublicUnidade[];
  /** Quais passam pelos filtros da tela; as demais só existem no PDF. */
  visiveisIds: Set<string>;
  /** Todas as colunas visíveis, na ordem configurada. */
  entradas: ReturnType<typeof mergeLpColunas>;
  /** Quais delas vão na linha compacta; o resto só no card expandido. */
  chavesLinha: Set<string>;
  plantas: LpCorretorPlanta[];
  cvcrmTemplate: string | null;
}) {
  const [expandida, setExpandida] = useState<string | null>(null);
  const temReserva = !!cvcrmTemplate?.trim();
  const stickyBg = 'bg-[#08080a]';
  const entradasLinha = useMemo(() => entradas.filter(e => chavesLinha.has(e.id)), [entradas, chavesLinha]);
  const colspan = 2 + entradasLinha.length + (temReserva ? 1 : 0) + 1;

  // O card expandido precisa ter a largura da área visível, não a da tabela —
  // é o que permite mantê-lo inteiro na tela enquanto as linhas rolam por baixo.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [larguraVisivel, setLarguraVisivel] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const medir = () => setLarguraVisivel(el.clientWidth);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={scrollRef} className="lp-tabela-scroll overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className={`${ROW_GUTTER} [&>th]:py-2 [&>th]:px-2 [&>th]:border-b [&>th]:border-zinc-800 [&>th]:text-[9px] lg:[&>th]:text-[10px] [&>th]:font-bold [&>th]:text-zinc-500 [&>th]:uppercase [&>th]:tracking-wider [&>th]:whitespace-nowrap`}>
            <th className={`sticky left-0 z-10 ${stickyBg} lg:static text-left`}>Un.</th>
            <th className="text-right">Valor</th>
            {entradasLinha.map(e => <th key={e.id} className="text-right">{e.label}</th>)}
            {temReserva && <th />}
            <th className="lp-no-print" />
          </tr>
        </thead>
        <tbody>
          {unidades.map(u => {
            const disponivel = u.situacao === 'disponivel';
            const reservaUrl = disponivel ? buildReservaUrl(cvcrmTemplate, u.unidade) : null;
            const aberta = expandida === u.id;
            return (
              <React.Fragment key={u.id}>
                {/* Esmaecer célula a célula, e não a linha inteira via opacity:
                    opacity no <tr> tornaria translúcido também o fundo da coluna
                    fixa, deixando as demais colunas rolarem visíveis por trás. */}
                <tr
                  onClick={() => setExpandida(aberta ? null : u.id)}
                  aria-expanded={aberta}
                  // lp-linha-disponivel só tem efeito na impressão: na tela a
                  // distinção já vem do contraste do texto e do ponto colorido,
                  // que no papel ficam fracos demais para varrer a lista.
                  className={`cursor-pointer ${ROW_GUTTER} ${disponivel ? 'lp-linha-disponivel' : ''} ${
                    // Filtrada fora na tela, mas presente no PDF: o documento
                    // é sempre a tabela inteira do empreendimento.
                    visiveisIds.has(u.id) ? '' : 'hidden print:table-row'
                  } [&>td]:py-2.5 [&>td]:px-2 [&>td]:border-b [&>td]:transition-colors ${
                    aberta
                      ? '[&>td]:bg-blue-500/10 [&>td]:border-blue-500/30'
                      : '[&>td]:border-zinc-900 lg:hover:[&>td]:bg-zinc-900/30'
                  }`}
                >
                  {/* A célula fixa precisa de fundo opaco próprio: o realce
                      translúcido da linha deixaria as outras colunas passarem
                      por trás dela durante a rolagem horizontal. */}
                  <td className={`sticky left-0 z-10 lg:static lg:bg-transparent ${aberta ? 'bg-[#101623]' : stickyBg}`}>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {/* data-sit sobrevive à virada de tema do PDF: lá o fundo
                          das classes utilitárias é zerado, e o ponto é
                          recolorido a partir deste atributo. */}
                      <span
                        data-sit={u.situacao}
                        className={`w-1.5 h-1.5 rounded-[2px] shrink-0 ${SITUACAO_DOT[u.situacao]}`}
                        title={LP_SITUACAO_LABELS[u.situacao]}
                      />
                      <span className={`text-xs font-bold ${aberta ? 'text-blue-300' : disponivel ? 'text-zinc-100' : 'text-zinc-600'}`}>{u.unidade}</span>
                    </span>
                  </td>
                  <td className={`text-right text-xs font-semibold whitespace-nowrap ${disponivel ? 'text-zinc-100' : 'text-zinc-600'}`}>
                    {u.valorTabela > 0 ? formatMoeda(u.valorTabela) : '—'}
                  </td>
                  {entradasLinha.map(e => (
                    <td key={e.id} className={`text-right text-[11px] lg:text-xs whitespace-nowrap ${disponivel ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {formatLpValor(e.tipo, e.read(u))}
                    </td>
                  ))}
                  {temReserva && (
                    <td className="text-right">
                      {reservaUrl ? (
                        // O link sobrevive à exportação: o PDF gerado pelo
                        // navegador mantém a âncora clicável, então o botão
                        // continua levando ao CVCRM a partir do arquivo.
                        <a
                          href={reservaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={ev => ev.stopPropagation()}
                          className="lp-botao-reserva inline-flex items-center gap-0.5 px-2 py-1.5 lg:px-3 rounded-[3px] text-[10px] lg:text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 whitespace-nowrap transition-colors"
                        >
                          <span className="print:hidden">Reservar</span>
                          <span className="hidden print:inline">Iniciar reserva</span>
                          <ArrowUpRight size={11} strokeWidth={2.5} />
                        </a>
                      ) : (
                        <span className="text-[10px] font-semibold text-zinc-600 whitespace-nowrap">{LP_SITUACAO_LABELS[u.situacao]}</span>
                      )}
                    </td>
                  )}
                  <td className="lp-no-print text-right">
                    <ChevronDown size={13} className={`inline text-zinc-600 transition-transform ${aberta ? 'rotate-180' : ''}`} />
                  </td>
                </tr>
                {aberta && (
                  <DetalheUnidade
                    unidade={u}
                    entradas={entradas}
                    plantas={plantasDaUnidade(plantas, u.unidade)}
                    colspan={colspan}
                    reservaUrl={reservaUrl}
                    larguraVisivel={larguraVisivel}
                  />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LpCorretorPage({ slug }: { slug: string }) {
  const [data, setData] = useState<LpCorretorPublicData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [secao, setSecao] = useState<SecaoAberta>(null);
  const [filtro, setFiltro] = useState<SiengeVendaSituacao | 'todas'>('disponivel');
  const [tipologia, setTipologia] = useState<string | 'todas'>('todas');
  const [faixaValor, setFaixaValor] = useState<Faixa | null>(null);
  const [faixaArea, setFaixaArea] = useState<Faixa | null>(null);
  const [tema, setTema] = useState<LpTema>(temaLpSalvo);
  const [baixando, setBaixando] = useState(false);
  const [erroPdf, setErroPdf] = useState(false);
  // null = ainda não escolhida; a RPC decide qual versão liberada abrir.
  const [versaoId, setVersaoId] = useState<string | null>(null);
  // Troca de versão não volta ao esqueleto: a página inteira (banner, ficha,
  // plantas) é a mesma, só a tabela muda. Sumir com tudo para remontar igual
  // faria a página piscar a cada toque num botão de versão.
  const [trocandoVersao, setTrocandoVersao] = useState(false);

  useEffect(() => {
    let ativo = true;
    const primeira = versaoId === null;
    if (!primeira) setTrocandoVersao(true);
    fetchLpCorretorPublic(slug, versaoId ?? undefined)
      .then(d => { if (ativo) { setData(d); setCarregando(false); setTrocandoVersao(false); } })
      .catch(() => { if (ativo) { setErro(true); setCarregando(false); setTrocandoVersao(false); } });
    return () => { ativo = false; };
  }, [slug, versaoId]);

  useEffect(() => {
    if (data) document.title = `${data.config.titulo || data.projeto.nome} — Tabela de Vendas`;
  }, [data]);

  // O tema já foi aplicado em main.tsx antes do primeiro render; aqui só se
  // reage à troca pelo botão, gravando a escolha para a próxima visita.
  useEffect(() => {
    aplicarTemaLp(tema);
    try { localStorage.setItem(LP_TEMA_STORAGE_KEY, tema); } catch { /* localStorage bloqueado: vale só nesta sessão */ }
  }, [tema]);

  const entradas = useMemo(() => (data ? mergeLpColunas(data.colunas, data.regras) : []), [data]);
  // Partição configurada no painel: quais colunas vão na linha compacta. O
  // restante aparece só no card expandido — e no celular o card repete também
  // as da linha, que saem da tela quando a tabela rola.
  const chavesLinha = useMemo(
    () => new Set(data?.config.colunasLinha || []),
    [data]
  );
  const unidades = useMemo(() => (data ? sortUnidades(data.unidades) : []), [data]);
  const colArea = useMemo(() => (data ? colunaMetragem(data.colunas) : null), [data]);

  // Tipologia: qual coluna carrega esse dado é decidido no painel, antes de
  // publicar — não existe campo fixo para isso, cada empreendimento guarda a
  // tipologia com um nome. Sem coluna apontada, nada disto é renderizado e a
  // barra de filtros fica exatamente como era.
  const entradaTipologia = useMemo(
    () => entradas.find(e => e.id === data?.config.colunaTipologia) || null,
    [entradas, data]
  );
  const valorTipologia = (u: LpCorretorPublicUnidade) =>
    (entradaTipologia ? formatLpValor(entradaTipologia.tipo, entradaTipologia.read(u)) : '—');
  const tipologias = useMemo(() => {
    if (!entradaTipologia) return [];
    const contagem = new Map<string, number>();
    for (const u of unidades) {
      const v = formatLpValor(entradaTipologia.tipo, entradaTipologia.read(u));
      // Unidade sem tipologia preenchida não vira botão nem some da lista:
      // ela simplesmente não é alcançada por nenhum filtro de tipologia.
      if (v === '—') continue;
      contagem.set(v, (contagem.get(v) || 0) + 1);
    }
    return [...contagem.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
      .map(([valor, total]) => ({ valor, total }));
  }, [entradaTipologia, unidades]);

  // Trocar de condição pode trocar as colunas, e a tipologia escolhida pode não
  // existir na nova — sem isto a tabela ficaria vazia sem explicação.
  useEffect(() => {
    if (tipologia !== 'todas' && !tipologias.some(t => t.valor === tipologia)) setTipologia('todas');
  }, [tipologias, tipologia]);

  // Limites dos sliders: derivados de todas as unidades, não do subconjunto
  // filtrado, senão arrastar uma ponta encolheria a própria escala.
  const limiteValor = useMemo<Faixa>(() => faixaDe(unidades.map(u => u.valorTabela).filter(v => v > 0)), [unidades]);
  const limiteArea = useMemo<Faixa>(
    () => (colArea ? faixaDe(unidades.map(u => valorNumerico(u, colArea.key)).filter(v => v > 0)) : [0, 0]),
    [unidades, colArea]
  );

  useEffect(() => { setFaixaValor(limiteValor); }, [limiteValor]);
  useEffect(() => { setFaixaArea(limiteArea); }, [limiteArea]);

  const faixasAtivas =
    (!!faixaValor && (faixaValor[0] > limiteValor[0] || faixaValor[1] < limiteValor[1])) ||
    (!!faixaArea && (faixaArea[0] > limiteArea[0] || faixaArea[1] < limiteArea[1]));

  // Os filtros são cumulativos: situação ∩ tipologia ∩ faixa de valor ∩ faixa
  // de área.
  const visiveis = unidades.filter(u => {
    if (filtro !== 'todas' && u.situacao !== filtro) return false;
    if (entradaTipologia && tipologia !== 'todas' && valorTipologia(u) !== tipologia) return false;
    if (faixaValor && u.valorTabela > 0 && (u.valorTabela < faixaValor[0] || u.valorTabela > faixaValor[1])) return false;
    if (colArea && faixaArea) {
      const area = valorNumerico(u, colArea.key);
      if (area > 0 && (area < faixaArea[0] || area > faixaArea[1])) return false;
    }
    return true;
  });

  const limparFaixas = () => { setFaixaValor(limiteValor); setFaixaArea(limiteArea); };
  const visiveisIds = new Set(visiveis.map(u => u.id));

  if (carregando) return <Skeleton />;
  if (erro || !data) return <NaoEncontrada />;

  const { config, projeto } = data;
  const banner = config.bannerUrl || projeto.coverImage;
  const canais = canaisDeContato();
  const temInfo = config.imagens.length > 0 || config.fichaTecnica.length > 0 || !!config.bookUrl;
  const disponiveis = unidades.filter(u => u.situacao === 'disponivel').length;
  const nome = config.titulo || projeto.nome;
  const versaoAtual = data.versoes.find(v => v.id === data.versaoId) || null;

  // O arquivo traz o empreendimento inteiro, independentemente dos filtros da
  // tela: quem manda a tabela para o cliente manda a tabela, não o recorte que
  // estava aberto no momento.
  const baixarPdf = async () => {
    if (baixando) return;
    setBaixando(true);
    setErroPdf(false);
    try {
      await baixarTabelaPdf({
        data,
        unidades,
        entradasLinha: entradas.filter(e => chavesLinha.has(e.id)),
        nome,
      });
    } catch {
      setErroPdf(true);
    } finally {
      setBaixando(false);
    }
  };

  return (
    // As áreas seguras cobrem o notch/ilha dinâmica em paisagem no iPhone; sem
    // isso o conteúdo passa por baixo do recorte quando o aparelho é girado.
    // overflow-x-hidden é rede de proteção: a rolagem horizontal legítima é a
    // da tabela, que tem o próprio container. Qualquer elemento que estoure a
    // largura aqui faria o celular exibir a página encolhida, com rolagem
    // lateral no corpo inteiro.
    <div
      className="lp-print min-h-[100svh] w-full overflow-x-hidden bg-[#08080a] text-zinc-100 antialiased"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      {/* A largura cresce por etapas em vez de saltar de 512px para o desktop:
          navegador interno de WhatsApp/Instagram e o modo "site para
          computador" montam a página com viewport largo, e uma coluna estreita
          travada no meio de 980px fica ilegível. */}
      <div className="mx-auto w-full max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-6xl">
        {/* Banner principal */}
        <header className="relative">
          {banner ? (
            // svh em vez de vh: no Safari do iPhone a barra de endereço some ao
            // rolar e o vh muda de valor, fazendo o banner "pular".
            <img src={banner} alt={nome} className="lp-capa w-full h-[62svh] min-h-[340px] lg:h-[72svh] lg:max-h-[640px] object-cover" />
          ) : (
            <div className="lp-capa w-full h-[38svh] min-h-[220px] lg:h-[46svh] bg-gradient-to-br from-zinc-900 to-[#08080a]" />
          )}
          {/* lp-capa-overlay: no PDF a página vira clara, mas este degradê
              continua escuro — é ele que sustenta o texto branco sobre a foto. */}
          <div className="lp-capa-overlay absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/40 to-transparent" />
          <div className={`absolute inset-x-0 bottom-0 ${GUTTER} pb-6 lg:pb-10`}>
            <div className="lg:max-w-2xl mx-auto flex flex-col items-center text-center">
              {/* Identidade do produto: o logo substitui o nome em texto; sem
                  logo enviado, o nome volta como fallback. O h1 permanece
                  sempre, invisível quando há logo, para leitores de tela. */}
              <h1 className={config.logoEmpreendimentoUrl ? 'sr-only' : 'text-2xl sm:text-3xl lg:text-5xl font-bold leading-tight drop-shadow'}>
                {nome}
              </h1>
              {config.logoEmpreendimentoUrl && (
                // Dimensionado por LARGURA, não por altura: logos horizontais e
                // verticais chegam com proporções muito diferentes, e travar a
                // altura fazia o horizontal atravessar a coluna. 170px é o piso
                // (celular) e o desktop escala até 230px.
                // A margem inferior é o respiro pedido até o texto de baixo.
                <img
                  src={config.logoEmpreendimentoUrl}
                  alt={nome}
                  className="w-[170px] sm:w-[200px] lg:w-[230px] h-auto max-w-full object-contain drop-shadow-lg mb-[50px]"
                />
              )}
              {config.subtitulo && <p className="mt-2 text-sm lg:text-lg text-zinc-300">{config.subtitulo}</p>}
              {config.descricao && (
                <p className="mt-2 text-xs lg:text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{config.descricao}</p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] lg:text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-[3px] px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400" />
                {disponiveis} {disponiveis === 1 ? 'unidade disponível' : 'unidades disponíveis'}
              </div>
            </div>
          </div>
        </header>

        {/* Menu de informações — celular: imagens sempre abertas, ficha em
            acordeão; desktop: tudo lado a lado em colunas. */}
        {temInfo && (
          <>
            {/* Fora do PDF: a galeria não se navega no papel e as informações
                o cliente pediu para não sair. Sobram capa, tabela, observações
                e rodapé. */}
            <nav className="lp-no-print border-t border-zinc-900 lg:hidden">
              {config.imagens.length > 0 && (
                <div className="border-b border-zinc-900">
                  <div className={`flex items-center gap-3 ${GUTTER} py-4`}>
                    <span className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                      <Images size={15} />
                    </span>
                    <h3 className="flex-1 text-sm font-semibold text-zinc-100">Imagens do Produto</h3>
                  </div>
                  <div className={`${GUTTER} pb-5`}>
                    <Galeria imagens={config.imagens} />
                  </div>
                </div>
              )}
              <SecaoAcordeao id="ficha" titulo="Informações" icone={<ListChecks size={15} />} aberta={secao === 'ficha'} onToggle={setSecao}>
                <Informacoes itens={config.fichaTecnica} bookUrl={config.bookUrl} />
              </SecaoAcordeao>
            </nav>

            {/* Desktop: imagens ocupam duas das três colunas, informações a terceira. */}
            <div className={`lp-no-print hidden lg:grid grid-cols-3 gap-8 ${GUTTER} py-10 border-t border-zinc-900 items-start`}>
              <div className="col-span-2 min-w-0">
                <SecaoDesktop titulo="Imagens do Produto" icone={<Images size={14} />}>
                  <SliderImagens imagens={config.imagens} />
                </SecaoDesktop>
              </div>
              <SecaoDesktop titulo="Informações" icone={<ListChecks size={14} />}>
                <Informacoes itens={config.fichaTecnica} bookUrl={config.bookUrl} />
              </SecaoDesktop>
            </div>
          </>
        )}

        {/* Tabela de vendas */}
        <section className={`${GUTTER} pt-6 lg:pt-10 pb-2 flex items-start justify-between gap-4`}>
          <div className="min-w-0">
            <h2 className="text-sm lg:text-xl font-bold text-zinc-100">Tabela de Vendas</h2>
            <p className="text-xs lg:text-sm text-zinc-500 mt-0.5">
              Atualizada em {new Date(config.atualizadoEm).toLocaleDateString('pt-BR')}
              <span className="lp-no-print"> · toque numa unidade para ver planta e detalhes</span>
            </p>
            {/* No papel o seletor de condição some, então a condição impressa
                precisa estar escrita — senão duas tabelas com valores
                diferentes saem como PDFs indistinguíveis. */}
            {data.versoes.length > 1 && versaoAtual && (
              <p className="hidden print:block text-xs font-semibold text-zinc-300 mt-1">
                Condição: {versaoAtual.nome}
              </p>
            )}
          </div>
          <div className="lp-no-print flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {/* Tema da página inteira. A escolha é de quem abre o link — o
                  corretor manda a tabela clara para o cliente que vai imprimir
                  e mantém a escura para si, sem depender de sessão. */}
              <button
                type="button"
                onClick={() => setTema(t => (t === 'escuro' ? 'claro' : 'escuro'))}
                aria-label={tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
                title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
                className="flex items-center justify-center w-[38px] h-[38px] rounded-md text-zinc-300 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 hover:text-white transition-colors"
              >
                {tema === 'escuro' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                type="button"
                onClick={baixarPdf}
                disabled={baixando}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-md text-xs font-bold text-zinc-200 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-60"
              >
                {baixando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {baixando ? 'Gerando...' : 'Baixar PDF'}
              </button>
            </div>
            {erroPdf && <span className="text-[10px] font-semibold text-red-400">Não foi possível gerar o PDF. Tente de novo.</span>}
          </div>
        </section>

        {/* Toda a faixa de controles fica fora do documento: seletor de
            condição, situação, tipologia e as duas faixas. Nenhum deles é
            operável no papel — e o arquivo sai com a tabela inteira, não com o
            recorte que estava aberto na tela. */}
        <div className="lp-no-print sticky top-0 z-20 bg-[#08080a]/95 backdrop-blur border-b border-zinc-900">
          {/* Versões liberadas. Ficam acima e com mais peso que os demais
              filtros porque não filtram a lista: trocam a tabela inteira —
              outras colunas, outros valores. Com uma versão só, o seletor não
              tem função e some. */}
          {data.versoes.length > 1 && (
            <div className={`${GUTTER} pt-3 pb-2.5 flex flex-col gap-1 border-b border-zinc-900/80`}>
              <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Condição
                {trocandoVersao && <Loader2 size={12} className="animate-spin shrink-0" />}
              </span>
              {/* Ocupam a largura toda, como as faixas de valor e tamanho logo
                  abaixo: os botões dividem a linha em partes iguais e só quebram
                  quando o nome da condição não couber em ~140px. */}
              <div className="flex flex-wrap gap-1.5">
                {data.versoes.map(v => {
                  const ativa = v.id === data.versaoId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVersaoId(v.id)}
                      disabled={trocandoVersao}
                      aria-pressed={ativa}
                      className={`flex-1 basis-[140px] px-3.5 py-2 min-h-[38px] rounded-md text-xs font-bold border transition-colors disabled:opacity-60 ${
                        ativa
                          ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]'
                          : 'text-zinc-300 bg-zinc-900 border-zinc-700 hover:border-zinc-600 hover:text-white'
                      }`}
                    >
                      {v.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`${GUTTER} py-3 flex items-center gap-2`}>
            <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(['disponivel', 'todas'] as const).map(f => {
                const total = f === 'todas' ? unidades.length : unidades.filter(u => u.situacao === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltro(f)}
                    className={`shrink-0 px-3 py-2 min-h-[36px] rounded-[3px] text-[11px] font-bold border transition-colors ${
                      filtro === f ? 'bg-blue-500/15 text-blue-300 border-blue-400/40' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    {f === 'todas' ? 'Todas' : LP_SITUACAO_LABELS[f]} <span className="opacity-60">{total}</span>
                  </button>
                );
              })}
            </div>

            {faixasAtivas && (
              <button
                type="button"
                onClick={limparFaixas}
                className="shrink-0 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Limpar faixas
              </button>
            )}
          </div>

          {/* Tipologia. Só existe quando o painel apontou a coluna que guarda
              esse dado e ela tem mais de um valor — com um valor só, o filtro
              não separa nada. Um toque troca o recorte inteiro, como os botões
              de situação logo acima. */}
          {tipologias.length > 1 && (
            <div className={`${GUTTER} pb-3 -mt-1 flex flex-col gap-1.5`}>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {entradaTipologia?.label}
              </span>
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[{ valor: 'todas' as const, total: unidades.length }, ...tipologias].map(t => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setTipologia(t.valor)}
                    aria-pressed={tipologia === t.valor}
                    className={`shrink-0 px-3 py-2 min-h-[36px] rounded-[3px] text-[11px] font-bold border transition-colors ${
                      tipologia === t.valor ? 'bg-blue-500/15 text-blue-300 border-blue-400/40' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    {t.valor === 'todas' ? 'Todas' : t.valor} <span className="opacity-60">{t.total}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`${GUTTER} pb-4 grid gap-4 sm:grid-cols-2`}>
            {faixaValor && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Valor</span>
                <FaixaSlider
                  min={limiteValor[0]} max={limiteValor[1]} step={1000}
                  valor={faixaValor} onChange={setFaixaValor} formatar={formatMoeda}
                />
              </div>
            )}
            {colArea && faixaArea && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{colArea.label}</span>
                <FaixaSlider
                  min={limiteArea[0]} max={limiteArea[1]} step={1}
                  valor={faixaArea} onChange={setFaixaArea}
                  formatar={n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²`}
                />
              </div>
            )}
          </div>
        </div>

        {visiveis.length === 0 && (
          <p className="lp-no-print text-sm text-zinc-500 text-center py-10">Nenhuma unidade com esses filtros.</p>
        )}
        {/* A tabela sempre recebe a lista completa: o PDF traz o empreendimento
            inteiro, independentemente do filtro em que a tela estiver. Quando o
            filtro não deixa nada de pé, o bloco some da tela mas continua indo
            para o papel. */}
        <div className={`py-4 ${visiveis.length === 0 ? 'hidden print:block' : ''}`}>
          <UnidadesTabela
            unidades={unidades}
            visiveisIds={visiveisIds}
            entradas={entradas}
            chavesLinha={chavesLinha}
            plantas={config.plantas}
            cvcrmTemplate={config.cvcrmUrlTemplate}
          />
        </div>

        {/* Rodapé com observações */}
        {config.observacoes && (
          <section className="lp-quebra-evitar mx-5 sm:mx-6 lg:mx-8 mb-8 lg:mb-12 p-4 lg:p-6 rounded-md bg-zinc-900/40 border border-zinc-900">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Observações</h3>
            <p className="text-xs lg:text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{config.observacoes}</p>
          </section>
        )}

        {/* Footer institucional. Um fio de degradê marca o início do rodapé em
            vez de uma borda plana — o mesmo azul da marca, quase imperceptível. */}
        <footer
          className="lp-quebra-evitar relative border-t border-zinc-900"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

          <div className={`${GUTTER} py-10 lg:py-14`}>
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
              {/* Marca: sem opacidade reduzida — era o que fazia o logo parecer
                  desbotado sobre o fundo quase preto. */}
              <div className="flex flex-col gap-4 lg:max-w-sm">
                <img src={LP_EMPRESA.logoUrl} alt={LP_EMPRESA.nome} className="h-8 lg:h-9 w-auto object-contain" />
                {LP_EMPRESA.descricao && (
                  <p className="text-sm text-zinc-400 leading-relaxed">{LP_EMPRESA.descricao}</p>
                )}
                {LP_EMPRESA.endereco && (
                  <p className="flex items-start gap-1.5 text-xs text-zinc-500">
                    <MapPin size={13} className="shrink-0 mt-0.5 text-zinc-600" /> {LP_EMPRESA.endereco}
                  </p>
                )}
              </div>

              {canais.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 lg:w-auto lg:min-w-[380px]">
                  {canais.map(c => (
                    <a
                      key={c.label}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-3.5 py-3 min-h-[56px] rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/70 active:bg-zinc-900/70 transition-colors"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/80 text-zinc-400 shrink-0 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                        {CANAL_ICONE[c.label]}
                      </span>
                      <span className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{c.label}</span>
                        <span className="text-xs font-medium text-zinc-200 truncate">{c.texto}</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                {LP_EMPRESA.creci && <span className="text-zinc-500">{LP_EMPRESA.creci} · </span>}
                Valores sujeitos a alteração sem aviso prévio. Esta tabela é de uso exclusivo dos corretores
                credenciados e não constitui proposta comercial.
              </p>
              <p className="text-[11px] text-zinc-600 shrink-0">
                © {new Date().getFullYear()} {LP_EMPRESA.nome}. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
