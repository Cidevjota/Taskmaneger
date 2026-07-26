import React, { useEffect, useState } from 'react';
import { Check, Trash2, Plus, X } from 'lucide-react';
import { SiengeTabelaVendaUnidade, SiengeVendaSituacao } from '../types';

interface SiengeVendasTableProps {
  projectId: string;
  unidades: SiengeTabelaVendaUnidade[];
  allUnidadeNames: string[];
  onSave: (item: SiengeTabelaVendaUnidade) => void;
  onDelete: (id: string) => void;
}

const SITUACAO_LABELS: Record<SiengeVendaSituacao, string> = {
  disponivel: 'Disponível',
  vendida: 'Vendida',
  permuta: 'Permuta',
  bloqueada: 'Bloqueada',
};

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

function formatAreaInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [intPart, ...rest] = cleaned.split(',');
  return rest.length ? `${intPart},${rest.join('')}` : intPart;
}

function parseAreaInput(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ROW_CLASS = '[&>td]:bg-zinc-900/40 [&>td]:border-y [&>td]:border-zinc-800/50 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg';
const NEW_ROW_CLASS = '[&>td]:bg-zinc-900/30 [&>td]:border-y [&>td]:border-dashed [&>td]:border-zinc-800/60 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg';

// Linha editável de unidade — mesmo padrão de "rascunho local + botão salvar
// quando algo muda" já usado em SiengeMetasTable (ProjectTotalRow), para manter
// a planilha consistente com o resto do módulo.
function VendaRow({ item, onSave, onDelete }: { item: SiengeTabelaVendaUnidade; onSave: (item: SiengeTabelaVendaUnidade) => void; onDelete: (id: string) => void }) {
  const savedAreaText = item.areaM2 ? item.areaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
  const savedValorText = item.valorTabela ? item.valorTabela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

  const [unidadeText, setUnidadeText] = useState(item.unidade);
  const [areaText, setAreaText] = useState(savedAreaText);
  const [valorText, setValorText] = useState(savedValorText);
  const [situacao, setSituacao] = useState<SiengeVendaSituacao>(item.situacao);
  const [descricaoText, setDescricaoText] = useState(item.descricao || '');

  useEffect(() => {
    setUnidadeText(item.unidade);
    setAreaText(savedAreaText);
    setValorText(savedValorText);
    setSituacao(item.situacao);
    setDescricaoText(item.descricao || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.unidade, item.areaM2, item.valorTabela, item.situacao, item.descricao]);

  const dirty = unidadeText !== item.unidade || areaText !== savedAreaText || valorText !== savedValorText
    || situacao !== item.situacao || descricaoText !== (item.descricao || '');
  const areaM2 = parseAreaInput(areaText);
  const valorTabela = parseCurrencyInput(valorText);
  const valorM2 = areaM2 > 0 ? valorTabela / areaM2 : 0;

  const commit = () => {
    if (!unidadeText.trim()) return;
    onSave({ ...item, unidade: unidadeText.trim(), areaM2, valorTabela, situacao, descricao: descricaoText.trim() || null, updatedAt: new Date().toISOString() });
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
        <div className="inline-flex items-baseline gap-0.5">
          <input
            type="text"
            inputMode="decimal"
            value={areaText}
            onChange={e => setAreaText(formatAreaInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            placeholder="0"
            className="w-12 shrink-0 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
          />
          <span className="text-zinc-600 text-[9px] shrink-0">m²</span>
        </div>
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
      <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
        {valorM2 > 0 ? formatCurrency(valorM2) : '—'}
      </td>
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

function NewUnidadeRow({ projectId, existingUnidades, onSave, onCancel }: { projectId: string; existingUnidades: string[]; onSave: (item: SiengeTabelaVendaUnidade) => void; onCancel: () => void }) {
  const [unidadeText, setUnidadeText] = useState('');
  const [areaText, setAreaText] = useState('');
  const [valorText, setValorText] = useState('');
  const [situacao, setSituacao] = useState<SiengeVendaSituacao>('disponivel');
  const [descricaoText, setDescricaoText] = useState('');

  const trimmed = unidadeText.trim();
  const duplicate = trimmed.length > 0 && existingUnidades.includes(trimmed);
  const canAdd = trimmed.length > 0 && !duplicate;

  const add = () => {
    if (!canAdd) return;
    onSave({
      id: crypto.randomUUID(),
      projectId,
      unidade: trimmed,
      areaM2: parseAreaInput(areaText),
      valorTabela: parseCurrencyInput(valorText),
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
        <div className="inline-flex items-baseline gap-0.5">
          <input
            type="text"
            inputMode="decimal"
            value={areaText}
            onChange={e => setAreaText(formatAreaInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="0"
            className="w-12 shrink-0 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
          />
          <span className="text-zinc-600 text-[9px] shrink-0">m²</span>
        </div>
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
      <td className="px-3 py-2 text-xs text-zinc-600">—</td>
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

function average(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

export default function SiengeVendasTable({ projectId, unidades, allUnidadeNames, onSave, onDelete }: SiengeVendasTableProps) {
  const [addingNew, setAddingNew] = useState(false);
  const sorted = [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));

  const avgArea = average(sorted.filter(u => u.areaM2 > 0).map(u => u.areaM2));
  const avgValor = average(sorted.filter(u => u.valorTabela > 0).map(u => u.valorTabela));
  const avgValorM2 = average(sorted.filter(u => u.areaM2 > 0 && u.valorTabela > 0).map(u => u.valorTabela / u.areaM2));
  const sumArea = sum(sorted.map(u => u.areaM2));
  const sumValor = sum(sorted.map(u => u.valorTabela));

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Unidade</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">m²</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor da Unidade</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor por m²</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Situação</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Descrição</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(item => (
            <VendaRow key={item.id} item={item} onSave={onSave} onDelete={onDelete} />
          ))}
          {addingNew ? (
            <NewUnidadeRow projectId={projectId} existingUnidades={allUnidadeNames} onSave={onSave} onCancel={() => setAddingNew(false)} />
          ) : (
            <tr>
              <td colSpan={7} className="px-3 py-1.5">
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
              <td className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Média</td>
              <td className="px-3 py-2 text-xs text-zinc-300 whitespace-nowrap">{avgArea > 0 ? `${avgArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²` : '—'}</td>
              <td className="px-3 py-2 text-xs font-semibold text-zinc-100 whitespace-nowrap">{avgValor > 0 ? formatCurrency(avgValor) : '—'}</td>
              <td className="px-3 py-2 text-xs text-zinc-300 whitespace-nowrap">{avgValorM2 > 0 ? formatCurrency(avgValorM2) : '—'}</td>
              <td className="px-3 py-2" colSpan={3} />
            </tr>
            <tr className="[&>td]:bg-zinc-900/70 [&>td]:border-y [&>td]:border-zinc-800 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg">
              <td className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Soma</td>
              <td className="px-3 py-2 text-xs text-zinc-300 whitespace-nowrap">{sumArea > 0 ? `${sumArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²` : '—'}</td>
              <td className="px-3 py-2 text-xs font-semibold text-zinc-100 whitespace-nowrap">{sumValor > 0 ? formatCurrency(sumValor) : '—'}</td>
              <td className="px-3 py-2 text-xs text-zinc-600" colSpan={4}>—</td>
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
