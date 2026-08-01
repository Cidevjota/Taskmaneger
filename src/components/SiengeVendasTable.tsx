import React, { useEffect, useState } from 'react';
import { Check, Trash2, Plus, X } from 'lucide-react';
import { SiengeCalculoRegra, SiengeTabelaVendaColuna, SiengeTabelaVendaUnidade, SiengeVendaSituacao } from '../types';
import { ColunaOuRegra, SITUACAO_LABELS, calcRegraValor, formatBrNumber, mergeColunasRegras, parseBrNumber } from '../lib/siengeVendasTabela';

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
  if (coluna.tipo === 'area') {
    return (
      <td className="px-3 py-2">
        <div className="inline-flex items-baseline gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={e => onChange(formatDecimalInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') onCommit(); }}
            placeholder="0"
            className="w-16 shrink-0 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
          />
          <span className="text-zinc-600 text-[9px] font-medium shrink-0">m²</span>
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

function todayInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Converte a data escolhida (YYYY-MM-DD) num instante local; se for hoje mantém
// a hora atual, para preservar a ordem de registro de várias vendas no mesmo dia.
function vendaTimestamp(dateValue: string): string {
  const today = todayInputValue();
  if (!dateValue || dateValue === today) return new Date().toISOString();
  const [y, m, d] = dateValue.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

// Balão de confirmação ao marcar uma unidade como vendida: pede o nome do
// comprador e a data da venda antes de aplicar — o congelamento (sienge_vendas)
// só acontece depois que o usuário confirma aqui. Importação de CSV e edição
// em massa mudam a situação sem gerar venda.
function ConfirmVendaPopover({ unidade, onConfirm, onCancel }: { unidade: string; onConfirm: (comprador: string, dataVenda: string) => void; onCancel: () => void }) {
  const [comprador, setComprador] = useState('');
  const [dataVenda, setDataVenda] = useState(todayInputValue());
  const confirm = () => onConfirm(comprador.trim(), vendaTimestamp(dataVenda));
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      <div className="absolute z-50 top-full left-0 mt-1.5 w-64 bg-[#18181b] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 p-3 flex flex-col gap-2 animate-fade-in">
        <p className="text-xs font-semibold text-zinc-200">Confirmar venda da unidade {unidade}</p>
        <input
          type="text"
          value={comprador}
          onChange={e => setComprador(e.target.value)}
          placeholder="Nome do comprador"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors"
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Data da venda</span>
          <input
            type="date"
            value={dataVenda}
            max={todayInputValue()}
            onChange={e => setDataVenda(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirm();
              if (e.key === 'Escape') onCancel();
            }}
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
          />
        </label>
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
          >
            Confirmar Venda
          </button>
        </div>
      </div>
    </>
  );
}

function VendaRow({ item, colunas, merged, onSave, onDelete }: {
  item: SiengeTabelaVendaUnidade;
  colunas: SiengeTabelaVendaColuna[];
  merged: ColunaOuRegra[];
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
  const [showVendaConfirm, setShowVendaConfirm] = useState(false);

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

  const handleSituacaoChange = (value: SiengeVendaSituacao) => {
    if (value === 'vendida' && item.situacao !== 'vendida') {
      setShowVendaConfirm(true);
      return;
    }
    setSituacao(value);
  };

  const confirmVenda = (comprador: string, dataVenda: string) => {
    setShowVendaConfirm(false);
    setSituacao('vendida');
    if (!unidadeText.trim()) return;
    onSave({
      ...draftItem,
      unidade: unidadeText.trim(),
      situacao: 'vendida',
      compradorAtual: comprador || null,
      // Carimbo que autoriza o trigger a gerar o snapshot em sienge_vendas.
      vendaConfirmadaEm: dataVenda,
      descricao: descricaoText.trim() || null,
      updatedAt: new Date().toISOString(),
    });
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
      {merged.map(m => m.kind === 'coluna' ? (
        <DynamicCell
          key={`c-${m.item.id}`}
          coluna={m.item}
          text={camposText[m.item.key] || ''}
          onChange={v => setCamposText(prev => ({ ...prev, [m.item.key]: v }))}
          onCommit={commit}
        />
      ) : (
        <td key={`r-${m.item.id}`} className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
          {(() => { const valor = calcRegraValor(draftItem, m.item); return valor > 0 ? formatCurrency(valor) : '—'; })()}
        </td>
      ))}
      <td className="px-3 py-2 relative">
        <select
          value={situacao}
          onChange={e => handleSituacaoChange(e.target.value as SiengeVendaSituacao)}
          className={`text-[11px] font-medium rounded-md border px-2 py-1 outline-none cursor-pointer transition-colors ${SITUACAO_STYLES[situacao]}`}
        >
          {(Object.keys(SITUACAO_LABELS) as SiengeVendaSituacao[]).map(s => (
            <option key={s} value={s} className="bg-zinc-900 text-zinc-100">{SITUACAO_LABELS[s]}</option>
          ))}
        </select>
        {showVendaConfirm && (
          <ConfirmVendaPopover
            unidade={item.unidade}
            onConfirm={confirmVenda}
            onCancel={() => setShowVendaConfirm(false)}
          />
        )}
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

function NewUnidadeRow({ projectId, colunas, merged, existingUnidades, onSave, onCancel }: {
  projectId: string;
  colunas: SiengeTabelaVendaColuna[];
  merged: ColunaOuRegra[];
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
      compradorAtual: null,
      frozenSince: null,
      vendaConfirmadaEm: null,
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
      {merged.map(m => m.kind === 'coluna' ? (
        <DynamicCell
          key={`c-${m.item.id}`}
          coluna={m.item}
          text={camposText[m.item.key] || ''}
          onChange={v => setCamposText(prev => ({ ...prev, [m.item.key]: v }))}
          onCommit={add}
        />
      ) : (
        <td key={`r-${m.item.id}`} className="px-3 py-2 text-xs text-zinc-600">—</td>
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
  const merged = mergeColunasRegras(colunas, regras);
  const sorted = [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));

  const totalCols = 3 + merged.length + 2; // unidade + valor + actions... usado no colSpan da linha "adicionar"
  const sumValor = sum(sorted.map(u => u.valorTabela));

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Unidade</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor da Unidade</th>
            {merged.map(m => (
              <th key={`${m.kind}-${m.item.id}`} className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {m.kind === 'coluna' ? m.item.label : m.item.titulo}
              </th>
            ))}
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Situação</th>
            <th className="text-left px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Descrição</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(item => (
            <VendaRow key={item.id} item={item} colunas={colunas} merged={merged} onSave={onSave} onDelete={onDelete} />
          ))}
          {addingNew ? (
            <NewUnidadeRow projectId={projectId} colunas={colunas} merged={merged} existingUnidades={allUnidadeNames} onSave={onSave} onCancel={() => setAddingNew(false)} />
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
              <td className="px-3 py-2 text-xs text-zinc-600" colSpan={merged.length + 3}>—</td>
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
