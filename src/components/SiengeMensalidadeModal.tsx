import React, { useState, useEffect } from 'react';
import { X, FileText, DollarSign, Building2, Calendar, Tag, AlertCircle, Layers, ChevronDown, User, Repeat } from 'lucide-react';
import { SiengeMensalidade, SiengeLote, Project, SiengeCentroCusto } from '../types';
import { useAuth } from '../context/AuthContext';
import { SiengeTaxonomy, taxonomyCategoriasFor, taxonomySubcategoriasFor } from '../lib/siengeCategorias';

interface SiengeMensalidadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (m: SiengeMensalidade) => void;
  initialData?: SiengeMensalidade | null;
  openLotes: SiengeLote[];
  projects: Project[];
  taxonomy: SiengeTaxonomy;
}

function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(formatted: string): number {
  const cleaned = formatted.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function SiengeMensalidadeModal({
  isOpen, onClose, onSave, initialData, openLotes, projects, taxonomy,
}: SiengeMensalidadeModalProps) {
  const { allUsers: USERS, currentUser } = useAuth();
  const sortedUsers = currentUser
    ? [currentUser, ...USERS.filter(u => u.id !== currentUser.id)]
    : USERS;

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [empreendimento, setEmpreendimento] = useState('');
  const [centroCusto, setCentroCusto] = useState<SiengeCentroCusto | ''>('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [diaVencimento, setDiaVencimento] = useState<number | ''>('');
  const [loteId, setLoteId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isLoteOpen, setIsLoteOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isCentroCustoOpen, setIsCentroCustoOpen] = useState(false);
  const [isCategoriaOpen, setIsCategoriaOpen] = useState(false);
  const [isSubcategoriaOpen, setIsSubcategoriaOpen] = useState(false);
  const [isDiaOpen, setIsDiaOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitulo(initialData?.titulo || '');
    setDescricao(initialData?.descricao || '');
    setValorDisplay(
      initialData ? initialData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
    );
    setEmpreendimento(initialData?.empreendimento || '');
    setCentroCusto(initialData?.centroCusto || '');
    setCategoria(initialData?.categoria || '');
    setSubcategoria(initialData?.subcategoria || '');
    setDiaVencimento(initialData?.diaVencimento ?? '');
    setLoteId(initialData?.loteId || '');
    setAssigneeId(initialData?.assigneeId || '');
    setErrors({});
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const centroCustoLabel = (v: string) => taxonomy.centrosCusto.find(c => c.value === v)?.label || v;
  const categoriaOptions = centroCusto ? taxonomyCategoriasFor(taxonomy, centroCusto) : [];
  const subcategoriaOptions = centroCusto && categoria ? taxonomySubcategoriasFor(taxonomy, centroCusto, categoria) : [];

  const handleCentroCustoChange = (v: SiengeCentroCusto) => {
    setCentroCusto(v);
    setCategoria('');
    setSubcategoria('');
    setIsCentroCustoOpen(false);
    setErrors(p => ({ ...p, centroCusto: '' }));
  };

  const handleCategoriaChange = (c: string) => {
    setCategoria(c);
    setSubcategoria('');
    setIsCategoriaOpen(false);
    setErrors(p => ({ ...p, categoria: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!valorDisplay) e.valor = 'Valor é obrigatório';
    if (!assigneeId) e.assigneeId = 'Responsável é obrigatório';
    if (!empreendimento.trim()) e.empreendimento = 'Empreendimento é obrigatório';
    if (!centroCusto) e.centroCusto = 'Centro de custo é obrigatório';
    if (!categoria) e.categoria = 'Categoria é obrigatória';
    if (!subcategoria) e.subcategoria = 'Subcategoria é obrigatória';
    if (!diaVencimento) e.diaVencimento = 'Dia do vencimento é obrigatório';
    if (!descricao.trim()) e.descricao = 'Descrição é obrigatória';
    // Lote é opcional aqui, diferente do título: a mensalidade costuma ser cadastrada
    // antes de existir um lote aberto para o mês em que ela vai cair.
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSave({
      id: initialData?.id || crypto.randomUUID(),
      titulo: titulo.trim() || undefined,
      descricao: descricao.trim(),
      valor: parseCurrency(valorDisplay),
      empreendimento: empreendimento.trim(),
      centroCusto: centroCusto || undefined,
      categoria,
      subcategoria,
      diaVencimento: Number(diaVencimento),
      loteId: loteId || undefined,
      assigneeId,
      ativa: initialData?.ativa ?? true,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const fieldClass = (err?: string) =>
    `w-full flex items-center justify-between bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-zinc-800/60 ${
      err ? 'border-red-500/60' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
    }`;

  const Err = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{msg}</p> : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0d0d10] border border-zinc-800/80 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between view-pad-x py-4 short:py-2.5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Repeat size={15} className="text-blue-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              {initialData ? 'Editar Mensalidade' : 'Nova Mensalidade'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto modal-body-h">
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg text-[11px] text-blue-300/90 leading-relaxed">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            Todo dia 01 esta mensalidade vira um título novo em "A Lançar", com vencimento no dia escolhido do mês vigente.
          </div>

          {/* Lote (opcional) */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Layers size={11} /> Lote de Pagamento <span className="text-zinc-600 normal-case tracking-normal font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <button type="button" onClick={() => setIsLoteOpen(p => !p)} className={fieldClass()}>
                <span className={`min-w-0 truncate text-left ${loteId ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                  {loteId ? openLotes.find(l => l.id === loteId)?.nome : 'Sem lote definido'}
                </span>
                <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isLoteOpen ? 'rotate-180' : ''}`} />
              </button>
              {isLoteOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLoteOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => { setLoteId(''); setIsLoteOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${!loteId ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50'}`}
                      >
                        <span className="font-medium text-[13px]">Sem lote definido</span>
                      </button>
                      {openLotes.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => { setLoteId(l.id); setIsLoteOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${l.id === loteId ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
                        >
                          <Layers size={14} className={l.id === loteId ? 'text-blue-500/70' : 'text-zinc-500'} />
                          <span className="font-medium text-[13px]">{l.nome}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Responsável */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <User size={11} /> Responsável <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button type="button" onClick={() => setIsAssigneeOpen(p => !p)} className={fieldClass(errors.assigneeId)}>
                <span className={`min-w-0 truncate text-left ${assigneeId ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                  {assigneeId ? sortedUsers.find(u => u.id === assigneeId)?.name : 'Selecionar responsável...'}
                </span>
                <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`} />
              </button>
              <Err msg={errors.assigneeId} />
              {isAssigneeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAssigneeOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {sortedUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setAssigneeId(u.id); setIsAssigneeOpen(false); setErrors(p => ({ ...p, assigneeId: '' })); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${assigneeId === u.id ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50'}`}
                        >
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                            : <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">{u.initials}</div>}
                          <span className="font-medium text-[13px]">{u.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Empreendimento */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Building2 size={11} /> Empreendimento <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button type="button" onClick={() => setIsProjectOpen(p => !p)} className={fieldClass(errors.empreendimento)}>
                <span className={`min-w-0 truncate text-left ${empreendimento ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                  {empreendimento || 'Selecione um empreendimento'}
                </span>
                <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isProjectOpen ? 'rotate-180' : ''}`} />
              </button>
              <Err msg={errors.empreendimento} />
              {isProjectOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProjectOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setEmpreendimento(p.name); setIsProjectOpen(false); setErrors(prev => ({ ...prev, empreendimento: '' })); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${p.name === empreendimento ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="font-medium text-[13px]">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Centro de Custo */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Tag size={11} /> Centro de Custo <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button type="button" onClick={() => setIsCentroCustoOpen(p => !p)} className={fieldClass(errors.centroCusto)}>
                <span className={`min-w-0 truncate text-left ${centroCusto ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                  {centroCusto ? centroCustoLabel(centroCusto) : 'Selecione o centro de custo'}
                </span>
                <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isCentroCustoOpen ? 'rotate-180' : ''}`} />
              </button>
              <Err msg={errors.centroCusto} />
              {isCentroCustoOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCentroCustoOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                    {taxonomy.centrosCusto.map(cc => (
                      <button
                        key={cc.value}
                        type="button"
                        onClick={() => handleCentroCustoChange(cc.value)}
                        className={`w-full flex items-center px-3 py-2 text-sm transition-colors ${cc.value === centroCusto ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
                      >
                        <span className="font-medium text-[13px]">{cc.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Categoria + Subcategoria — min-w-0 evita o estouro de largura com nomes longos */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0 relative">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Tag size={11} /> Categoria <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  disabled={!centroCusto}
                  onClick={() => setIsCategoriaOpen(p => !p)}
                  className={`${fieldClass(errors.categoria)} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className={`min-w-0 truncate text-left ${categoria ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                    {categoria || (centroCusto ? 'Selecione a categoria' : 'Selecione o centro de custo primeiro')}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isCategoriaOpen ? 'rotate-180' : ''}`} />
                </button>
                <Err msg={errors.categoria} />
                {isCategoriaOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsCategoriaOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {categoriaOptions.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleCategoriaChange(c)}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${c === categoria ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
                          >
                            <span className="font-medium text-[13px]">{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0 relative">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Tag size={11} /> Subcategoria <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  disabled={!categoria}
                  onClick={() => setIsSubcategoriaOpen(p => !p)}
                  className={`${fieldClass(errors.subcategoria)} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className={`min-w-0 truncate text-left ${subcategoria ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                    {subcategoria || (categoria ? 'Selecione a subcategoria' : 'Selecione a categoria primeiro')}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isSubcategoriaOpen ? 'rotate-180' : ''}`} />
                </button>
                <Err msg={errors.subcategoria} />
                {isSubcategoriaOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSubcategoriaOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {subcategoriaOptions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => { setSubcategoria(s); setIsSubcategoriaOpen(false); setErrors(p => ({ ...p, subcategoria: '' })); }}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${s === subcategoria ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
                          >
                            <span className="font-medium text-[13px]">{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Valor + Dia do vencimento */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <DollarSign size={11} /> Valor (R$) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">R$</span>
                <input
                  type="text"
                  value={valorDisplay}
                  onChange={e => { setValorDisplay(formatCurrency(e.target.value)); setErrors(p => ({ ...p, valor: '' })); }}
                  placeholder="0,00"
                  className={`w-full bg-zinc-900/60 border rounded-lg pl-10 pr-3 py-2.5 text-sm text-zinc-100 outline-none transition-all placeholder-zinc-600 ${
                    errors.valor ? 'border-red-500/60' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
                  }`}
                />
              </div>
              <Err msg={errors.valor} />
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0 relative">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Calendar size={11} /> Dia do Vencimento <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <button type="button" onClick={() => setIsDiaOpen(p => !p)} className={fieldClass(errors.diaVencimento)}>
                  <span className={`min-w-0 truncate text-left ${diaVencimento ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                    {diaVencimento ? `Todo dia ${diaVencimento}` : 'Selecione o dia'}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${isDiaOpen ? 'rotate-180' : ''}`} />
                </button>
                <Err msg={errors.diaVencimento} />
                {isDiaOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDiaOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-4 gap-1 p-1.5">
                        {DIAS.map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => { setDiaVencimento(d); setIsDiaOpen(false); setErrors(p => ({ ...p, diaVencimento: '' })); }}
                            className={`py-1.5 rounded-md text-[13px] font-medium transition-colors ${d === diaVencimento ? 'bg-blue-500/15 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/60'}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Nos meses em que o dia não existe o vencimento cai no último dia — avisar
              evita a impressão de que a mensalidade "mudou de dia sozinha". */}
          {Number(diaVencimento) > 28 && (
            <p className="text-[11px] text-amber-400/90 flex items-start gap-1.5 -mt-1">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              Em meses sem o dia {diaVencimento}, o vencimento cai no último dia do mês.
            </p>
          )}

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <FileText size={11} /> Descrição <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              value={descricao}
              onChange={e => { setDescricao(e.target.value.toUpperCase()); setErrors(p => ({ ...p, descricao: '' })); }}
              placeholder="DESCREVA A MENSALIDADE..."
              className={`w-full bg-zinc-900/60 border rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none transition-all resize-none placeholder-zinc-600 ${
                errors.descricao ? 'border-red-500/60' : 'border-zinc-800 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50'
              }`}
            />
            <Err msg={errors.descricao} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800/60 bg-[#0a0a0c]">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors uppercase tracking-wider">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg shadow-blue-500/20"
          >
            <Repeat size={14} /> {initialData ? 'Salvar Mensalidade' : 'Criar Mensalidade'}
          </button>
        </div>
      </div>
    </div>
  );
}
