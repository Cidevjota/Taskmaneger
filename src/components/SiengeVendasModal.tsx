import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Table2, Building2, ChevronDown, ChevronUp, TrendingUp, History, Minus, Plus, X, Check, Search, Calculator, Columns3, Upload, Download, Trash2, ShieldCheck, AlertTriangle, ReceiptText, Equal, ListChecks, Settings, Smartphone } from 'lucide-react';
import { Project, SiengeTabelaVendaUnidade, SiengeTabelaVendaRevisao, SiengeVendaSituacao, SiengeTabelaVendaColuna, SiengeCalculoRegra, SiengeCalculoOperacao, SiengeColunaTipo, SiengeVenda, SiengeValidacao, SiengeValidacaoTermo } from '../types';
import SiengeVendasTable from './SiengeVendasTable';
import LpCorretorConfigPanel from './LpCorretorConfigPanel';
import { ColunaOuRegra, calcValidacaoParcelas, calcValidacaoValorUnidade, colunaBaseLabel, exportSiengeVendasCsv, isDiferencaOk, mergeColunasRegras, parseSiengeVendasCsv, parseSiengeVendasXlsx, REGRA_KEY_PREFIX } from '../lib/siengeVendasTabela';

const SITUACAO_FILTER_LABELS: Record<SiengeVendaSituacao, string> = {
  disponivel: 'Disponível',
  vendida: 'Vendida',
  permuta: 'Permuta',
  bloqueada: 'Bloqueada',
};

const TIPO_LABELS: Record<SiengeColunaTipo, string> = {
  numero: 'Número',
  moeda: 'Moeda (R$)',
  texto: 'Texto',
  area: 'Área (m²)',
};

interface SiengeVendasModalProps {
  projects: Project[];
  unidades: SiengeTabelaVendaUnidade[];
  revisoes: SiengeTabelaVendaRevisao[];
  vendas: SiengeVenda[];
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  onSaveUnidade: (item: SiengeTabelaVendaUnidade) => void;
  onDeleteUnidade: (id: string) => void;
  onApplyReajuste: (params: { projectId: string; unidadeIds: string[] | null; percentual: number; descricao: string | null }) => Promise<void> | void;
  onSaveColuna: (coluna: SiengeTabelaVendaColuna) => void;
  onDeleteColuna: (id: string) => void;
  onSaveRegra: (regra: SiengeCalculoRegra) => void;
  onDeleteRegra: (id: string) => void;
  validacoes: SiengeValidacao[];
  onSaveValidacao: (validacao: SiengeValidacao) => void;
  onDeleteValidacao: (id: string) => void;
  onClose?: () => void;
}

function slugifyKeyLocal(label: string): string {
  return label.trim().toLowerCase().normalize('NFD').replace(/[^\w\s]/g, '').replace(/\s+/g, '_') || 'coluna';
}

// Linha editável de definição de coluna — rascunho local + commit no blur,
// mesmo padrão usado no resto do módulo Sienge.
// Reordena trocando o sortOrder entre a entrada e a vizinha — funciona tanto
// entre colunas quanto entre colunas e regras, já que o merge intercala as
// duas listas numa única sequência visual (ver mergeColunasRegras).
function moveEntry(
  merged: ColunaOuRegra[],
  index: number,
  direction: -1 | 1,
  onSaveColuna: (c: SiengeTabelaVendaColuna) => void,
  onSaveRegra: (r: SiengeCalculoRegra) => void
) {
  const target = index + direction;
  if (target < 0 || target >= merged.length) return;
  const a = merged[index];
  const b = merged[target];
  const now = new Date().toISOString();
  const soA = a.item.sortOrder;
  const soB = b.item.sortOrder;
  if (a.kind === 'coluna') onSaveColuna({ ...a.item, sortOrder: soB, updatedAt: now });
  else onSaveRegra({ ...a.item, sortOrder: soB, updatedAt: now });
  if (b.kind === 'coluna') onSaveColuna({ ...b.item, sortOrder: soA, updatedAt: now });
  else onSaveRegra({ ...b.item, sortOrder: soA, updatedAt: now });
}

function ColunaRow({ coluna, onCommit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  coluna: SiengeTabelaVendaColuna;
  onCommit: (c: SiengeTabelaVendaColuna) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [label, setLabel] = useState(coluna.label);
  useEffect(() => setLabel(coluna.label), [coluna.label]);

  const inputClass = 'flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500/50 transition-colors';

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Mover para cima"
          className="p-0.5 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronUp size={13} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Mover para baixo"
          className="p-0.5 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronDown size={13} />
        </button>
      </div>
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label.trim() !== coluna.label) onCommit({ ...coluna, label: label.trim() }); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={inputClass}
      />
      <select
        value={coluna.tipo}
        onChange={e => onCommit({ ...coluna, tipo: e.target.value as SiengeColunaTipo })}
        className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 outline-none cursor-pointer"
      >
        {(Object.keys(TIPO_LABELS) as SiengeColunaTipo[]).map(t => (
          <option key={t} value={t} className="bg-zinc-900">{TIPO_LABELS[t]}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onDelete(coluna.id)}
        title="Remover coluna"
        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// Coluna calculada (regra) dentro da mesma lista de "Colunas da Tabela" —
// só título e reordenação aqui; fórmula (operação, quantidade, % e referência)
// se edita no painel "Regras de Cálculo".
function RegraColunaRow({ regra, colunas, onCommit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  regra: SiengeCalculoRegra;
  colunas: SiengeTabelaVendaColuna[];
  onCommit: (r: SiengeCalculoRegra) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [titulo, setTitulo] = useState(regra.titulo);
  useEffect(() => setTitulo(regra.titulo), [regra.titulo]);

  const operacao: SiengeCalculoOperacao = regra.operacao === 'multiplicar' ? 'multiplicar' : 'dividir';
  const quantidadeLabel = regra.quantidadeColunaKey
    ? colunaBaseLabel(regra.quantidadeColunaKey, colunas)
    : regra.quantidade;
  const resumo = `${regra.percentual}% de ${colunaBaseLabel(regra.colunaBaseKey, colunas)} ${operacao === 'multiplicar' ? '×' : '÷'} ${quantidadeLabel}`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Mover para cima"
          className="p-0.5 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronUp size={13} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Mover para baixo"
          className="p-0.5 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronDown size={13} />
        </button>
      </div>
      <input
        type="text"
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        onBlur={() => { if (titulo.trim() && titulo.trim() !== regra.titulo) onCommit({ ...regra, titulo: titulo.trim() }); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500/50 transition-colors"
      />
      <span title={resumo} className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg shrink-0 max-w-[220px] truncate">
        <Calculator size={11} className="shrink-0" /> {resumo}
      </span>
      <button
        type="button"
        onClick={() => onDelete(regra.id)}
        title="Remover regra"
        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function NovaColunaForm({ projectId, nextSortOrder, onAdd }: { projectId: string; nextSortOrder: number; onAdd: (c: SiengeTabelaVendaColuna) => void }) {
  const [label, setLabel] = useState('');
  const [tipo, setTipo] = useState<SiengeColunaTipo>('moeda');

  const add = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd({
      id: crypto.randomUUID(),
      projectId,
      key: slugifyKeyLocal(trimmed),
      label: trimmed,
      tipo,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setLabel('');
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add(); }}
        placeholder="Nome da nova coluna"
        className="flex-1 min-w-0 bg-zinc-900/60 border border-dashed border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors"
      />
      <select
        value={tipo}
        onChange={e => setTipo(e.target.value as SiengeColunaTipo)}
        className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 outline-none cursor-pointer"
      >
        {(Object.keys(TIPO_LABELS) as SiengeColunaTipo[]).map(t => (
          <option key={t} value={t} className="bg-zinc-900">{TIPO_LABELS[t]}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={!label.trim()}
        className="flex items-center gap-1 px-3 py-2 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors shrink-0"
      >
        <Plus size={12} strokeWidth={3} /> Adicionar
      </button>
    </div>
  );
}

// Linha editável de regra de cálculo — título (era "descrição"), quantidade de
// parcelas, percentual e a coluna sobre a qual o percentual incide.
function RegraRow({ regra, colunas, onCommit, onDelete }: {
  regra: SiengeCalculoRegra;
  colunas: SiengeTabelaVendaColuna[];
  onCommit: (r: SiengeCalculoRegra) => void;
  onDelete: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState(regra.titulo);
  const [quantidadeText, setQuantidadeText] = useState(String(regra.quantidade));
  const [percentualText, setPercentualText] = useState(String(regra.percentual));

  useEffect(() => {
    setTitulo(regra.titulo);
    setQuantidadeText(String(regra.quantidade));
    setPercentualText(String(regra.percentual));
  }, [regra.titulo, regra.quantidade, regra.percentual]);

  const inputClass = 'w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500/50 transition-colors';
  const baseOptions = [{ key: 'valor_tabela', label: 'Valor da Unidade' }, ...colunas.filter(c => c.tipo !== 'texto').map(c => ({ key: c.key, label: c.label }))];

  const operacao: SiengeCalculoOperacao = regra.operacao === 'multiplicar' ? 'multiplicar' : 'dividir';
  const usaColuna = !!regra.quantidadeColunaKey;

  return (
    <div className="grid grid-cols-[1.1fr_0.6fr_0.9fr_0.9fr_1.1fr_auto] gap-2 items-end">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Título da Coluna</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onBlur={() => { if (titulo.trim()) onCommit({ ...regra, titulo: titulo.trim() }); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Operação</label>
        <select
          value={operacao}
          onChange={e => onCommit({ ...regra, operacao: e.target.value as SiengeCalculoOperacao })}
          className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none cursor-pointer"
        >
          <option value="dividir" className="bg-zinc-900">Dividir (÷)</option>
          <option value="multiplicar" className="bg-zinc-900">Multiplicar (×)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider truncate">{operacao === 'multiplicar' ? 'Multiplicador' : 'Quantidade'}</label>
          <button
            type="button"
            onClick={() => onCommit({ ...regra, quantidadeColunaKey: usaColuna ? null : (baseOptions[0]?.key || null) })}
            className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors shrink-0"
          >
            {usaColuna ? 'Digitar' : 'Coluna'}
          </button>
        </div>
        {usaColuna ? (
          <select
            value={regra.quantidadeColunaKey || ''}
            onChange={e => onCommit({ ...regra, quantidadeColunaKey: e.target.value })}
            className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none cursor-pointer"
          >
            {baseOptions.map(o => (
              <option key={o.key} value={o.key} className="bg-zinc-900">{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={quantidadeText}
            onChange={e => setQuantidadeText(e.target.value.replace(/\D/g, ''))}
            onBlur={() => { const n = parseInt(quantidadeText, 10) || 0; onCommit({ ...regra, quantidade: n }); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className={inputClass}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Percentual</label>
        <div className="flex items-center bg-zinc-900/60 border border-zinc-800 rounded-lg focus-within:border-blue-500/50 transition-colors">
          <input
            type="text"
            inputMode="decimal"
            value={percentualText}
            onChange={e => setPercentualText(e.target.value.replace(/[^\d,]/g, ''))}
            onBlur={() => { const n = parseFloat(percentualText.replace(',', '.')) || 0; onCommit({ ...regra, percentual: n }); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full bg-transparent px-3 py-2 text-xs text-zinc-100 outline-none"
          />
          <span className="pr-3 text-[10px] text-zinc-500 select-none">%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Referência do %</label>
        <select
          value={regra.colunaBaseKey}
          onChange={e => onCommit({ ...regra, colunaBaseKey: e.target.value })}
          className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none cursor-pointer"
        >
          {baseOptions.map(o => (
            <option key={o.key} value={o.key} className="bg-zinc-900">{o.label}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onDelete(regra.id)}
        title="Remover regra"
        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function PercentStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const format = (v: number) => (v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
  const [text, setText] = useState(format(value));

  useEffect(() => { setText(format(value)); }, [value]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    onChange(isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100);
  };

  const step = (delta: number) => onChange(Math.round((value + delta) * 100) / 100);

  return (
    <div className="flex items-center bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden focus-within:border-blue-500/50 transition-colors">
      <button type="button" onClick={() => step(-0.1)} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors">
        <Minus size={11} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="0,0"
        className="w-14 bg-transparent text-center text-xs text-zinc-100 placeholder-zinc-600 outline-none py-1.5"
      />
      <button type="button" onClick={() => step(0.1)} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors">
        <Plus size={11} />
      </button>
      <span className="pr-2.5 pl-0.5 text-[10px] text-zinc-500 select-none">%</span>
    </div>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Resultado da validação como bloco de equação: Soma | = | Referência,
// com o status (badge colorido) em destaque — mesma leitura visual pras
// duas famílias de validação (parcelas e valor da unidade).
function ResultadoEquacao({ somaLabel, soma, referenciaLabel, referencia, diferenca }: {
  somaLabel: string;
  soma: number;
  referenciaLabel: string;
  referencia: number;
  diferenca: number;
}) {
  const ok = isDiferencaOk(diferenca);
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide shrink-0">{somaLabel}</span>
        <span className="text-xs font-semibold text-zinc-100 truncate">{formatCurrency(soma)}</span>
      </div>
      <Equal size={12} className="text-zinc-600 shrink-0" />
      <div className="flex items-baseline gap-1 min-w-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide shrink-0">{referenciaLabel}</span>
        <span className="text-xs font-semibold text-zinc-100 truncate">{formatCurrency(referencia)}</span>
      </div>
      <DiferencaBadge diferenca={diferenca} />
    </div>
  );
}

function DiferencaBadge({ diferenca }: { diferenca: number }) {
  const ok = isDiferencaOk(diferenca);
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 ml-auto py-1 px-2 rounded-md text-xs font-bold shrink-0 ${ok ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
      {ok ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
      {diferenca >= 0 ? '+' : ''}{formatCurrency(diferenca)}
    </span>
  );
}

function novoTermoParcela(colunaKey: string): SiengeValidacaoTermo {
  return { colunaKey, quantidade: 1 };
}

function novoTermoValor(colunaKey: string): SiengeValidacaoTermo {
  return { colunaKey, sinal: '+' };
}

function ValidacaoParcelasCard({ validacao, opcoes, regras, item, onCommit, onDelete }: {
  validacao: SiengeValidacao;
  opcoes: { key: string; label: string }[];
  regras: SiengeCalculoRegra[];
  item?: SiengeTabelaVendaUnidade;
  onCommit: (v: SiengeValidacao) => void;
  onDelete: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState(validacao.titulo);
  useEffect(() => setTitulo(validacao.titulo), [validacao.titulo]);

  const selectClass = 'bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 outline-none cursor-pointer min-w-0';
  const resultado = item ? calcValidacaoParcelas(item, validacao, regras) : null;

  const updateTermo = (idx: number, termo: SiengeValidacaoTermo) => onCommit({ ...validacao, termos: validacao.termos.map((t, i) => i === idx ? termo : t) });
  const addTermo = () => onCommit({ ...validacao, termos: [...validacao.termos, novoTermoParcela(opcoes[0]?.key || 'valor_tabela')] });
  const removeTermo = (idx: number) => onCommit({ ...validacao, termos: validacao.termos.filter((_, i) => i !== idx) });

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onBlur={() => { if (titulo.trim() !== validacao.titulo) onCommit({ ...validacao, titulo: titulo.trim() }); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="Nome da validação"
          className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-zinc-200 placeholder-zinc-600 outline-none"
        />
        <button type="button" onClick={() => onDelete(validacao.id)} title="Remover validação" className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {validacao.termos.map((t, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-zinc-600 text-xs shrink-0">+</span>}
            <input
              type="text"
              inputMode="numeric"
              value={t.quantidade ?? ''}
              onChange={e => updateTermo(idx, { ...t, quantidade: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
              placeholder="Qtd"
              className="w-12 bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-100 text-center outline-none shrink-0"
            />
            <span className="text-zinc-600 text-xs shrink-0">×</span>
            <select value={t.colunaKey} onChange={e => updateTermo(idx, { ...t, colunaKey: e.target.value })} className={selectClass}>
              {opcoes.map(o => <option key={o.key} value={o.key} className="bg-zinc-900">{o.label}</option>)}
            </select>
            {validacao.termos.length > 1 && (
              <button type="button" onClick={() => removeTermo(idx)} title="Remover termo" className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0">
                <X size={12} />
              </button>
            )}
          </React.Fragment>
        ))}
        <button type="button" onClick={addTermo} title="Adicionar termo" className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors shrink-0">
          <Plus size={13} strokeWidth={3} />
        </button>
        <Equal size={12} className="text-zinc-600 shrink-0 ml-1" />
        <select value={validacao.referenciaKey || ''} onChange={e => onCommit({ ...validacao, referenciaKey: e.target.value })} className={selectClass}>
          {opcoes.map(o => <option key={o.key} value={o.key} className="bg-zinc-900">{o.label}</option>)}
        </select>
      </div>

      {resultado && (
        <ResultadoEquacao
          somaLabel="Soma"
          soma={resultado.soma}
          referenciaLabel="Referência"
          referencia={resultado.referencia}
          diferenca={resultado.diferenca}
        />
      )}
    </div>
  );
}

function ValidacaoValorUnidadeCard({ validacao, opcoes, regras, item, onCommit, onDelete }: {
  validacao: SiengeValidacao;
  opcoes: { key: string; label: string }[];
  regras: SiengeCalculoRegra[];
  item?: SiengeTabelaVendaUnidade;
  onCommit: (v: SiengeValidacao) => void;
  onDelete: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState(validacao.titulo);
  useEffect(() => setTitulo(validacao.titulo), [validacao.titulo]);

  const selectClass = 'bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 outline-none cursor-pointer min-w-0';
  const resultado = item ? calcValidacaoValorUnidade(item, validacao, regras) : null;

  const updateTermo = (idx: number, termo: SiengeValidacaoTermo) => onCommit({ ...validacao, termos: validacao.termos.map((t, i) => i === idx ? termo : t) });
  const addTermo = () => onCommit({ ...validacao, termos: [...validacao.termos, novoTermoValor(opcoes[0]?.key || 'valor_tabela')] });
  const removeTermo = (idx: number) => onCommit({ ...validacao, termos: validacao.termos.filter((_, i) => i !== idx) });

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onBlur={() => { if (titulo.trim() !== validacao.titulo) onCommit({ ...validacao, titulo: titulo.trim() }); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="Nome da validação"
          className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-zinc-200 placeholder-zinc-600 outline-none"
        />
        <button type="button" onClick={() => onDelete(validacao.id)} title="Remover validação" className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {validacao.termos.map((t, idx) => (
          <React.Fragment key={idx}>
            <select value={t.sinal || '+'} onChange={e => updateTermo(idx, { ...t, sinal: e.target.value as '+' | '-' })} className={`${selectClass} w-12 text-center shrink-0`}>
              <option value="+" className="bg-zinc-900">+</option>
              <option value="-" className="bg-zinc-900">−</option>
            </select>
            <select value={t.colunaKey} onChange={e => updateTermo(idx, { ...t, colunaKey: e.target.value })} className={selectClass}>
              {opcoes.map(o => <option key={o.key} value={o.key} className="bg-zinc-900">{o.label}</option>)}
            </select>
            {validacao.termos.length > 1 && (
              <button type="button" onClick={() => removeTermo(idx)} title="Remover termo" className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0">
                <X size={12} />
              </button>
            )}
          </React.Fragment>
        ))}
        <button type="button" onClick={addTermo} title="Adicionar termo" className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors shrink-0">
          <Plus size={13} strokeWidth={3} />
        </button>
        <Equal size={12} className="text-zinc-600 shrink-0 ml-1" />
        <span className="text-xs text-zinc-400 font-medium shrink-0">Valor da Unidade</span>
      </div>

      {resultado && (
        <ResultadoEquacao
          somaLabel="Soma"
          soma={resultado.soma}
          referenciaLabel="Valor da Unidade"
          referencia={resultado.valorUnidade}
          diferenca={resultado.diferenca}
        />
      )}
    </div>
  );
}

// Painel de validação: escolhe uma unidade e monta duas famílias de fórmulas
// persistidas por empreendimento — Validar Parcelas (soma quantidade×coluna vs.
// uma coluna de referência) e Validar Valor da Unidade (soma ±coluna vs. o Valor
// da Unidade) — ambas esperam diferença = 0,00.
function ValidarPanel({ projectId, unidades, colunas, regras, validacoes, onSaveValidacao, onDeleteValidacao, onClose }: {
  projectId: string;
  unidades: SiengeTabelaVendaUnidade[];
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  validacoes: SiengeValidacao[];
  onSaveValidacao: (v: SiengeValidacao) => void;
  onDeleteValidacao: (id: string) => void;
  onClose: () => void;
}) {
  const sorted = useMemo(() => [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true })), [unidades]);
  const [unidadeId, setUnidadeId] = useState(sorted[0]?.id || '');
  useEffect(() => { if (!sorted.find(u => u.id === unidadeId)) setUnidadeId(sorted[0]?.id || ''); }, [sorted, unidadeId]);

  const item = sorted.find(u => u.id === unidadeId);

  const opcoesColunas = useMemo(
    () => [
      { key: 'valor_tabela', label: 'Valor da Unidade' },
      ...colunas.filter(c => c.tipo !== 'texto').map(c => ({ key: c.key, label: c.label })),
      ...regras.map(r => ({ key: `${REGRA_KEY_PREFIX}${r.id}`, label: r.titulo })),
    ],
    [colunas, regras]
  );

  const validacoesParcelas = validacoes.filter(v => v.tipo === 'parcelas');
  const validacoesValorUnidade = validacoes.filter(v => v.tipo === 'valor_unidade');
  const nextSortOrder = validacoes.length > 0 ? Math.max(...validacoes.map(v => v.sortOrder)) + 1 : 1;

  const addValidacaoParcelas = () => {
    const colunaKey = opcoesColunas[0]?.key || 'valor_tabela';
    onSaveValidacao({
      id: crypto.randomUUID(),
      projectId,
      tipo: 'parcelas',
      titulo: '',
      termos: [novoTermoParcela(colunaKey)],
      referenciaKey: colunaKey,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const addValidacaoValorUnidade = () => {
    const colunaKey = opcoesColunas[0]?.key || 'valor_tabela';
    onSaveValidacao({
      id: crypto.randomUUID(),
      projectId,
      tipo: 'valor_unidade',
      titulo: '',
      termos: [novoTermoValor(colunaKey)],
      referenciaKey: null,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 shrink-0">
            <Calculator size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Validar Tabela</h3>
            <p className="text-[11px] text-zinc-500">Monte fórmulas de validação por empreendimento — o resultado esperado é sempre 0,00.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Unidade em análise</label>
        <select
          value={unidadeId}
          onChange={e => setUnidadeId(e.target.value)}
          className="w-fit bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none cursor-pointer"
        >
          {sorted.map(u => (
            <option key={u.id} value={u.id} className="bg-zinc-900">Unidade {u.unidade}</option>
          ))}
        </select>
      </div>

      {!item ? (
        <p className="text-xs text-zinc-600">Nenhuma unidade cadastrada para validar.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 p-3 bg-zinc-950/30 border border-zinc-800/60 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-500/10 border border-violet-500/20 rounded-md text-violet-400 shrink-0">
                  <ListChecks size={13} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Validar Parcelas</h4>
                  <p className="text-[10px] text-zinc-600">Soma de quantidade × coluna vs. uma coluna de referência.</p>
                </div>
              </div>
              <button type="button" onClick={addValidacaoParcelas} className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                <Plus size={12} strokeWidth={3} /> Nova validação
              </button>
            </div>
            {validacoesParcelas.length === 0 ? (
              <p className="text-xs text-zinc-600">Ex.: (48 × Mensal) + (7 × Semestral) deve ser igual a Custo de Construção.</p>
            ) : (
              validacoesParcelas.map(v => (
                <ValidacaoParcelasCard
                  key={v.id}
                  validacao={v}
                  opcoes={opcoesColunas}
                  regras={regras}
                  item={item}
                  onCommit={onSaveValidacao}
                  onDelete={onDeleteValidacao}
                />
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 p-3 bg-zinc-950/30 border border-zinc-800/60 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-400 shrink-0">
                  <Columns3 size={13} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Validar Valor da Unidade</h4>
                  <p className="text-[10px] text-zinc-600">Soma de ± coluna vs. o Valor da Unidade.</p>
                </div>
              </div>
              <button type="button" onClick={addValidacaoValorUnidade} className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                <Plus size={12} strokeWidth={3} /> Nova validação
              </button>
            </div>
            {validacoesValorUnidade.length === 0 ? (
              <p className="text-xs text-zinc-600">Ex.: Custo de Construção + Adesão Total deve ser igual ao Valor da Unidade.</p>
            ) : (
              validacoesValorUnidade.map(v => (
                <ValidacaoValorUnidadeCard
                  key={v.id}
                  validacao={v}
                  opcoes={opcoesColunas}
                  regras={regras}
                  item={item}
                  onCommit={onSaveValidacao}
                  onDelete={onDeleteValidacao}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type PeriodoPreset = 'tudo' | 'mes' | '30d' | 'ano' | 'personalizado';

const PERIODO_PRESETS: { key: PeriodoPreset; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'mes', label: 'Este mês' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: 'ano', label: 'Este ano' },
];

// Intervalo [de, ate] em YYYY-MM-DD para cada atalho; 'tudo' e 'personalizado'
// não impõem limites próprios (o personalizado usa o que o usuário digitou).
function rangeFromPreset(preset: PeriodoPreset): { de: string; ate: string } {
  const hoje = new Date();
  if (preset === 'mes') return { de: toDateInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: toDateInput(hoje) };
  if (preset === '30d') {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 29);
    return { de: toDateInput(inicio), ate: toDateInput(hoje) };
  }
  if (preset === 'ano') return { de: toDateInput(new Date(hoje.getFullYear(), 0, 1)), ate: toDateInput(hoje) };
  return { de: '', ate: '' };
}

// Tabela de Histórico de Vendas: só unidades vendidas, com os valores
// congelados no instante da venda (não os valores atuais da tabela viva) e a
// data em que cada uma virou vendida. O filtro de período recorta pela data da
// venda, para responder "quantas vendas houve no período".
function HistoricoVendasTable({ vendas, colunas }: { vendas: SiengeVenda[]; colunas: SiengeTabelaVendaColuna[] }) {
  const sortedColunas = [...colunas].sort((a, b) => a.sortOrder - b.sortOrder);
  const [preset, setPreset] = useState<PeriodoPreset>('tudo');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const aplicarPreset = (p: PeriodoPreset) => {
    setPreset(p);
    const r = rangeFromPreset(p);
    setDe(r.de);
    setAte(r.ate);
  };

  const filtradas = useMemo(() => {
    const deTs = de ? new Date(`${de}T00:00:00`).getTime() : null;
    const ateTs = ate ? new Date(`${ate}T23:59:59.999`).getTime() : null;
    return vendas
      .filter(v => {
        const ts = new Date(v.dataVenda).getTime();
        if (deTs !== null && ts < deTs) return false;
        if (ateTs !== null && ts > ateTs) return false;
        return true;
      })
      .sort((a, b) => new Date(b.dataVenda).getTime() - new Date(a.dataVenda).getTime());
  }, [vendas, de, ate]);

  const ativas = filtradas.filter(v => !v.dataDistrato).length;
  const distratadas = filtradas.length - ativas;
  const vgvPeriodo = filtradas.reduce((s, v) => s + v.valorCongelado, 0);

  const filtroBar = (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODO_PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => aplicarPreset(p.key)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
              preset === p.key ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'text-zinc-400 bg-zinc-900/60 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={de}
            onChange={e => { setDe(e.target.value); setPreset('personalizado'); }}
            className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
          />
          <span className="text-[11px] text-zinc-600">até</span>
          <input
            type="date"
            value={ate}
            onChange={e => { setAte(e.target.value); setPreset('personalizado'); }}
            className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
          />
          {(de || ate) && (
            <button
              type="button"
              onClick={() => aplicarPreset('tudo')}
              title="Limpar período"
              className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span><span className="font-semibold text-zinc-100">{filtradas.length}</span> {filtradas.length === 1 ? 'venda' : 'vendas'} no período</span>
        <span><span className="font-semibold text-emerald-400">{ativas}</span> ativas</span>
        <span><span className="font-semibold text-zinc-300">{distratadas}</span> distratadas</span>
        <span>VGV congelado: <span className="font-semibold text-zinc-100">{formatCurrency(vgvPeriodo)}</span></span>
      </div>
    </div>
  );

  if (vendas.length === 0) {
    return <p className="text-xs text-zinc-600 text-center py-6">Nenhuma unidade vendida ainda neste empreendimento.</p>;
  }

  if (filtradas.length === 0) {
    return (
      <div>
        {filtroBar}
        <p className="text-xs text-zinc-600 text-center py-6">Nenhuma venda registrada no período selecionado.</p>
      </div>
    );
  }

  return (
    <div>
      {filtroBar}
      <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Unidade</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Comprador</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Data da Venda</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor Congelado</th>
            {sortedColunas.map(c => (
              <th key={c.key} className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{c.label}</th>
            ))}
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtradas.map(v => (
            <tr key={v.id} className="[&>td]:bg-zinc-900/40 [&>td]:border-y [&>td]:border-zinc-800/50 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg">
              <td className="px-3 py-2 text-xs font-medium text-zinc-100">{v.unidade}</td>
              <td className="px-3 py-2 text-xs text-zinc-300">{v.comprador || '—'}</td>
              <td className="px-3 py-2 text-xs text-zinc-400 whitespace-nowrap">{formatDateTime(v.dataVenda)}</td>
              <td className="px-3 py-2 text-xs font-semibold text-zinc-100 whitespace-nowrap">{formatCurrency(v.valorCongelado)}</td>
              {sortedColunas.map(c => {
                const raw = v.camposExtraCongelados[c.key];
                if (c.tipo === 'texto') return <td key={c.key} className="px-3 py-2 text-xs text-zinc-300">{raw != null ? String(raw) : '—'}</td>;
                const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0').replace(',', '.')) || 0;
                return (
                  <td key={c.key} className="px-3 py-2 text-xs text-zinc-300 whitespace-nowrap">
                    {n > 0 ? (
                      c.tipo === 'moeda'
                        ? formatCurrency(n)
                        : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${c.tipo === 'area' ? ' m²' : ''}`
                    ) : '—'}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {v.dataDistrato ? (
                  <span className="text-zinc-500">Distratada em {formatDateTime(v.dataDistrato)}</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">Ativa</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Busca por unidade: prioriza correspondência exata, depois prefixo, depois
// substring — assim "20" traz "20" antes de "201", "2001" etc.
function searchUnidades(list: SiengeTabelaVendaUnidade[], term: string): SiengeTabelaVendaUnidade[] {
  const query = term.trim().toLowerCase();
  if (!query) return list;
  const scored = list
    .map(u => {
      const name = u.unidade.toLowerCase();
      let score = -1;
      if (name === query) score = 0;
      else if (name.startsWith(query)) score = 1;
      else if (name.includes(query)) score = 2;
      return { u, score };
    })
    .filter(x => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.u.unidade.localeCompare(b.u.unidade, 'pt-BR', { numeric: true }));
  return scored.map(x => x.u);
}

export default function SiengeVendasModal({
  projects, unidades, revisoes, vendas, colunas, regras,
  onSaveUnidade, onDeleteUnidade, onApplyReajuste, onSaveColuna, onDeleteColuna, onSaveRegra, onDeleteRegra,
  validacoes, onSaveValidacao, onDeleteValidacao, onClose,
}: SiengeVendasModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [situacaoFilter, setSituacaoFilter] = useState<SiengeVendaSituacao | 'todas'>('todas');
  const [searchText, setSearchText] = useState('');
  const [showReajuste, setShowReajuste] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showCalculo, setShowCalculo] = useState(false);
  const [showColunas, setShowColunas] = useState(false);
  const [showValidar, setShowValidar] = useState(false);
  const [showValidarConfig, setShowValidarConfig] = useState(false);
  const [showHistoricoVendas, setShowHistoricoVendas] = useState(false);
  const [showLpCorretor, setShowLpCorretor] = useState(false);
  const [reajusteTipo, setReajusteTipo] = useState<'geral' | 'seletiva'>('geral');
  const [reajustePercentual, setReajustePercentual] = useState(0);
  const [reajusteDescricao, setReajusteDescricao] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const projectUnidades = useMemo(
    () => unidades.filter(u => u.projectId === selectedProjectId),
    [unidades, selectedProjectId]
  );

  const projectColunas = useMemo(
    () => colunas.filter(c => c.projectId === selectedProjectId).sort((a, b) => a.sortOrder - b.sortOrder),
    [colunas, selectedProjectId]
  );

  const projectRegras = useMemo(
    () => regras.filter(r => r.projectId === selectedProjectId).sort((a, b) => a.sortOrder - b.sortOrder),
    [regras, selectedProjectId]
  );

  const projectMerged = useMemo(
    () => mergeColunasRegras(projectColunas, projectRegras),
    [projectColunas, projectRegras]
  );
  const nextEntrySortOrder = projectMerged.length > 0 ? Math.max(...projectMerged.map(m => m.item.sortOrder)) + 1 : 1;

  const projectValidacoes = useMemo(
    () => validacoes.filter(v => v.projectId === selectedProjectId).sort((a, b) => a.sortOrder - b.sortOrder),
    [validacoes, selectedProjectId]
  );

  const filteredUnidades = useMemo(() => {
    const bySituacao = situacaoFilter === 'todas' ? projectUnidades : projectUnidades.filter(u => u.situacao === situacaoFilter);
    return searchUnidades(bySituacao, searchText);
  }, [projectUnidades, situacaoFilter, searchText]);

  // Unidades vendidas/permutadas têm o preço congelado — nem aparecem como
  // opção no reajuste seletivo, coerente com a trava aplicada no banco.
  const reajustaveisUnidades = useMemo(
    () => projectUnidades.filter(u => u.situacao === 'disponivel' || u.situacao === 'bloqueada'),
    [projectUnidades]
  );

  const projectRevisoes = useMemo(
    () => revisoes.filter(r => r.projectId === selectedProjectId).sort((a, b) => b.numero - a.numero),
    [revisoes, selectedProjectId]
  );

  const projectVendas = useMemo(
    () => vendas.filter(v => v.projectId === selectedProjectId).sort((a, b) => new Date(b.dataVenda).getTime() - new Date(a.dataVenda).getTime()),
    [vendas, selectedProjectId]
  );

  const toggleUnit = (id: string) => {
    setSelectedUnitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetReajuste = () => {
    setShowReajuste(false);
    setReajusteTipo('geral');
    setReajustePercentual(0);
    setReajusteDescricao('');
    setSelectedUnitIds(new Set());
  };

  const canApply = reajustePercentual !== 0 && (reajusteTipo === 'geral' || selectedUnitIds.size > 0);

  const handleApply = async () => {
    if (!selectedProjectId || !canApply || applying) return;
    setApplying(true);
    try {
      await onApplyReajuste({
        projectId: selectedProjectId,
        unidadeIds: reajusteTipo === 'geral' ? null : Array.from(selectedUnitIds),
        percentual: reajustePercentual,
        descricao: reajusteDescricao.trim() || null,
      });
      resetReajuste();
    } finally {
      setApplying(false);
    }
  };

  const handleExportCsv = () => {
    if (!selectedProjectId) return;
    const csv = exportSiengeVendasCsv(projectUnidades, projectColunas, projectRegras);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedProject?.name || 'tabela-vendas').replace(/\s+/g, '-').toLowerCase()}-tabela-vendas.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const isExcel = /\.xlsx?$/i.test(file.name);
    const regraTitulos = projectRegras.map(r => r.titulo);

    if (isExcel) {
      const { unidades: parsed, novasColunas } = await parseSiengeVendasXlsx(
        file, selectedProjectId, projectUnidades, projectColunas, regraTitulos
      );
      novasColunas.forEach(onSaveColuna);
      parsed.forEach(onSaveUnidade);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { unidades: parsed, novasColunas } = parseSiengeVendasCsv(
        text, selectedProjectId, projectUnidades, projectColunas, regraTitulos
      );
      novasColunas.forEach(onSaveColuna);
      parsed.forEach(onSaveUnidade);
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="flex flex-col h-full bg-[#08080a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Table2 size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Tabela de Vendas</h2>
            <p className="text-[11px] text-zinc-600">Valor de tabela, colunas e situação das unidades por empreendimento</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={13} /> Voltar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        {/* Empreendimento + filtros + ações — tudo na mesma linha, mesma altura */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProjectDropdownOpen(p => !p)}
              className="flex items-center gap-1.5 min-w-[200px] bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none transition-all hover:bg-zinc-800/60"
            >
              <Building2 size={13} className="text-zinc-500 shrink-0" />
              <span className={`truncate flex-1 text-left font-semibold ${selectedProject ? 'text-zinc-100' : 'text-zinc-500'}`}>
                {selectedProject?.name || 'Selecione um empreendimento'}
              </span>
              <ChevronDown size={13} className={`text-zinc-500 shrink-0 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isProjectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProjectDropdownOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {projects.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedProjectId(p.id); setIsProjectDropdownOpen(false); setSituacaoFilter('todas'); setSearchText(''); resetReajuste(); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                          p.id === selectedProjectId ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'
                        }`}
                      >
                        <span className="font-medium text-[13px]">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedProjectId && (
            <>
              <div className="h-6 w-px bg-zinc-800 shrink-0" />

              {/* Busca por unidade */}
              <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-2 focus-within:border-blue-500/50 transition-colors">
                <Search size={12} className="text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Buscar unidade..."
                  className="w-24 bg-transparent text-[11px] text-zinc-100 placeholder-zinc-600 outline-none"
                />
                {searchText && (
                  <button type="button" onClick={() => setSearchText('')} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Filtro por situação */}
              <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSituacaoFilter('todas')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    situacaoFilter === 'todas' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                  }`}
                >
                  Todas
                </button>
                {(Object.keys(SITUACAO_FILTER_LABELS) as SiengeVendaSituacao[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSituacaoFilter(s)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      situacaoFilter === s ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                    }`}
                  >
                    {SITUACAO_FILTER_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800"
                >
                  <Upload size={13} /> Importar CSV/Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800"
                >
                  <Download size={13} /> Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => { setShowColunas(v => !v); setShowReajuste(false); setShowHistorico(false); setShowCalculo(false); setShowValidarConfig(false); setShowHistoricoVendas(false); setShowLpCorretor(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showColunas ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <Columns3 size={13} /> Colunas
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReajuste(v => !v); setShowHistorico(false); setShowCalculo(false); setShowColunas(false); setShowValidarConfig(false); setShowHistoricoVendas(false); setShowLpCorretor(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showReajuste ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <TrendingUp size={13} /> Atualizar Valor da Tabela
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCalculo(v => !v); setShowReajuste(false); setShowHistorico(false); setShowColunas(false); setShowValidarConfig(false); setShowHistoricoVendas(false); setShowLpCorretor(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showCalculo ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <Calculator size={13} /> Regras de Cálculo
                </button>
                <button
                  type="button"
                  onClick={() => { setShowHistorico(v => !v); setShowReajuste(false); setShowCalculo(false); setShowColunas(false); setShowValidarConfig(false); setShowHistoricoVendas(false); setShowLpCorretor(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showHistorico ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <History size={13} /> Histórico de Revisões
                  {projectRevisoes.length > 0 && (
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{projectRevisoes.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowValidar(v => { const next = !v; if (!next) setShowValidarConfig(false); return next; })}
                  title="Mostra nas colunas Validar Parcelas e Validar Valor da Unidade, calculadas para todas as unidades"
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showValidar ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <ShieldCheck size={13} /> Validar
                </button>
                {showValidar && (
                  <button
                    type="button"
                    onClick={() => { setShowValidarConfig(v => !v); setShowReajuste(false); setShowCalculo(false); setShowColunas(false); setShowHistorico(false); setShowHistoricoVendas(false); setShowLpCorretor(false); }}
                    title="Editar fórmulas de validação"
                    className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                      showValidarConfig ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                  >
                    <Settings size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowHistoricoVendas(v => !v); setShowReajuste(false); setShowCalculo(false); setShowColunas(false); setShowHistorico(false); setShowValidarConfig(false); setShowLpCorretor(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showHistoricoVendas ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <ReceiptText size={13} /> Histórico de Vendas
                  {projectVendas.length > 0 && (
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{projectVendas.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLpCorretor(v => !v); setShowHistoricoVendas(false); setShowReajuste(false); setShowCalculo(false); setShowColunas(false); setShowHistorico(false); setShowValidarConfig(false); }}
                  title="Página pública com a tabela de preços, para os corretores"
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showLpCorretor ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <Smartphone size={13} /> Tabela Corretor
                </button>
              </div>
            </>
          )}
        </div>

        {!selectedProjectId ? (
          <p className="text-xs text-zinc-600 text-center py-10">Nenhum empreendimento cadastrado.</p>
        ) : (
          <>
            {showLpCorretor && (
              <LpCorretorConfigPanel
                key={selectedProjectId}
                projectId={selectedProjectId}
                projectName={selectedProject?.name || ''}
                colunas={projectColunas}
                regras={projectRegras}
                onClose={() => setShowLpCorretor(false)}
              />
            )}

            {showColunas && (
              <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Colunas da Tabela</h3>
                    <p className="text-[11px] text-zinc-500">Adicione, remova, renomeie ou reordene as colunas deste empreendimento — inclui as colunas calculadas (regras). Unidade, Valor da Unidade e Situação são fixas. A fórmula de uma coluna calculada se edita em "Regras de Cálculo".</p>
                  </div>
                  <button type="button" onClick={() => setShowColunas(false)} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {projectMerged.map((m, idx) => m.kind === 'coluna' ? (
                    <ColunaRow
                      key={`c-${m.item.id}`}
                      coluna={m.item}
                      onCommit={onSaveColuna}
                      onDelete={onDeleteColuna}
                      onMoveUp={() => moveEntry(projectMerged, idx, -1, onSaveColuna, onSaveRegra)}
                      onMoveDown={() => moveEntry(projectMerged, idx, 1, onSaveColuna, onSaveRegra)}
                      isFirst={idx === 0}
                      isLast={idx === projectMerged.length - 1}
                    />
                  ) : (
                    <RegraColunaRow
                      key={`r-${m.item.id}`}
                      regra={m.item}
                      colunas={projectColunas}
                      onCommit={onSaveRegra}
                      onDelete={onDeleteRegra}
                      onMoveUp={() => moveEntry(projectMerged, idx, -1, onSaveColuna, onSaveRegra)}
                      onMoveDown={() => moveEntry(projectMerged, idx, 1, onSaveColuna, onSaveRegra)}
                      isFirst={idx === 0}
                      isLast={idx === projectMerged.length - 1}
                    />
                  ))}
                  <NovaColunaForm
                    projectId={selectedProjectId}
                    nextSortOrder={nextEntrySortOrder}
                    onAdd={onSaveColuna}
                  />
                </div>
              </div>
            )}

            {showReajuste && (
              <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-200">Reajuste de Valor da Tabela</h3>
                  <button type="button" onClick={resetReajuste} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-zinc-800 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setReajusteTipo('geral')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      reajusteTipo === 'geral' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                    }`}
                  >
                    Todas as unidades
                  </button>
                  <button
                    type="button"
                    onClick={() => setReajusteTipo('seletiva')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      reajusteTipo === 'seletiva' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                    }`}
                  >
                    Selecionar unidades
                  </button>
                </div>

                {reajusteTipo === 'seletiva' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-zinc-500">{selectedUnitIds.size} de {reajustaveisUnidades.length} unidade(s) selecionada(s)</span>
                    <p className="text-[10px] text-zinc-600">Unidades Vendidas ou em Permuta têm o valor congelado e não aparecem aqui.</p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-zinc-900/40 border border-zinc-800/50 rounded-lg">
                      {reajustaveisUnidades.length === 0 ? (
                        <span className="text-xs text-zinc-600 py-1">Nenhuma unidade disponível/bloqueada para reajustar.</span>
                      ) : (
                        [...reajustaveisUnidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true })).map(u => {
                          const checked = selectedUnitIds.has(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleUnit(u.id)}
                              className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                checked ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'text-zinc-400 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              {checked && <Check size={10} strokeWidth={3} />}
                              {u.unidade}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Percentual</label>
                    <PercentStepper value={reajustePercentual} onChange={setReajustePercentual} />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Descrição (opcional)</label>
                    <input
                      type="text"
                      value={reajusteDescricao}
                      onChange={e => setReajusteDescricao(e.target.value)}
                      placeholder="Ex.: Reajuste INCC julho/2026"
                      className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!canApply || applying}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors shrink-0"
                  >
                    {applying ? 'Aplicando...' : 'Aplicar'}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600">
                  {reajusteTipo === 'geral'
                    ? 'O percentual será aplicado a todas as unidades deste empreendimento.'
                    : 'O percentual será aplicado apenas às unidades selecionadas acima.'}
                </p>
              </div>
            )}

            {showCalculo && (
              <div className="flex flex-col gap-4 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Regras de Cálculo</h3>
                    <p className="text-[11px] text-zinc-500">Cada regra vira uma coluna calculada: percentual da coluna de referência, dividido ou multiplicado por um valor.</p>
                  </div>
                  <button type="button" onClick={() => setShowCalculo(false)} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {projectRegras.map(r => (
                    <RegraRow key={r.id} regra={r} colunas={projectColunas} onCommit={onSaveRegra} onDelete={onDeleteRegra} />
                  ))}
                  {projectRegras.length === 0 && (
                    <p className="text-xs text-zinc-600">Nenhuma regra cadastrada ainda.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onSaveRegra({
                      id: crypto.randomUUID(),
                      projectId: selectedProjectId,
                      titulo: 'Nova Regra',
                      quantidade: 1,
                      quantidadeColunaKey: null,
                      operacao: 'dividir',
                      percentual: 0,
                      colunaBaseKey: 'valor_tabela',
                      sortOrder: nextEntrySortOrder,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    })}
                    className="flex items-center gap-1.5 w-fit px-3 py-2 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus size={12} strokeWidth={3} /> Adicionar regra
                  </button>
                </div>
              </div>
            )}

            {showHistorico && (
              <div className="flex flex-col gap-2 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
                <h3 className="text-xs font-semibold text-zinc-200">Histórico de Revisões</h3>
                {projectRevisoes.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-2">Nenhuma revisão registrada ainda para este empreendimento.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                    {projectRevisoes.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-900/40 border border-zinc-800/50 rounded-lg">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200">Revisão #{r.numero}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${r.tipo === 'geral' ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400'}`}>
                              {r.tipo === 'geral' ? 'Geral' : 'Seletiva'}
                            </span>
                          </div>
                          {r.descricao && <span className="text-[11px] text-zinc-500 truncate">{r.descricao}</span>}
                          {r.unidades && r.unidades.length > 0 && (
                            <span className="text-[10px] text-zinc-600 truncate">{r.unidades.join(', ')}</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className={`text-xs font-bold ${r.percentual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.percentual >= 0 ? '+' : ''}{r.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                          </span>
                          <span className="text-[10px] text-zinc-600">{r.unidadesAfetadas} unid. · {formatDateTime(r.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showValidarConfig && (
              <ValidarPanel
                projectId={selectedProjectId}
                unidades={projectUnidades}
                colunas={projectColunas}
                regras={projectRegras}
                validacoes={projectValidacoes}
                onSaveValidacao={onSaveValidacao}
                onDeleteValidacao={onDeleteValidacao}
                onClose={() => setShowValidarConfig(false)}
              />
            )}

            {showHistoricoVendas && (
              <div className="flex flex-col gap-2 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Histórico de Vendas</h3>
                    <p className="text-[11px] text-zinc-500">Valores congelados no instante de cada venda — não mudam com reajustes ou edições posteriores na tabela principal.</p>
                  </div>
                  <button type="button" onClick={() => setShowHistoricoVendas(false)} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <HistoricoVendasTable vendas={projectVendas} colunas={projectColunas} />
              </div>
            )}

            <SiengeVendasTable
              projectId={selectedProjectId}
              unidades={filteredUnidades}
              allUnidadeNames={projectUnidades.map(u => u.unidade)}
              colunas={projectColunas}
              regras={projectRegras}
              validacoes={projectValidacoes}
              mostrarValidacao={showValidar}
              onSave={onSaveUnidade}
              onDelete={onDeleteUnidade}
              onSaveColuna={onSaveColuna}
              onSaveRegra={onSaveRegra}
            />
          </>
        )}
      </div>
    </div>
  );
}
