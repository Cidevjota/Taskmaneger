import React, { useEffect, useState } from 'react';
import { Check, Trash2, Plus, X } from 'lucide-react';
import { SiengeCalculoRegra, SiengeTabelaVendaColuna, SiengeTabelaVendaUnidade, SiengeVendaSituacao } from '../types';
import { SITUACAO_LABELS, calcRegraValor, formatBrNumber, parseBrNumber } from '../lib/siengeVendasTabela';

interface SiengeVendasTableProps {
  projectId: string;
  unidades: SiengeTabelaVendaUnidade[];
  allUnidadeNames: string[];
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  onSave: (item: SiengeTabelaVendaUnidade) => void;
  onDelete: (id: string) => void;
}

const SITUACAO_STYLES: Record<SiengeVendaSituacao, string> = {
  disponivel: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  vendida: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  permuta: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  bloqueada: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

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

function formatDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [intPart, ...rest] = cleaned.split(',');
  return rest.length ? `${intPart},${rest.join('')}` : intPart;
}

function parseDecimalInput(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Texto editável (dirty state comparado ao valor salvo) para uma coluna
// dinâmica — moeda usa máscara de centavos, número usa decimal livre, texto é livre.
function campoToText(coluna: SiengeTabelaVendaColuna, value: number | string | undefined): string {
  if (coluna.tipo === 'texto') return value != null ? String(value) : '';
  const n = typeof value === 'number' ? value : parseBrNumber(String(value ?? '0'));
  if (!n) return '';
  return coluna.tipo === 'moeda'
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function campoFromText(coluna: SiengeTabelaVendaColuna, text: string): number | string {
  if (coluna.tipo === 'texto') return text;
  return coluna.tipo === 'moeda' ? parseCurrencyInput(text) : parseDecimalInput(text);
}

const ROW_CLASS = '[&>td]:bg-zinc-900/40 [&>td]:border-y [&>td]:border-zinc-800/50 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg';
const NEW_ROW_CLASS = '[&>td]:bg-zinc-900/30 [&>td]:border-y [&>td]:border-dashed [&>td]:border-zinc-800/60 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg';

function DynamicCell({ coluna, text, onChange, onCommit }: { coluna: SiengeTabelaVendaColuna; text: string; onChange: (v: string) => void; onCommit: () => void }) {
  if (coluna.tipo === 'texto') {
    return (
      <td className="px-3 py-2 min-w-[140px]">
        <input
          type="text"
          value={text}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); }}
          placeholder="—"
          className="w-full min-w-0 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
        />
      </td>
    );
  }
  if (coluna.tipo === 'moeda') {
    return (
      <td className="px-3 py-2">
        <div className="inline-flex items-baseline gap-1">
          <span className="text-zinc-600 text-[9px] font-medium shrink-0">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={e => onChange(formatCurrencyInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') onCommit(); }}
            placeholder="0,00"
            className="w-24 shrink-0 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
          />
        </div>
      </td>
    );
  }
  return (
    <td className="px-3 py-2">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={e => onChange(formatDecimalInput(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); }}
        placeholder="0"
        className="w-16 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
      />
    </td>
  );
}

function VendaRow({ item, colunas, regras, onSave, onDelete }: {
  item: SiengeTabelaVendaUnidade;
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  onSave: (item: SiengeTabelaVendaUnidade) => void;
  onDelete: (id: string) => void;
}) {
  const savedValorText = item.valorTabela ? item.valorTabela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const savedCampos = Object.fromEntries(colunas.map(c => [c.key, campoToText(c, item.camposExtra[c.key])]));

  const [unidadeText, setUnidadeText] = useState(item.unidade);
  const [valorText, setValorText] = useState(savedValorText);
  const [camposText, setCamposText] = useState<Record<string, string>>(savedCampos);
  const [situacao, setSituacao] = useState<SiengeVendaSituacao>(item.situacao);
  const [descricaoText, setDescricaoText] = useState(item.descricao || '');

  useEffect(() => {
    setUnidadeText(item.unidade);
    setValorText(savedValorText);
    setCamposText(savedCampos);
    setSituacao(item.situacao);
    setDescricaoText(item.descricao || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.unidade, item.valorTabela, item.camposExtra, item.situacao, item.descricao, colunas]);

  const dirty = unidadeText !== item.unidade || valorText !== savedValorText
    || situacao !== item.situacao || descricaoText !== (item.descricao || '')
    || colunas.some(c => camposText[c.key] !== savedCampos[c.key]);

  const valorTabela = parseCurrencyInput(valorText);
  const camposExtra: Record<string, number | string> = {};
  colunas.forEach(c => { camposExtra[c.key] = campoFromText(c, camposText[c.key] || ''); });
  const draftItem: SiengeTabelaVendaUnidade = { ...item, valorTabela, camposExtra };

  const commit = () => {
    if (!unidadeText.trim()) return;
    onSave({ ...draftItem, unidade: unidadeText.trim(), situacao, descricao: descricaoText.trim() || null, updatedAt: new Date().toISOString() });
  };

  return (
    <tr className={`group ${ROW_CLASS}`}>
      <td className="px-3 py-2">
        <input
          type="text"
          value={unidadeText}
          onChange={e => setUnidadeText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          className="w-14 bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <div className="inline-flex items-baseline gap-1">
          <span className="text-zinc-600 text-[9px] font-medium shrink-0">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={valorText}
            onChange={e => setValorText(formatCurrencyInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            placeholder="0,00"
            className="w-24 shrink-0 bg-transparent text-xs font-semibold text-zinc-100 placeholder-zinc-600 outline-none"
          />
        </div>
      </td>
      {colunas.map(c => (
        <DynamicCell
          key={c.key}
          coluna={c}
          text={camposText[c.key] || ''}
          onChange={v => setCamposText(prev => ({ ...prev, [c.key]: v }))}
          onCommit={commit}
        />
      ))}
      {regras.map(r => {
        const valor = calcRegraValor(draftItem, r);
        return (
          <td key={r.id} className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
            {valor > 0 ? formatCurrency(valor) : '—'}
          </td>
        );
      })}
      <td className="px-3 py-2">
        <select
          value={situacao}
          onChange={e => setSituacao(e.target.value as SiengeVendaSituacao)}
          className={`text-[11px] font-medium rounded-md border px-2 py-1 outline-none cursor-pointer transition-colors ${SITUACAO_STYLES[situacao]}`}
        >
          {(Object.keys(SITUACAO_LABELS) as SiengeVendaSituacao[]).map(s => (
            <option key={s} value={s} className="bg-zinc-900 text-zinc-100">{SITUACAO_LABELS[s]}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <input
          type="text"
          value={descricaoText}
          onChange={e => setDescricaoText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder="—"
          className="w-full min-w-0 bg-transparent text-xs text-zinc-400 placeholder-zinc-700 outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {dirty && (
            <button
              type="button"
              onClick={commit}
              title="Salvar"
              className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md shadow-black/40 hover:bg-blue-400 active:scale-95 transition-all animate-fade-in"
            >
              <Check size={11} strokeWidth={3} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title="Remover unidade"
            className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function NewUnidadeRow({ projectId, colunas, regras, existingUnidades, onSave, onCancel }: {
  projectId: string;
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  existingUnidades: string[];
  onSave: (item: SiengeTabelaVendaUnidade) => void;
  onCancel: () => void;
}) {
  const [unidadeText, setUnidadeText] = useState('');
  const [valorText, setValorText] = useState('');
  const [camposText, setCamposText] = useState<Record<string, string>>({});
  const [situacao, setSituacao] = useState<SiengeVendaSituacao>('disponivel');
  const [descricaoText, setDescricaoText] = useState('');

  const trimmed = unidadeText.trim();
  const duplicate = trimmed.length > 0 && existingUnidades.includes(trimmed);
  const canAdd = trimmed.length > 0 && !duplicate;

  const add = () => {
    if (!canAdd) return;
    const camposExtra: Record<string, number | string> = {};
    colunas.forEach(c => { camposExtra[c.key] = campoFromText(c, camposText[c.key] || ''); });
    onSave({
      id: crypto.randomUUID(),
      projectId,
      unidade: trimmed,
      valorTabela: parseCurrencyInput(valorText),
      camposExtra,
      situacao,
      descricao: descricaoText.trim() || null,
      frozenSince: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onCancel();
  };

  return (
    <tr className={NEW_ROW_CLASS}>
      <td className="px-3 py-2">
        <input
          type="text"
          value={unidadeText}
          onChange={e => setUnidadeText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="Nova unidade"
          className="w-20 bg-transparent text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <div className="inline-flex items-baseline gap-1">
          <span className="text-zinc-600 text-[9px] font-medium shrink-0">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={valorText}
            onChange={e => setValorText(formatCurrencyInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="0,00"
            className="w-24 shrink-0 bg-transparent text-xs font-semibold text-zinc-100 placeholder-zinc-600 outline-none"
          />
        </div>
      </td>
      {colunas.map(c => (
        <DynamicCell
          key={c.key}
          coluna={c}
          text={camposText[c.key] || ''}
          onChange={v => setCamposText(prev => ({ ...prev, [c.key]: v }))}
          onCommit={add}
        />
      ))}
      {regras.map(r => (
        <td key={r.id} className="px-3 py-2 text-xs text-zinc-600">—</td>
      ))}
      <td className="px-3 py-2">
        <select
          value={situacao}
          onChange={e => setSituacao(e.target.value as SiengeVendaSituacao)}
          className={`text-[11px] font-medium rounded-md border px-2 py-1 outline-none cursor-pointer transition-colors ${SITUACAO_STYLES[situacao]}`}
        >
          {(Object.keys(SITUACAO_LABELS) as SiengeVendaSituacao[]).map(s => (
            <option key={s} value={s} className="bg-zinc-900 text-zinc-100">{SITUACAO_LABELS[s]}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <input
          type="text"
          value={descricaoText}
          onChange={e => setDescricaoText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="—"
          className="w-full min-w-0 bg-transparent text-xs text-zinc-400 placeholder-zinc-700 outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            title={duplicate ? 'Já existe uma unidade com esse nome' : 'Adicionar unidade'}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-md transition-colors"
          >
            <Plus size={11} strokeWidth={3} /> Adicionar
          </button>
          <button
            type="button"
            onClick={onCancel}
            title="Cancelar"
            className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

export default function SiengeVendasTable({ projectId, unidades, allUnidadeNames, colunas, regras, onSave, onDelete }: SiengeVendasTableProps) {
  const [addingNew, setAddingNew] = useState(false);
  const sortedColunas = [...colunas].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedRegras = [...regras].sort((a, b) => a.sortOrder - b.sortOrder);
  const sorted = [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));

  const totalCols = 3 + sortedColunas.length + sortedRegras.length + 2; // unidade + valor + actions... usado no colSpan da linha "adicionar"
  const sumValor = sum(sorted.map(u => u.valorTabela));

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Unidade</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor da Unidade</th>
            {sortedColunas.map(c => (
              <th key={c.key} className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{c.label}</th>
            ))}
            {sortedRegras.map(r => (
              <th key={r.id} className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{r.titulo}</th>
            ))}
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Situação</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Descrição</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(item => (
            <VendaRow key={item.id} item={item} colunas={sortedColunas} regras={sortedRegras} onSave={onSave} onDelete={onDelete} />
          ))}
          {addingNew ? (
            <NewUnidadeRow projectId={projectId} colunas={sortedColunas} regras={sortedRegras} existingUnidades={allUnidadeNames} onSave={onSave} onCancel={() => setAddingNew(false)} />
          ) : (
            <tr>
              <td colSpan={totalCols} className="px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => setAddingNew(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus size={12} strokeWidth={3} /> Adicionar
                </button>
              </td>
            </tr>
          )}
        </tbody>
        {sorted.length > 0 && (
          <tfoot>
            <tr className="[&>td]:bg-zinc-900/70 [&>td]:border-y [&>td]:border-zinc-800 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg">
              <td className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Soma</td>
              <td className="px-3 py-2 text-xs font-semibold text-zinc-100 whitespace-nowrap">{sumValor > 0 ? formatCurrency(sumValor) : '—'}</td>
              <td className="px-3 py-2 text-xs text-zinc-600" colSpan={sortedColunas.length + sortedRegras.length + 3}>—</td>
            </tr>
          </tfoot>
        )}
      </table>
      {sorted.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-6">Nenhuma unidade cadastrada para este empreendimento ainda.</p>
      )}
    </div>
  );
}
