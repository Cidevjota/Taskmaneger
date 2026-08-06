/* ============================================================================
   LP DO CORRETOR — DOWNLOAD DA TABELA EM PDF
   ----------------------------------------------------------------------------
   O botão antes chamava window.print(), que abre o diálogo de impressão e
   depende de o corretor achar "Salvar como PDF" — no celular, onde a página é
   aberta na prática, isso quase nunca termina em arquivo. Aqui o PDF é montado
   e baixado direto.

   O jsPDF é carregado sob demanda (import dinâmico dentro da função): a LP é
   code-split de propósito em main.tsx e não pode arrastar a biblioteca para o
   primeiro carregamento de quem só quer ver a tabela.

   O documento é claro, como o CSS de impressão sempre foi: o branco da folha é
   o fundo, e cada cor é fixada aqui porque nada do tema (--t-*) da aplicação
   vale dentro do arquivo.
   ========================================================================== */

import { LpCorretorPublicData, LpCorretorPublicUnidade } from '../types';
import { LP_SITUACAO_LABELS, LpColunaEntry, buildReservaUrl, formatLpValor, formatMoeda } from './lpCorretor';
import { LP_EMPRESA } from './lpCorretorEmpresa';

const COR = {
  texto: [24, 24, 27] as [number, number, number],
  apagado: [161, 161, 170] as [number, number, number],
  cabecalho: [82, 82, 91] as [number, number, number],
  linha: [228, 228, 231] as [number, number, number],
  linhaForte: [161, 161, 170] as [number, number, number],
  // Realce da unidade disponível: só o fundo verde claro. Sem barra lateral e
  // sem borda verde — duas marcas para a mesma informação poluíam a leitura.
  disponivel: [236, 253, 245] as [number, number, number],
  acao: [37, 99, 235] as [number, number, number],
  capa: [24, 24, 27] as [number, number, number],
};

/**
 * Baixa a imagem e a devolve como data URL já reprocessada pelo canvas. O
 * reprocessamento resolve dois problemas de uma vez: normaliza formatos que o
 * jsPDF não lê (webp, avif) e reduz o peso do arquivo final. Devolve null em
 * qualquer falha — CORS, 404, formato que nem o navegador decodifica —, e o
 * documento sai sem a imagem em vez de não sair.
 */
async function carregarImagem(
  url: string,
  formato: 'JPEG' | 'PNG',
): Promise<{ dataUrl: string; largura: number; altura: number } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const origem = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = origem;
    });
    // Data URL é mesma origem: o canvas não fica "tainted" e o toDataURL passa.
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      // PNG para o logo (fundo transparente sobre a capa escura); JPEG para a
      // foto da capa, que não tem transparência e pesaria três vezes mais.
      dataUrl: formato === 'PNG' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82),
      largura: img.naturalWidth,
      altura: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

function nomeArquivo(partes: (string | null | undefined)[]): string {
  const base = partes
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'tabela'}.pdf`;
}

export interface BaixarTabelaPdfArgs {
  data: LpCorretorPublicData;
  /** Unidades na ordem em que devem sair — já ordenadas pela página. */
  unidades: LpCorretorPublicUnidade[];
  /** Colunas da linha compacta, na ordem configurada. */
  entradasLinha: LpColunaEntry[];
  /** Nome exibido do empreendimento (título da LP ou nome do projeto). */
  nome: string;
}

export async function baixarTabelaPdf({ data, unidades, entradasLinha, nome }: BaixarTabelaPdfArgs): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const { config } = data;
  const versao = data.versoes.find(v => v.id === data.versaoId) || null;
  const temReserva = !!config.cvcrmUrlTemplate?.trim();

  // Retrato para tabelas enxutas; a partir de seis colunas a folha deitada é o
  // que impede os valores de quebrarem em duas linhas.
  const totalColunas = 2 + entradasLinha.length + (temReserva ? 1 : 0);
  const paisagem = totalColunas > 5;
  const doc = new jsPDF({ orientation: paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;

  // ── Capa ────────────────────────────────────────────────────────────────
  // Faixa escura no topo com a foto do empreendimento e o logo por cima. É
  // escura mesmo num documento claro pelo mesmo motivo da tela: o logo e o
  // nome são claros e desapareceriam sobre o branco da folha.
  const capaH = paisagem ? 52 : 58;
  const banner = config.bannerUrl || data.projeto.coverImage;
  const [imgBanner, imgLogo] = await Promise.all([
    banner ? carregarImagem(banner, 'JPEG') : Promise.resolve(null),
    config.logoEmpreendimentoUrl ? carregarImagem(config.logoEmpreendimentoUrl, 'PNG') : Promise.resolve(null),
  ]);

  doc.setFillColor(...COR.capa);
  doc.rect(0, 0, pageW, capaH, 'F');
  if (imgBanner) {
    try {
      doc.addImage(imgBanner.dataUrl, 'JPEG', 0, 0, pageW, capaH, undefined, 'FAST');
      // Véu escuro sobre a foto: sem ele o logo branco some num céu claro.
      const GState = (doc as any).GState;
      if (GState) doc.setGState(new GState({ opacity: 0.55 }));
      doc.setFillColor(...COR.capa);
      doc.rect(0, 0, pageW, capaH, 'F');
      if (GState) doc.setGState(new GState({ opacity: 1 }));
    } catch {
      // Formato que o jsPDF recusou: fica a faixa escura já desenhada.
    }
  }

  let y = capaH / 2;
  if (imgLogo) {
    const maxW = paisagem ? 52 : 46;
    const maxH = 20;
    const escala = Math.min(maxW / imgLogo.largura, maxH / imgLogo.altura);
    const w = imgLogo.largura * escala;
    const h = imgLogo.altura * escala;
    try {
      doc.addImage(imgLogo.dataUrl, 'PNG', (pageW - w) / 2, y - h / 2 - 4, w, h);
      y += h / 2 + 3;
    } catch {
      // Sem logo utilizável, o nome em texto abaixo assume a identificação.
    }
  }
  if (!imgLogo) {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(paisagem ? 22 : 19);
    doc.text(nome, pageW / 2, y, { align: 'center' });
    y += 6;
  }
  if (config.subtitulo) {
    doc.setTextColor(228, 228, 231);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(config.subtitulo, pageW / 2, y + 3, { align: 'center', maxWidth: pageW - 2 * M });
  }

  // ── Título da tabela ────────────────────────────────────────────────────
  let cursor = capaH + 9;
  doc.setTextColor(...COR.texto);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Tabela de Vendas', M, cursor);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COR.cabecalho);
  // A condição precisa estar escrita: duas versões da mesma tabela geram
  // arquivos com valores diferentes e, sem isso, indistinguíveis.
  const legenda = [
    `Atualizada em ${new Date(config.atualizadoEm).toLocaleDateString('pt-BR')}`,
    versao && data.versoes.length > 1 ? `Condição: ${versao.nome}` : null,
  ].filter(Boolean).join('   ·   ');
  doc.text(legenda, pageW - M, cursor, { align: 'right' });
  cursor += 4;

  // ── Tabela ──────────────────────────────────────────────────────────────
  const head = [[
    'Un.',
    'Valor',
    ...entradasLinha.map(e => e.label),
    ...(temReserva ? ['Reserva'] : []),
  ]];

  const linksPorLinha = new Map<number, string>();
  const body = unidades.map((u, i) => {
    const disponivel = u.situacao === 'disponivel';
    const reservaUrl = disponivel ? buildReservaUrl(config.cvcrmUrlTemplate, u.unidade) : null;
    if (reservaUrl) linksPorLinha.set(i, reservaUrl);
    return [
      u.unidade,
      u.valorTabela > 0 ? formatMoeda(u.valorTabela) : '—',
      ...entradasLinha.map(e => formatLpValor(e.tipo, e.read(u))),
      ...(temReserva ? [reservaUrl ? 'Iniciar reserva' : LP_SITUACAO_LABELS[u.situacao]] : []),
    ];
  });

  const colunaReserva = temReserva ? head[0].length - 1 : -1;

  autoTable(doc, {
    head,
    body,
    startY: cursor,
    margin: { top: 12, left: M, right: M, bottom: 14 },
    theme: 'plain',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 1.4, bottom: 1.4, left: 1.6, right: 1.6 },
      textColor: COR.texto,
      lineColor: COR.linha,
      lineWidth: { bottom: 0.15 },
      overflow: 'linebreak',
    },
    headStyles: {
      fontSize: 7,
      fontStyle: 'bold',
      textColor: COR.cabecalho,
      lineColor: COR.linhaForte,
      lineWidth: { bottom: 0.3 },
      halign: 'right',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: cell => {
      if (cell.section === 'head') {
        if (cell.column.index === 0) cell.cell.styles.halign = 'left';
        return;
      }
      if (cell.column.index > 1 && cell.column.index !== colunaReserva) cell.cell.styles.halign = 'right';
      if (cell.column.index === colunaReserva) cell.cell.styles.halign = 'right';

      const u = unidades[cell.row.index];
      if (!u) return;
      if (u.situacao === 'disponivel') {
        // Realce das disponíveis: no papel não há filtro nem hover, e o fundo
        // verde claro é o que se enxerga folheando uma lista de centenas.
        cell.cell.styles.fillColor = COR.disponivel;
      } else {
        cell.cell.styles.textColor = COR.apagado;
      }
      if (cell.column.index === colunaReserva && linksPorLinha.has(cell.row.index)) {
        cell.cell.styles.textColor = COR.acao;
        cell.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: cell => {
      // O link continua vivo dentro do arquivo: tocar na célula abre o CVCRM.
      if (cell.section !== 'body' || cell.column.index !== colunaReserva) return;
      const url = linksPorLinha.get(cell.row.index);
      if (url) doc.link(cell.cell.x, cell.cell.y, cell.cell.width, cell.cell.height, { url });
    },
  });

  // ── Observações ─────────────────────────────────────────────────────────
  if (config.observacoes) {
    const ultima = (doc as any).lastAutoTable?.finalY ?? cursor;
    let oy = ultima + 8;
    const linhas = doc.splitTextToSize(config.observacoes, pageW - 2 * M) as string[];
    if (oy + linhas.length * 3.6 > pageH - 16) {
      doc.addPage();
      oy = M + 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COR.cabecalho);
    doc.text('OBSERVAÇÕES', M, oy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COR.texto);
    doc.text(linhas, M, oy + 4.5);
  }

  // ── Rodapé ──────────────────────────────────────────────────────────────
  // Carimbado no fim, quando o total de páginas já é conhecido.
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COR.apagado);
    doc.text(
      `${LP_EMPRESA.creci ? `${LP_EMPRESA.creci} · ` : ''}Valores sujeitos a alteração sem aviso prévio. Uso exclusivo dos corretores credenciados; não constitui proposta comercial.`,
      M,
      pageH - 6,
      { maxWidth: pageW - 2 * M - 20 },
    );
    doc.text(`${p}/${totalPaginas}`, pageW - M, pageH - 6, { align: 'right' });
  }

  doc.save(nomeArquivo([
    'Tabela',
    config.slug || nome,
    data.versoes.length > 1 ? versao?.nome : null,
    new Date().toISOString().slice(0, 10),
  ]));
}
