import React, { useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { Project, SiengeTitle, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeProjectTotal, SiengeVenda } from '../types';
import { analyzeProjectsForPeriod, monthlyTotalsForYear, dailyCumulativeForMonth } from '../lib/siengeMetasAnalysis';
import { getVgvRealAcumulado, getGastoRealAcumuladoProjetos, ORCAMENTO_PCT } from '../lib/siengeVendasBudget';

interface SiengeSpendChartProps {
  projects: Project[];
  titles: SiengeTitle[];
  projectMetas: SiengeProjectMeta[];
  categoriaOrcamento: SiengeCategoriaOrcamento[];
  projectTotais: SiengeProjectTotal[];
  vendas: SiengeVenda[];
  controleInicio: string;
  year: number;
  month: number | null; // null = visão anual
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mil`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// Estimativa de largura de texto (sem medir DOM) para dimensionar o espaço
// reservado ao eixo Y de acordo com o tamanho real dos labels formatados.
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

// Mede a largura real do container via ResizeObserver, para que o viewBox do
// SVG corresponda 1:1 ao tamanho renderizado — sem isso, `preserveAspectRatio`
// escalava X e Y de forma independente e "esticava" traços, pontos e tracejados.
function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    observer.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

const H = 260;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const Y_LABEL_FONT_SIZE = 9;

export default function SiengeSpendChart({ projects, titles, projectMetas, categoriaOrcamento, projectTotais, vendas, controleInicio, year, month }: SiengeSpendChartProps) {
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const { ref: containerRef, width: measuredWidth } = useContainerWidth<HTMLDivElement>();
  const W = Math.max(320, measuredWidth || 960);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const vendasEscopo = useMemo(() => {
    const ids = new Set(projects.map(p => p.id));
    return vendas.filter(v => ids.has(v.projectId));
  }, [projects, vendas]);

  // ── Visão anual: gasto por mês (barras) + orçamento real gerado naquele mês
  // (variação do VGV real acumulado dentro do mês × 2%) como linha de referência.
  const yearly = useMemo(() => {
    if (month !== null) return null;
    const base = monthlyTotalsForYear(projects, titles, projectMetas, categoriaOrcamento, year, projectTotais, controleInicio);
    return base.map(m => {
      const inicioMes = new Date(year, m.month, 1, 0, 0, 0);
      const fimMes = new Date(year, m.month + 1, 0, 23, 59, 59);
      const vgvInicio = getVgvRealAcumulado(vendasEscopo, new Date(inicioMes.getTime() - 1));
      const vgvFim = getVgvRealAcumulado(vendasEscopo, fimMes);
      const orcamentoReal = Math.max(vgvFim - vgvInicio, 0) * ORCAMENTO_PCT;
      return { ...m, orcamentoReal };
    });
  }, [projects, titles, projectMetas, categoriaOrcamento, year, month, projectTotais, controleInicio, vendasEscopo]);

  // ── Visão mensal: gasto real acumulado desde o início do controle (carrega o
  // saldo dos meses anteriores) vs Orçamento Real Acumulado (também acumulado,
  // sobe a cada venda) — critério de estouro real. A projeção por meta (Camada 2)
  // aparece só como referência tracejada.
  const monthly = useMemo(() => {
    if (month === null) return null;
    const budgetMeta = analyzeProjectsForPeriod(projects, titles, projectMetas, categoriaOrcamento, year, month, projectTotais, controleInicio)
      .reduce((s, a) => s + a.totalOrcamento, 0);
    const monthStart = new Date(year, month, 1, 0, 0, 0);
    const baselineGasto = getGastoRealAcumuladoProjetos(titles, projects, controleInicio, new Date(monthStart.getTime() - 1));
    const daily = dailyCumulativeForMonth(projects, titles, year, month, controleInicio).map(d => ({
      day: d.day,
      gastoAcumulado: baselineGasto + d.cumulative,
      orcamentoRealAcumulado: getVgvRealAcumulado(vendasEscopo, new Date(year, month, d.day, 23, 59, 59)) * ORCAMENTO_PCT,
    }));
    return { budgetMeta, daily };
  }, [projects, titles, projectMetas, categoriaOrcamento, year, month, projectTotais, controleInicio, vendasEscopo]);

  const handleLeave = useCallback(() => setHoverIndex(null), []);

  if (yearly) {
    const maxVal = Math.max(1, ...yearly.map(m => Math.max(m.gasto, m.orcamentoReal)));
    const yLabels = [0, 0.5, 1].map(f => formatCurrencyShort(maxVal * f));
    const padL = Math.max(44, 24 + Math.max(...yLabels.map(l => estimateTextWidth(l, Y_LABEL_FONT_SIZE))));
    const innerW = W - padL - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const barSlot = innerW / 12;
    const barW = Math.min(28, barSlot * 0.46);
    const yFor = (v: number) => PAD_T + innerH - (v / maxVal) * innerH;
    const orcamentoPoints = yearly.map((m, i) => `${padL + barSlot * i + barSlot / 2},${yFor(m.orcamentoReal)}`).join(' ');
    const hovered = hoverIndex !== null ? yearly[hoverIndex] : null;

    const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.min(11, Math.max(0, Math.floor((x - padL) / barSlot)));
      setHoverIndex(idx);
    };

    return (
      <div ref={containerRef} className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full block select-none"
          style={{ height: H }}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          {/* Grade horizontal */}
          {[0, 0.5, 1].map(f => (
            <line key={f} x1={padL} x2={W - PAD_R} y1={PAD_T + innerH * (1 - f)} y2={PAD_T + innerH * (1 - f)} stroke="#1F1F22" strokeWidth={1} />
          ))}
          {/* Eixo Y labels — ancorados à esquerda, todos na mesma coluna x */}
          {[0, 0.5, 1].map(f => (
            <text key={f} x={0} y={PAD_T + innerH * (1 - f) + 3} textAnchor="start" fontSize={Y_LABEL_FONT_SIZE} fill="#6B6B70">
              {formatCurrencyShort(maxVal * f)}
            </text>
          ))}
          {/* Destaque do mês atual */}
          {isCurrentYear && (
            <rect x={padL + barSlot * now.getMonth()} y={PAD_T} width={barSlot} height={innerH} fill="#5E6AD2" opacity={0.05} rx={4} />
          )}
          {/* Coluna de hover */}
          {hoverIndex !== null && (
            <rect x={padL + barSlot * hoverIndex} y={PAD_T} width={barSlot} height={innerH} fill="rgba(255,255,255,0.03)" />
          )}
          {/* Barras de gasto */}
          {yearly.map((m, i) => {
            const isCurrent = isCurrentYear && m.month === now.getMonth();
            const over = m.gasto > m.orcamentoReal;
            const barH = Math.max(0, PAD_T + innerH - yFor(m.gasto));
            return (
              <rect
                key={i}
                x={padL + barSlot * i + (barSlot - barW) / 2}
                y={yFor(m.gasto)}
                width={barW}
                height={barH}
                rx={3}
                fill={over ? '#F85149' : '#5E6AD2'}
                opacity={over ? 0.9 : isCurrent ? 1 : hoverIndex === null || hoverIndex === i ? 0.7 : 0.35}
                style={{ transition: 'opacity 120ms ease' }}
              />
            );
          })}
          {/* Linha de orçamento real gerado no mês (2% do VGV vendido naquele mês) */}
          <polyline points={orcamentoPoints} fill="none" stroke="#6B6B70" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 5" />
          {yearly.map((m, i) => (
            <circle key={i} cx={padL + barSlot * i + barSlot / 2} cy={yFor(m.orcamentoReal)} r={hoverIndex === i ? 4 : 2.5} fill="#6B6B70" style={{ transition: 'r 120ms ease' }} />
          ))}
          {/* Eixo X labels */}
          {yearly.map((m, i) => (
            <text
              key={i}
              x={padL + barSlot * i + barSlot / 2}
              y={H - 10}
              textAnchor="middle"
              fontSize={9}
              fontWeight={400}
              fill={hoverIndex === i ? '#EDEDED' : isCurrentYear && m.month === now.getMonth() ? '#A0A0A5' : '#6B6B70'}
            >
              {MONTHS_SHORT[m.month]}
            </text>
          ))}
        </svg>

        <div className="flex items-center justify-between px-1 pt-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#6B6B70]"><span className="w-1.5 h-1.5 rounded-full bg-[#5E6AD2]" /> Gasto realizado</span>
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#6B6B70]"><span className="w-1.5 h-1.5 rounded-full bg-[#F85149]" /> Acima do orçamento real</span>
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#6B6B70]"><span className="w-2.5 h-0 border-t border-dashed border-[#6B6B70]" /> Orçamento real do mês</span>
          </div>
          {hovered && (
            <span className="text-[11px] font-normal text-[#A0A0A5]">
              {MONTHS_SHORT[hovered.month]} · {formatCurrencyShort(hovered.gasto)} de {formatCurrencyShort(hovered.orcamentoReal)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (monthly) {
    const { budgetMeta, daily } = monthly;
    const maxGasto = daily.length > 0 ? daily[daily.length - 1].gastoAcumulado : 0;
    const maxOrcamentoReal = Math.max(0, ...daily.map(d => d.orcamentoRealAcumulado));
    const yMax = Math.max(1, maxGasto * 1.2, maxOrcamentoReal * 1.2, budgetMeta * 1.2);
    const yLabels = [0, 0.5, 1].map(f => formatCurrencyShort(yMax * f));
    const padL = Math.max(44, 24 + Math.max(...yLabels.map(l => estimateTextWidth(l, Y_LABEL_FONT_SIZE))));
    const padR = PAD_R;
    const innerW = W - padL - padR;
    const innerH = H - PAD_T - PAD_B;
    const budgetMetaY = PAD_T + innerH - (budgetMeta / yMax) * innerH;
    const xFor = (day: number) => padL + ((day - 1) / Math.max(1, daily.length - 1)) * innerW;
    const yFor = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
    const linePoints = daily.map(d => `${xFor(d.day)},${yFor(d.gastoAcumulado)}`).join(' ');
    const orcamentoRealPoints = daily.map(d => `${xFor(d.day)},${yFor(d.orcamentoRealAcumulado)}`).join(' ');
    const areaPoints = `${padL},${PAD_T + innerH} ${linePoints} ${xFor(daily[daily.length - 1]?.day ?? 1)},${PAD_T + innerH}`;
    const orcamentoRealFinal = daily.length > 0 ? daily[daily.length - 1].orcamentoRealAcumulado : 0;
    const overBudget = maxGasto > orcamentoRealFinal;
    const todayInMonth = isCurrentYear && month === now.getMonth();
    const accent = overBudget ? '#F85149' : '#3FB950';
    const gradientId = `sienge-spend-area-${overBudget ? 'over' : 'ok'}`;
    const hovered = hoverIndex !== null ? daily[hoverIndex] : null;

    const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.min(1, Math.max(0, (x - padL) / innerW));
      const idx = Math.round(ratio * (daily.length - 1));
      setHoverIndex(Math.min(daily.length - 1, Math.max(0, idx)));
    };

    return (
      <div ref={containerRef} className="w-full">
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full block select-none"
            style={{ height: H }}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map(f => (
              <line key={f} x1={padL} x2={W - padR} y1={PAD_T + innerH * (1 - f)} y2={PAD_T + innerH * (1 - f)} stroke="#1F1F22" strokeWidth={1} />
            ))}
            {[0, 0.5, 1].map(f => (
              <text key={f} x={0} y={PAD_T + innerH * (1 - f) + 3} textAnchor="start" fontSize={Y_LABEL_FONT_SIZE} fill="#6B6B70">
                {formatCurrencyShort(yMax * f)}
              </text>
            ))}

            {/* Linha tracejada de referência: projeção por meta (Camada 2) */}
            {budgetMeta > 0 && (
              <line x1={padL} x2={W - padR} y1={budgetMetaY} y2={budgetMetaY} stroke="#6B6B70" strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
            )}

            {/* Marcador do dia de hoje */}
            {todayInMonth && (
              <line x1={xFor(now.getDate())} x2={xFor(now.getDate())} y1={PAD_T} y2={PAD_T + innerH} stroke="#1F1F22" strokeWidth={1} strokeDasharray="2 3" />
            )}

            {/* Linha de crosshair no hover */}
            {hovered && (
              <line x1={xFor(hovered.day)} x2={xFor(hovered.day)} y1={PAD_T} y2={PAD_T + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
            )}

            {/* Área sob a linha de gasto real acumulado */}
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />

            {/* Orçamento Real Acumulado — sobe a cada venda confirmada */}
            <polyline points={orcamentoRealPoints} fill="none" stroke="#8B8BF0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

            {/* Gasto real acumulado desde o início do controle */}
            <polyline points={linePoints} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {daily.length > 0 && (
              <circle cx={xFor(daily[daily.length - 1].day)} cy={yFor(maxGasto)} r={3} fill={accent} />
            )}
            {hovered && (
              <>
                <circle cx={xFor(hovered.day)} cy={yFor(hovered.gastoAcumulado)} r={4} fill="#0A0A0A" stroke={accent} strokeWidth={2} />
              </>
            )}

            {/* Eixo X: dias do mês (a cada ~5 dias para não poluir) */}
            {daily.map(d => (d.day === 1 || d.day % 5 === 0 || d.day === daily.length) && (
              <text key={d.day} x={xFor(d.day)} y={H - 10} textAnchor="middle" fontSize={9} fill="#6B6B70">
                {d.day}
              </text>
            ))}
          </svg>

          {/* Badge da projeção por meta — sobreposto em HTML, acima da linha para não dificultar a leitura */}
          {budgetMeta > 0 && (
            <div
              className="absolute -translate-y-full px-1.5 py-0.5 rounded-md bg-[#1A1A1C] text-[10px] font-normal text-[#A0A0A5] whitespace-nowrap pointer-events-none"
              style={{ left: padL + 6, top: budgetMetaY - 6 }}
            >
              {`Projeção por meta: ${formatCurrencyShort(budgetMeta)}`}
            </div>
          )}

          {/* Tooltip de hover */}
          {hovered && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full mb-2 px-2.5 py-1.5 rounded-md bg-[#111113] shadow-[0_8px_24px_rgba(0,0,0,0.5)] pointer-events-none whitespace-nowrap"
              style={{
                left: `${Math.min(Math.max((xFor(hovered.day) / W) * 100, 12), 88)}%`,
                top: `${(yFor(hovered.gastoAcumulado) / H) * 100}%`,
              }}
            >
              <div className="text-[10px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Dia {hovered.day}</div>
              <div className="text-[13px] font-normal" style={{ color: accent }}>{formatCurrencyShort(hovered.gastoAcumulado)}</div>
              <div className="text-[10px] font-normal text-[#8B8BF0]">Real: {formatCurrencyShort(hovered.orcamentoRealAcumulado)}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-1 pt-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#6B6B70]">
              <span className={`w-1.5 h-1.5 rounded-full ${overBudget ? 'bg-[#F85149]' : 'bg-[#3FB950]'}`} /> Gasto real acumulado
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#6B6B70]"><span className="w-1.5 h-1.5 rounded-full bg-[#8B8BF0]" /> Orçamento Real Acumulado</span>
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#6B6B70]"><span className="w-2.5 h-0 border-t border-dashed border-[#6B6B70]" /> Projeção por meta</span>
          </div>
          {orcamentoRealFinal > 0 && (
            <span className={`text-[11px] font-normal ${overBudget ? 'text-[#F85149]' : 'text-[#3FB950]'}`}>
              {overBudget ? 'Orçamento real estourado' : 'Dentro do orçamento real'} · {formatCurrencyShort(maxGasto)} de {formatCurrencyShort(orcamentoRealFinal)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}
