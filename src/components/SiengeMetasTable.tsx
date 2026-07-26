import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Project, SiengeProjectMeta, SiengeProjectTotal, SiengeProjectDisplay, SiengeTabelaVendaUnidade } from '../types';
import { pricePerUnitFor } from '../lib/siengeMetasAnalysis';
import { mergeProjectTotaisComTabelaVendas } from '../lib/siengeVendasBudget';

interface SiengeMetasTableProps {
  projects: Project[];
  metas: SiengeProjectMeta[];
  onSaveMeta: (meta: SiengeProjectMeta) => void;
  onDeleteMeta: (id: string) => void;
  projectTotais: SiengeProjectTotal[];
  onSaveProjectTotal: (total: SiengeProjectTotal) => void;
  projectDisplays: SiengeProjectDisplay[];
  onSaveProjectDisplay: (display: SiengeProjectDisplay) => void;
  tabelaVendas: SiengeTabelaVendaUnidade[];
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrencyInput(formatted: string): number {
  const cleaned = formatted.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Unidades aceita fracionário (ex.: 2,5) — mantém dígitos e um único separador decimal.
function formatUnidadesInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [intPart, ...rest] = cleaned.split(',');
  return rest.length ? `${intPart},${rest.join('')}` : intPart;
}

function parseUnidadesInput(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0;
}

function textFromVgv(vgv: number | undefined): string {
  return vgv ? vgv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}

function textFromUnidades(unidades: number | undefined): string {
  return unidades ? unidades.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
}

interface Draft { vgv: string; unidades: string }

// Célula editável direto na planilha — clicar e digitar já é a forma de cadastrar
// a meta, sem formulário separado de mês/ano. Inputs são `type="text"` (nunca
// `number`): o spinner nativo do navegador não segue a identidade visual do app
// e quebrava o layout compacto da célula. O rascunho (draft) vive no componente
// pai para viabilizar o "Salvar todas" quando várias células são editadas.
function MetaCell({
  cellKey, meta, draft, pricePerUnit, onDraftChange, onCommit,
}: {
  cellKey: string;
  meta?: SiengeProjectMeta;
  draft?: Draft;
  pricePerUnit: number;
  onDraftChange: (key: string, draft: Draft) => void;
  onCommit: (key: string) => void;
}) {
  const savedVgvText = textFromVgv(meta?.vgvMeta);
  const savedUnidadesText = textFromUnidades(meta?.unidadesMeta);
  // Quando a meta já salva tem unidades mas nenhum VGV explícito, mostra o VGV
  // calculado (preço médio × unidades) só para exibição — não marca a célula
  // como suja nem precisa ser salva de novo para aparecer.
  const autoVgvText = (!meta?.vgvMeta && meta?.unidadesMeta && pricePerUnit > 0)
    ? (meta.unidadesMeta * pricePerUnit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
  const vgvText = draft?.vgv ?? (savedVgvText || autoVgvText);
  const unidadesText = draft?.unidades ?? savedUnidadesText;
  const dirty = draft !== undefined && (draft.vgv !== savedVgvText || draft.unidades !== savedUnidadesText);

  return (
    <div className="relative flex flex-col gap-1 p-2 bg-zinc-900/40 border border-zinc-800/50 rounded-lg min-w-[116px] focus-within:border-blue-500/50 transition-colors">
      {/* "R$"/"un" e o input ficam no mesmo flex row com items-baseline — evita o
          desalinhamento que o prefixo em posição absoluta causava com o placeholder. */}
      <div className="flex items-baseline gap-1">
        <span className="text-zinc-600 text-[9px] font-medium select-none shrink-0">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={vgvText}
          onChange={e => onDraftChange(cellKey, { vgv: formatCurrencyInput(e.target.value), unidades: unidadesText })}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(cellKey); }}
          placeholder="VGV"
          className="w-full min-w-0 bg-transparent text-[11px] font-semibold text-zinc-100 placeholder-zinc-600 placeholder:text-[9px] placeholder:font-medium outline-none"
        />
      </div>
      <div className="flex items-baseline gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={unidadesText}
          onChange={e => {
            const newUnidadesText = formatUnidadesInput(e.target.value);
            // Se o VGV ainda não foi definido manualmente nesta célula (não há
            // override no draft), preenche automaticamente com preço médio × unidades.
            const newVgvText = draft?.vgv === undefined && pricePerUnit > 0
              ? (parseUnidadesInput(newUnidadesText) * pricePerUnit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : vgvText;
            onDraftChange(cellKey, { vgv: newVgvText, unidades: newUnidadesText });
          }}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(cellKey); }}
          placeholder="0"
          className="w-full min-w-0 bg-transparent text-xs font-medium text-zinc-300 placeholder-zinc-600 outline-none"
        />
        <span className="text-zinc-600 text-[9px] select-none shrink-0">un</span>
      </div>

      {dirty && (
        <button
          type="button"
          onClick={() => onCommit(cellKey)}
          title="Salvar"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md shadow-black/40 hover:bg-blue-400 active:scale-95 transition-all animate-fade-in"
        >
          <Check size={11} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

// Linha de VGV total + unidades totais de um empreendimento — base para o cálculo
// automático do VGV mensal (preço médio por unidade × unidades daquele mês) quando
// o usuário não define um VGV explícito na planilha acima.
function ProjectTotalRow({ project, total, onSave }: { project: Project; total?: SiengeProjectTotal; onSave: (total: SiengeProjectTotal) => void }) {
  const savedVgvText = textFromVgv(total?.vgvTotal);
  const savedUnidadesText = textFromUnidades(total?.unidadesTotal);
  const [vgvText, setVgvText] = useState(savedVgvText);
  const [unidadesText, setUnidadesText] = useState(savedUnidadesText);

  useEffect(() => {
    setVgvText(savedVgvText);
    setUnidadesText(savedUnidadesText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total?.vgvTotal, total?.unidadesTotal]);

  const dirty = vgvText !== savedVgvText || unidadesText !== savedUnidadesText;
  const vgvTotal = parseCurrencyInput(vgvText);
  const unidadesTotal = parseUnidadesInput(unidadesText);
  // Preço médio de referência (VGV total ÷ unidades totais) — não desconta o que
  // já foi comprometido em metas, é só um contexto geral do empreendimento.
  const pricePerUnit = unidadesTotal > 0 ? vgvTotal / unidadesTotal : 0;

  const commit = () => {
    onSave({
      id: total?.id || crypto.randomUUID(),
      projectId: project.id,
      vgvTotal,
      unidadesTotal,
      createdAt: total?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="relative flex items-center gap-3 px-3 py-2 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
      <div className="flex items-center gap-1.5 w-[140px] shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="text-xs font-medium text-zinc-300 truncate">{project.name}</span>
      </div>
      <div className="flex items-baseline gap-1 flex-1 min-w-0">
        <span className="text-zinc-600 text-[9px] font-medium select-none shrink-0">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={vgvText}
          onChange={e => setVgvText(formatCurrencyInput(e.target.value))}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder="VGV total"
          className="w-full min-w-0 bg-transparent text-xs font-semibold text-zinc-100 placeholder-zinc-600 placeholder:text-[10px] placeholder:font-medium outline-none"
        />
      </div>
      <div className="flex items-baseline gap-1 w-24 shrink-0">
        <input
          type="text"
          inputMode="decimal"
          value={unidadesText}
          onChange={e => setUnidadesText(formatUnidadesInput(e.target.value))}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder="0"
          className="w-full min-w-0 bg-transparent text-xs font-medium text-zinc-300 placeholder-zinc-600 outline-none"
        />
        <span className="text-zinc-600 text-[9px] select-none shrink-0">un</span>
      </div>
      <span className="text-[10px] text-zinc-600 w-28 text-right shrink-0 truncate">
        {pricePerUnit > 0 ? `≈ ${pricePerUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/un` : ''}
      </span>

      {dirty && (
        <button
          type="button"
          onClick={commit}
          title="Salvar"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md shadow-black/40 hover:bg-blue-400 active:scale-95 transition-all animate-fade-in"
        >
          <Check size={11} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

export default function SiengeMetasTable({
  projects, metas, onSaveMeta, onDeleteMeta, projectTotais, onSaveProjectTotal, projectDisplays, onSaveProjectDisplay, tabelaVendas,
}: SiengeMetasTableProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  // Quando o empreendimento tem Tabela de Vendas cadastrada, ela substitui os
  // campos manuais de VGV Total/Unidades Totais (mais preciso) — tanto para o
  // cálculo do VGV mensal quanto para a exibição da linha de totais abaixo.
  const effectiveProjectTotais = useMemo(
    () => mergeProjectTotaisComTabelaVendas(projects, projectTotais, tabelaVendas),
    [projects, projectTotais, tabelaVendas]
  );
  const hasTabelaVendas = (projectId: string) => tabelaVendas.some(u => u.projectId === projectId);

  const displayOf = (projectId: string) => projectDisplays.find(d => d.projectId === projectId);

  // Ordem de exibição (ajustável) + empreendimentos ocultados da Metas & Orçamento
  // — aqui ficam visíveis (esmaecidos) para que possam ser reordenados/reexibidos.
  const orderedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const oa = displayOf(a.id)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const ob = displayOf(b.id)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return projects.indexOf(a) - projects.indexOf(b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, projectDisplays]);

  const moveProject = (projectId: string, direction: -1 | 1) => {
    const idx = orderedProjects.findIndex(p => p.id === projectId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= orderedProjects.length) return;
    const reordered = [...orderedProjects];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    reordered.forEach((p, i) => {
      onSaveProjectDisplay({
        projectId: p.id,
        hidden: displayOf(p.id)?.hidden || false,
        sortOrder: i,
        updatedAt: new Date().toISOString(),
      });
    });
  };

  const toggleHidden = (project: Project) => {
    const existing = displayOf(project.id);
    onSaveProjectDisplay({
      projectId: project.id,
      hidden: !(existing?.hidden || false),
      sortOrder: existing?.sortOrder ?? orderedProjects.findIndex(p => p.id === project.id),
      updatedAt: new Date().toISOString(),
    });
  };

  const cellKey = (projectId: string, month0: number) => `${projectId}:${year}:${month0}`;

  const handleChange = (project: Project, month0: number, vgv: number, unidades: number) => {
    const existing = metas.find(m => m.projectId === project.id && m.ano === year && m.mes === month0 + 1);
    if (vgv === 0 && unidades === 0) {
      if (existing) onDeleteMeta(existing.id);
      return;
    }
    onSaveMeta({
      id: existing?.id || crypto.randomUUID(),
      projectId: project.id,
      ano: year,
      mes: month0 + 1,
      vgvMeta: vgv,
      unidadesMeta: unidades,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const commitCell = (key: string) => {
    const draft = drafts[key];
    if (!draft) return;
    const [projectId, , month0Str] = key.split(':');
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    handleChange(project, Number(month0Str), parseCurrencyInput(draft.vgv), parseUnidadesInput(draft.unidades));
    setDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  // Células com alteração pendente no ano em exibição — base do "Salvar todas".
  const dirtyKeys = useMemo(() => {
    return Object.entries(drafts)
      .filter(([key, draft]) => {
        const [projectId, draftYear, month0Str] = key.split(':');
        if (Number(draftYear) !== year) return false;
        const meta = metas.find(m => m.projectId === projectId && m.ano === year && m.mes === Number(month0Str) + 1);
        return draft.vgv !== textFromVgv(meta?.vgvMeta) || draft.unidades !== textFromUnidades(meta?.unidadesMeta);
      })
      .map(([key]) => key);
  }, [drafts, metas, year]);

  const commitAll = () => dirtyKeys.forEach(commitCell);

  if (projects.length === 0) {
    return <p className="text-xs text-zinc-600 text-center py-8">Nenhum empreendimento cadastrado.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-[150px]" />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setYear(y => y - 1)} className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-bold text-zinc-200 tabular-nums">{year}</span>
          <button type="button" onClick={() => setYear(y => y + 1)} className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="w-[150px] flex justify-end">
          {dirtyKeys.length > 1 && (
            <button
              type="button"
              onClick={commitAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg shadow-blue-500/20 animate-fade-in"
            >
              <Check size={12} strokeWidth={3} /> Salvar todas ({dirtyKeys.length})
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#0d0d10] text-left px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider min-w-[190px]">
                Empreendimento
              </th>
              {MONTHS_SHORT.map(m => (
                <th key={m} className="text-center px-1 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedProjects.map((project, i) => {
              const hidden = displayOf(project.id)?.hidden || false;
              return (
                <tr key={project.id} className={hidden ? 'opacity-40' : ''}>
                  <td className="sticky left-0 z-10 bg-[#0d0d10] px-2 py-1">
                    <div className="flex items-center gap-1 min-w-[190px]">
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          onClick={() => moveProject(project.id, -1)}
                          disabled={i === 0}
                          title="Mover para cima"
                          className="p-0.5 text-zinc-600 hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                        >
                          <ChevronUp size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProject(project.id, 1)}
                          disabled={i === orderedProjects.length - 1}
                          title="Mover para baixo"
                          className="p-0.5 text-zinc-600 hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                        >
                          <ChevronDown size={10} />
                        </button>
                      </div>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                      <span className="text-xs font-medium text-zinc-300 truncate flex-1">{project.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleHidden(project)}
                        title={hidden ? 'Reexibir na Metas & Orçamento' : 'Ocultar da Metas & Orçamento'}
                        className={`p-1 rounded transition-colors shrink-0 ${hidden ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' : 'text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800'}`}
                      >
                        {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </td>
                  {MONTHS_SHORT.map((_, month0) => {
                    const meta = metas.find(m => m.projectId === project.id && m.ano === year && m.mes === month0 + 1);
                    const key = cellKey(project.id, month0);
                    const pricePerUnit = pricePerUnitFor(project, effectiveProjectTotais, metas, year, month0 + 1);
                    return (
                      <td key={month0}>
                        <MetaCell
                          cellKey={key}
                          meta={meta}
                          draft={drafts[key]}
                          pricePerUnit={pricePerUnit}
                          onDraftChange={(k, draft) => setDrafts(prev => ({ ...prev, [k]: draft }))}
                          onCommit={commitCell}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totais do empreendimento — base do cálculo automático de VGV mensal quando
          o VGV de um mês específico não é definido na planilha acima. */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex flex-col gap-0.5 px-1">
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">VGV e Unidades Totais do Empreendimento</h4>
          <p className="text-[10px] text-zinc-600">
            Quando um mês não tem VGV definido, ele é estimado como (VGV total ÷ unidades disponíveis) × unidades de meta naquele mês. As unidades disponíveis diminuem conforme metas de outros meses são cadastradas.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {orderedProjects.filter(project => !hasTabelaVendas(project.id)).map(project => (
            <div key={project.id} className={displayOf(project.id)?.hidden ? 'opacity-40' : ''}>
              <ProjectTotalRow
                project={project}
                total={projectTotais.find(t => t.projectId === project.id)}
                onSave={onSaveProjectTotal}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
