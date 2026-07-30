import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Table2, Building2, ChevronDown, TrendingUp, History, Minus, Plus, X, Check, Search, Calculator, Columns3, Upload, Download, Trash2 } from 'lucide-react';
import { Project, SiengeTabelaVendaUnidade, SiengeTabelaVendaRevisao, SiengeVendaSituacao, SiengeTabelaVendaColuna, SiengeCalculoRegra, SiengeColunaTipo } from '../types';
import SiengeVendasTable from './SiengeVendasTable';
import { exportSiengeVendasCsv, parseSiengeVendasCsv } from '../lib/siengeVendasTabela';

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
};

interface SiengeVendasModalProps {
  projects: Project[];
  unidades: SiengeTabelaVendaUnidade[];
  revisoes: SiengeTabelaVendaRevisao[];
  colunas: SiengeTabelaVendaColuna[];
  regras: SiengeCalculoRegra[];
  onSaveUnidade: (item: SiengeTabelaVendaUnidade) => void;
  onDeleteUnidade: (id: string) => void;
  onApplyReajuste: (params: { projectId: string; unidadeIds: string[] | null; percentual: number; descricao: string | null }) => Promise<void> | void;
  onSaveColuna: (coluna: SiengeTabelaVendaColuna) => void;
  onDeleteColuna: (id: string) => void;
  onSaveRegra: (regra: SiengeCalculoRegra) => void;
  onDeleteRegra: (id: string) => void;
  onClose: () => void;
}

function slugifyKeyLocal(label: string): string {
  return label.trim().toLowerCase().normalize('NFD').replace(/[^\w\s]/g, '').replace(/\s+/g, '_') || 'coluna';
}

// Linha editável de definição de coluna — rascunho local + commit no blur,
// mesmo padrão usado no resto do módulo Sienge.
function ColunaRow({ coluna, onCommit, onDelete }: { coluna: SiengeTabelaVendaColuna; onCommit: (c: SiengeTabelaVendaColuna) => void; onDelete: (id: string) => void }) {
  const [label, setLabel] = useState(coluna.label);
  useEffect(() => setLabel(coluna.label), [coluna.label]);

  const inputClass = 'flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500/50 transition-colors';

  return (
    <div className="flex items-center gap-2">
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

  return (
    <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_1.2fr_auto] gap-2 items-end">
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
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Quantidade</label>
        <input
          type="text"
          inputMode="numeric"
          value={quantidadeText}
          onChange={e => setQuantidadeText(e.target.value.replace(/\D/g, ''))}
          onBlur={() => { const n = parseInt(quantidadeText, 10) || 0; onCommit({ ...regra, quantidade: n }); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={inputClass}
        />
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  projects, unidades, revisoes, colunas, regras,
  onSaveUnidade, onDeleteUnidade, onApplyReajuste, onSaveColuna, onDeleteColuna, onSaveRegra, onDeleteRegra, onClose,
}: SiengeVendasModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [situacaoFilter, setSituacaoFilter] = useState<SiengeVendaSituacao | 'todas'>('todas');
  const [searchText, setSearchText] = useState('');
  const [showReajuste, setShowReajuste] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showCalculo, setShowCalculo] = useState(false);
  const [showColunas, setShowColunas] = useState(false);
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

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { unidades: parsed, novasColunas } = parseSiengeVendasCsv(
        text, selectedProjectId, projectUnidades, projectColunas, projectRegras.map(r => r.titulo)
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
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={13} /> Voltar
        </button>
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
                  accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800"
                >
                  <Upload size={13} /> Importar CSV
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
                  onClick={() => { setShowColunas(v => !v); setShowReajuste(false); setShowHistorico(false); setShowCalculo(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showColunas ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <Columns3 size={13} /> Colunas
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReajuste(v => !v); setShowHistorico(false); setShowCalculo(false); setShowColunas(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showReajuste ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <TrendingUp size={13} /> Atualizar Valor da Tabela
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCalculo(v => !v); setShowReajuste(false); setShowHistorico(false); setShowColunas(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showCalculo ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <Calculator size={13} /> Regras de Cálculo
                </button>
                <button
                  type="button"
                  onClick={() => { setShowHistorico(v => !v); setShowReajuste(false); setShowCalculo(false); setShowColunas(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showHistorico ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  <History size={13} /> Histórico de Revisões
                  {projectRevisoes.length > 0 && (
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{projectRevisoes.length}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {!selectedProjectId ? (
          <p className="text-xs text-zinc-600 text-center py-10">Nenhum empreendimento cadastrado.</p>
        ) : (
          <>
            {showColunas && (
              <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Colunas da Tabela</h3>
                    <p className="text-[11px] text-zinc-500">Adicione, remova ou renomeie as colunas deste empreendimento. Unidade, Valor da Unidade e Situação são fixas.</p>
                  </div>
                  <button type="button" onClick={() => setShowColunas(false)} className="p-1 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {projectColunas.map(c => (
                    <ColunaRow key={c.id} coluna={c} onCommit={onSaveColuna} onDelete={onDeleteColuna} />
                  ))}
                  <NovaColunaForm
                    projectId={selectedProjectId}
                    nextSortOrder={projectColunas.length > 0 ? Math.max(...projectColunas.map(c => c.sortOrder)) + 1 : 1}
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
                    <p className="text-[11px] text-zinc-500">Cada regra vira uma coluna calculada: percentual da coluna de referência, dividido pela quantidade de parcelas.</p>
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
                      percentual: 0,
                      colunaBaseKey: 'valor_tabela',
                      sortOrder: projectRegras.length > 0 ? Math.max(...projectRegras.map(r => r.sortOrder)) + 1 : 1,
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

            <SiengeVendasTable
              projectId={selectedProjectId}
              unidades={filteredUnidades}
              allUnidadeNames={projectUnidades.map(u => u.unidade)}
              colunas={projectColunas}
              regras={projectRegras}
              onSave={onSaveUnidade}
              onDelete={onDeleteUnidade}
            />
          </>
        )}
      </div>
    </div>
  );
}
