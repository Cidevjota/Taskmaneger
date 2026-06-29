import React, { useState, useMemo } from 'react';
import { Project, Task, Label } from '../types';
import { Filter, Calendar, Users, FolderKanban, Tag, Flag, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Activity, BarChart2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
}

const manualMap: Record<string, string> = {
  'f1ae073d': 'Cidnei',
  '8b7653f6': 'Davi',
  '6a068894': 'Karen',
  'd90d517a': 'Eri',
  '94d9a300': 'Kariny'
};

export default function DashboardView({ tasks, projects, labels }: DashboardViewProps) {
  // Filtros
  const [period, setPeriod] = useState('Todo o período');
  const [member, setMember] = useState('Todos os Responsáveis');
  const [project, setProject] = useState('Todos os empreendimentos');
  const [taskClass, setTaskClass] = useState('Todas as classes');
  const [priority, setPriority] = useState('Todas as prioridades');

  const { allUsers } = useAuth();

  // Dynamic Options
  const projectOptions = ['Todos os empreendimentos', ...projects.map(p => p.name)];
  const classOptions = ['Todas as classes', ...labels.map(l => l.name)];
  
  // Get actual unique user names from tasks
  const uniqueMemberIds = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean)));
  
  const uniqueMemberNames = uniqueMemberIds.map(id => {
    const user = allUsers.find(u => u.id === id);
    if (user && user.name) return user.name;
    
    const prefix = (id as string).substring(0, 8);
    return manualMap[prefix] || (id as string);
  });
  
  // Combine all possible user names
  const authUserNames = allUsers.map(u => u.name).filter(Boolean);
  const manualNames = Object.values(manualMap);
  const requestedNames = ['Junior', 'Pedro'];
  const allPossibleNames = Array.from(new Set([...authUserNames, ...manualNames, ...requestedNames, ...uniqueMemberNames]));

  const memberOptions = ['Todos os Responsáveis', ...allPossibleNames];
  const priorityOptions = ['Todas as prioridades', 'Urgente', 'Alta', 'Média', 'Baixa'];
  const periodOptions = ['Todo o período', 'Últimos 7 dias', 'Últimos 14 dias', 'Últimos 30 dias'];

  const renderMemberOption = (opt: string) => {
    if (opt === 'Todos os Responsáveis') return <span>{opt}</span>;
    const prefixMatch = Object.keys(manualMap).find(k => manualMap[k] === opt);
    const userObj = allUsers.find(u => u.name === opt || (prefixMatch && u.id.startsWith(prefixMatch)));
    
    if (userObj && userObj.avatarUrl) {
      return (
        <div className="flex items-center gap-1.5">
          <img src={userObj.avatarUrl} alt={opt} className="w-3.5 h-3.5 rounded-full object-cover" />
          <span>{opt}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(opt)}&background=27272a&color=a1a1aa&size=128`} alt={opt} className="w-3.5 h-3.5 rounded-full object-cover" />
        <span>{opt}</span>
      </div>
    );
  };

  const renderClassOption = (opt: string) => {
    if (opt === 'Todas as classes') return <span>{opt}</span>;
    const labelObj = labels.find(l => l.name === opt);
    const colorVal = labelObj?.color || '#52525b';
    const isHex = colorVal.startsWith('#');
    
    // Extract the base background class without opacity if it's a tailwind class (e.g., bg-blue-500/10 -> bg-blue-500)
    let bgClass = '';
    if (!isHex) {
      bgClass = colorVal.split(' ').find(c => c.startsWith('bg-'))?.replace(/\/[0-9]+$/, '') || 'bg-zinc-500';
    }

    return (
      <div className="flex items-center gap-1.5">
        {isHex ? (
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: colorVal }}></span>
        ) : (
          <span className={`w-2 h-2 rounded-sm ${bgClass}`}></span>
        )}
        <span>{opt}</span>
      </div>
    );
  };

  const renderPriorityOption = (opt: string) => {
    if (opt === 'Todas as prioridades') return <span>{opt}</span>;
    let iconClass = "text-blue-500";
    if (opt === 'Urgente') iconClass = "text-red-500";
    if (opt === 'Alta') iconClass = "text-orange-500";
    if (opt === 'Média') iconClass = "text-yellow-500";
    
    return (
      <div className="flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
          {opt === 'Urgente' ? (
            <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
          ) : opt === 'Alta' ? (
            <><polyline points="18 15 12 9 6 15"/></>
          ) : opt === 'Média' ? (
            <><line x1="5" y1="12" x2="19" y2="12"/></>
          ) : (
            <><polyline points="6 9 12 15 18 9"/></>
          )}
        </svg>
        <span>{opt}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#08080a] text-zinc-200">

      {/* Top Filter Bar */}
      <div className="h-14 border-b border-zinc-900 px-6 flex items-center gap-4 shrink-0 bg-[#0c0c0e]">
        <div className="flex items-center gap-2 text-zinc-400 mr-2">
          <Filter size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wider font-sans">Filtros</span>
        </div>

        <FilterSelect icon={<Calendar size={13} />} value={period} options={periodOptions} onChange={setPeriod} />
        <FilterSelect icon={<Users size={13} />} value={member} options={memberOptions} onChange={setMember} renderOption={renderMemberOption} />
        <FilterSelect icon={<FolderKanban size={13} />} value={project} options={projectOptions} onChange={setProject} />
        <FilterSelect icon={<Tag size={13} />} value={taskClass} options={classOptions} onChange={setTaskClass} renderOption={renderClassOption} />
        <FilterSelect icon={<Flag size={13} />} value={priority} options={priorityOptions} onChange={setPriority} renderOption={renderPriorityOption} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <OverviewTab 
          tasks={tasks} 
          projects={projects} 
          period={period} 
          member={member} 
          projectFilter={project} 
          taskClass={taskClass} 
          priorityFilter={priority} 
        />
      </div>
    </div>
  );
}

// Subcomponents
function FilterSelect({ icon, value, options, onChange, renderOption }: { icon: React.ReactNode, value: string, options: string[], onChange: (val: string) => void, renderOption?: (val: string) => React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-md text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
      >
        {icon}
        {renderOption ? renderOption(value) : value}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 ml-1"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] max-w-[240px] max-h-[300px] overflow-y-auto bg-[#18181b] border border-zinc-800 rounded-md shadow-xl z-[100] py-1 custom-scrollbar">
          {options.map((opt, i) => (
            <button
              key={i}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors truncate ${value === opt ? 'text-white bg-zinc-800/50 font-medium' : 'text-zinc-400'}`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {renderOption ? renderOption(opt) : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Aba 1: Overview
// ------------------------------------------------------------------
interface OverviewTabProps {
  tasks: Task[];
  projects: Project[];
  period: string;
  member: string;
  projectFilter: string;
  taskClass: string;
  priorityFilter: string;
}

function OverviewTab({ tasks, projects, period, member, projectFilter, taskClass, priorityFilter }: OverviewTabProps) {
  const { allUsers } = useAuth();
  
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Period
      const targetDate = t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - targetDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let inPeriodRange = true;
      if (period === 'Últimos 7 dias') inPeriodRange = diffDays <= 7;
      else if (period === 'Últimos 14 dias') inPeriodRange = diffDays <= 14;
      else if (period === 'Últimos 30 dias') inPeriodRange = diffDays <= 30;

      let periodMatch = inPeriodRange;
      if (!inPeriodRange) {
        const isConcluido = ['implementation', 'done'].includes(t.status);
        if (!isConcluido) {
          periodMatch = true; // Include old pending tasks as active
        }
      }

      // Project
      let projectMatch = true;
      if (projectFilter !== 'Todos os empreendimentos') {
        const p = projects.find(proj => proj.name === projectFilter);
        if (p) projectMatch = t.projectId === p.id;
      }

      // Priority
      let prioMatch = true;
      if (priorityFilter !== 'Todas as prioridades') {
        const prioMap: Record<string, string> = { 'Urgente': 'urgent', 'Alta': 'high', 'Média': 'medium', 'Baixa': 'low' };
        prioMatch = t.priority === prioMap[priorityFilter];
      }

      // Member
      let memberMatch = true;
      if (member !== 'Todos os Responsáveis') {
        const userObj = allUsers.find(u => u.name === member);
        if (userObj) {
          memberMatch = t.assigneeId === userObj.id;
        } else {
          const prefixMatch = Object.keys(manualMap).find(k => manualMap[k] === member);
          if (prefixMatch) {
            memberMatch = !!(t.assigneeId && t.assigneeId.startsWith(prefixMatch));
          } else {
            memberMatch = t.assigneeId === member;
          }
        }
      }

      // Class
      let classMatch = true;
      if (taskClass !== 'Todas as classes') {
        classMatch = t.labels?.some(l => l.name === taskClass) ?? false;
      }

      return periodMatch && projectMatch && prioMatch && memberMatch && classMatch;
    });
  }, [tasks, projects, period, projectFilter, priorityFilter, member, taskClass]);

  const metrics = useMemo(() => {
    // Entregas: Tasks that transitioned to 'implementation' or 'done' during the selected period
    let cutoffDays = 0;
    if (period === 'Últimos 7 dias') cutoffDays = 7;
    else if (period === 'Últimos 14 dias') cutoffDays = 14;
    else if (period === 'Últimos 30 dias') cutoffDays = 30;
    
    const cutoffDate = new Date(new Date().getTime() - (cutoffDays * 24 * 60 * 60 * 1000));

    const entregas = filteredTasks.filter(t => {
      if (!['implementation', 'done'].includes(t.status)) return false;
      
      if (t.statusHistory && t.statusHistory.length > 0) {
        const lastEntry = t.statusHistory.slice().reverse().find(h => ['implementation', 'done'].includes(h.status));
        if (lastEntry) {
          return new Date(lastEntry.enteredAt) >= cutoffDate;
        }
      }
      const reachedAt = t.timeTracking?.reachedImplementationAt || t.updatedAt || t.createdAt;
      return new Date(reachedAt) >= cutoffDate;
    });
    
    // Entregas no Prazo
    const entregasNoPrazo = entregas.filter(t => {
      if (!t.dueDate) return true;
      const completedAt = t.timeTracking?.reachedImplementationAt || t.updatedAt || new Date().toISOString();
      return new Date(completedAt) <= new Date(t.dueDate);
    });
    const pctEntregasNoPrazo = entregas.length > 0 ? Math.round((entregasNoPrazo.length / entregas.length) * 100) : 0;

    // Tempo de Ciclo Execução
    const cycleTimes = entregas.map(t => {
      let totalMs = 0;
      if (t.statusHistory && t.statusHistory.length > 0) {
         t.statusHistory.forEach(h => {
           if (h.status === 'in_progress') {
             const start = new Date(h.enteredAt).getTime();
             const end = h.leftAt ? new Date(h.leftAt).getTime() : new Date().getTime();
             totalMs += (end - start);
           }
         });
      } else {
         totalMs = t.timeTracking?.accumulatedMs || 0;
      }
      return totalMs / (1000 * 60 * 60 * 24);
    }).filter(d => d > 0);
    const avgCycleTime = cycleTimes.length > 0 ? (cycleTimes.reduce((a,b)=>a+b,0) / cycleTimes.length).toFixed(1) : '0.0';

    // Tempo de Ciclo Total
    const leadTimes = entregas.map(t => {
      const end = new Date(t.timeTracking?.reachedImplementationAt || t.updatedAt || new Date());
      const start = new Date(t.createdAt);
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    });
    const avgLeadTime = leadTimes.length > 0 ? (leadTimes.reduce((a,b)=>a+b,0) / leadTimes.length).toFixed(1) : '0.0';

    // Taxa de Atraso
    const atrasadas = filteredTasks.filter(t => !['implementation', 'done'].includes(t.status) && t.dueDate && new Date(t.dueDate) < new Date());
    const pctAtraso = filteredTasks.length > 0 ? Math.round((atrasadas.length / filteredTasks.length) * 100) : 0;

    // Criação vs Conclusão
    const criadas = filteredTasks.length;
    const razao = `${criadas}:${entregas.length}`;

    // Refação
    const tarefasComRefacao = entregas.filter(t => (t.reworkCount || 0) > 0);
    const taxaRefacao = entregas.length > 0 ? Math.round((tarefasComRefacao.length / entregas.length) * 100) : 0;
    
    // Ciclos Medianos / Media de Refação
    const reworkCounts = entregas.map(t => t.reworkCount || 0).filter(c => c > 0).sort((a,b)=>a-b);
    let medianaRefacao = 0;
    let mediaRefacao = 0;
    let p75Refacao = 0;
    if (reworkCounts.length > 0) {
      const mid = Math.floor(reworkCounts.length / 2);
      medianaRefacao = reworkCounts.length % 2 !== 0 ? reworkCounts[mid] : (reworkCounts[mid - 1] + reworkCounts[mid]) / 2;
      mediaRefacao = reworkCounts.reduce((a,b)=>a+b,0) / reworkCounts.length;
      const p75Index = Math.floor(reworkCounts.length * 0.75);
      p75Refacao = reworkCounts[p75Index];
    }
    const taxaAprovacaoDireta = entregas.length > 0 ? Math.round(((entregas.length - tarefasComRefacao.length) / entregas.length) * 100) : 0;
    const aprovadasDireto = entregas.length - tarefasComRefacao.length;

    return {
      criadasTotais: criadas,
      entregasTotais: entregas.length,
      entregas: entregas.length.toString(),
      entregasNoPrazoVal: entregasNoPrazo.length.toString(),
      entregasNoPrazoAbs: `${pctEntregasNoPrazo}% de conversão (total: ${entregas.length})`,
      avgCycleTime,
      avgLeadTime,
      atrasoVal: atrasadas.length.toString(),
      atrasoAbs: `${pctAtraso}% do total em atraso`,
      criacaoVsConclusaoVal: razao,
      criacaoVsConclusaoAbs: `${criadas} criadas / ${entregas.length} concluídas`,
      aprovacaoDiretaVal: aprovadasDireto.toString(),
      aprovacaoDiretaAbs: `${taxaAprovacaoDireta}% do total sem refação`,
      ciclosRefacaoVal: mediaRefacao.toFixed(1),
      ciclosRefacaoAbs: `Méd: ${mediaRefacao.toFixed(1)} | Med: ${medianaRefacao} | P75: ${p75Refacao}`,
      taxaRefacaoVal: tarefasComRefacao.length.toString(),
      taxaRefacaoAbs: `${taxaRefacao}% do total com ao menos 1 refação`
    };
  }, [filteredTasks]);

  const criacaoVsConclusaoData = useMemo(() => {
    const now = new Date();
    const data = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getTime() - (5 - i) * 7 * 24 * 60 * 60 * 1000);
      return { 
        week: i + 1, 
        month: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''), 
        totalC: 0, 
        totalO: 0 
      };
    });
    
    filteredTasks.forEach(t => {
      const cDate = new Date(t.createdAt);
      const cDiff = Math.floor((now.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      if (cDiff >= 0 && cDiff < 6) {
        data[5 - cDiff].totalC += 1;
      }

      if (t.status === 'done' && t.timeTracking?.reachedImplementationAt) {
        const oDate = new Date(t.timeTracking.reachedImplementationAt);
        const oDiff = Math.floor((now.getTime() - oDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        if (oDiff >= 0 && oDiff < 6) {
          data[5 - oDiff].totalO += 1;
        }
      }
    });
    return data;
  }, [filteredTasks]);

  const avgStatusTimeData = useMemo(() => {
    const statuses = [
      { id: 'no_forecast', label: 'Sem Previsão' },
      { id: 'todo', label: 'A Fazer' },
      { id: 'in_progress', label: 'Em Progresso' },
      { id: 'paused', label: 'Pausado' },
      { id: 'approval', label: 'Aprovação' },
      { id: 'rework', label: 'Refação' },
      { id: 'implementation', label: 'Implementação' }
    ];
    const now = new Date().getTime();
    return statuses.map(s => {
      const timesInStatus: number[] = [];
      
      filteredTasks.forEach(t => {
        let totalMsForTask = 0;
        if (t.statusHistory && t.statusHistory.length > 0) {
          t.statusHistory.forEach(h => {
            if (h.status === s.id) {
              const start = new Date(h.enteredAt).getTime();
              const end = h.leftAt ? new Date(h.leftAt).getTime() : now;
              totalMsForTask += (end - start);
            }
          });
        } else if (t.status === s.id) {
          totalMsForTask = now - new Date(t.createdAt).getTime();
        }
        
        if (totalMsForTask > 0) {
          timesInStatus.push(totalMsForTask / (1000 * 60 * 60 * 24));
        }
      });
      
      let mean = 0;
      let median = 0;
      let p75 = 0;
      
      if (timesInStatus.length > 0) {
        timesInStatus.sort((a,b) => a-b);
        mean = timesInStatus.reduce((a,b) => a+b, 0) / timesInStatus.length;
        const mid = Math.floor(timesInStatus.length / 2);
        median = timesInStatus.length % 2 !== 0 ? timesInStatus[mid] : (timesInStatus[mid-1] + timesInStatus[mid]) / 2;
        p75 = timesInStatus[Math.floor(timesInStatus.length * 0.75)];
      }

      return { 
        status: s.label, 
        mean: Number(mean.toFixed(1)), 
        median: Number(median.toFixed(1)), 
        p75: Number(p75.toFixed(1)) 
      };
    });
  }, [filteredTasks]);

  const stalledTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status !== 'done').map(t => {
      const days = Math.floor((new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      let prioLabel = 'Baixa';
      if (t.priority === 'urgent') prioLabel = 'Urgente';
      if (t.priority === 'high') prioLabel = 'Alta';
      if (t.priority === 'medium') prioLabel = 'Média';

      const proj = projects.find(p => p.id === t.projectId)?.name || 'Sem Projeto';

      let assignedName = t.assigneeId || 'Não atribuído';
      if (t.assigneeId) {
        const uObj = allUsers.find(u => u.id === t.assigneeId);
        if (uObj && uObj.name) {
          assignedName = uObj.name;
        } else {
          const prefix = t.assigneeId.substring(0, 8);
          assignedName = manualMap[prefix] || t.assigneeId;
        }
      }

      return {
        id: t.id,
        title: t.title,
        project: proj,
        user: assignedName,
        prio: prioLabel,
        days: days
      };
    }).filter(t => (t.prio === 'Urgente' && t.days > 14) || (t.prio !== 'Urgente' && t.days > 25))
      .sort((a,b) => b.days - a.days);
  }, [filteredTasks, projects]);

  return (
    <div className="space-y-[32px] animate-fade-in w-full">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <MetricCard title="Entregas" value={metrics.entregas} suffix="tarefas" delta="+0%" trend="up" tooltip="Tarefas entregues no período, com comparativo ao período anterior." />
        <MetricCard title="Entregas no Prazo" value={metrics.entregasNoPrazoVal} suffix="tarefas" absolute={metrics.entregasNoPrazoAbs} delta="+0%" trend="up" tooltip="Das tarefas que tinham prazo no período, a quantidade entregue no prazo." />
        <MetricCard title="Tempo de Ciclo (Execução)" value={metrics.avgCycleTime} suffix="dias" absolute="Média de execução" delta="-0.0" trend="down" goodTrend="down" tooltip="Tempo decorrido enquanto ativamente trabalhando (acumulado no timer)." />
        <MetricCard title="Tempo de Ciclo (Total)" value={metrics.avgLeadTime} suffix="dias" absolute="Média (Lead Time)" delta="-0.0" trend="down" goodTrend="down" tooltip="Lead Time: de 'Criado' até 'Concluído'." />
        <MetricCard title="Taxa de Atraso" value={metrics.atrasoVal} suffix="tarefas" absolute={metrics.atrasoAbs} delta="+0%" trend="up" goodTrend="down" tooltip="Quantidade de tarefas abertas que já passaram do prazo agora." />
        <MetricCard title="Taxa de Aprovação Direta" value={metrics.aprovacaoDiretaVal} suffix="tarefas" absolute={metrics.aprovacaoDiretaAbs} delta="+0%" trend="up" goodTrend="up" tooltip="Quantidade de tarefas aprovadas sem voltar para refação." />
        <MetricCard title="Criação vs Conclusão" value={metrics.criacaoVsConclusaoVal} suffix="razão" absolute={metrics.criacaoVsConclusaoAbs} delta="0.0" trend="up" goodTrend="down" tooltip="Proporção entre tarefas criadas e concluídas (ideal < 1.0)." />
        <MetricCard title="Ciclos de Refação" value={metrics.ciclosRefacaoVal} suffix="ciclos/tarefa" absolute={metrics.ciclosRefacaoAbs} delta="0.0" trend="down" goodTrend="down" tooltip="Média de vezes que uma tarefa vai para refação até ser aprovada para implementação." />
        <MetricCard title="Taxa de Refação" value={metrics.taxaRefacaoVal} suffix="tarefas" absolute={metrics.taxaRefacaoAbs} delta="0%" trend="down" goodTrend="down" tooltip="Quantidade de tarefas que foram para 'Refação' pelo menos 1 vez." />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Stacked Bar Chart: Criação vs Conclusão */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-white uppercase tracking-[0.15em] flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              Criação vs Conclusão
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-normal text-[#525252] tracking-[0.02em]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-600"></span> Criadas</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500"></span> Concluídas</div>
            </div>
          </div>

          <div className="h-[400px] flex items-center justify-center relative">
            {/* Futuristic Background */}
            <div className="absolute inset-0 pointer-events-none z-0" style={{ 
              backgroundImage: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.08) 0%, transparent 70%)'
            }}></div>
            
            <div className="relative flex items-center justify-center z-10 w-full h-full">
              {(() => {
                const criadas = metrics.criadasTotais;
                const concluidas = metrics.entregasTotais;
                const total = criadas + concluidas || 1;
                const radius = 100;
                const circumference = 2 * Math.PI * radius;
                const criadasDash = (criadas / total) * circumference;
                const concluidasDash = (concluidas / total) * circumference;

                return (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <svg width="100%" height="100%" viewBox="0 0 340 340" className="max-w-[340px]">
                      <g transform="rotate(90 170 170)">
                        <circle cx="170" cy="170" r="100" fill="transparent" stroke="#18181b" strokeWidth="40" />
                        
                        {/* Criadas slice */}
                        <circle cx="170" cy="170" r="100" fill="transparent" stroke="#52525b" strokeWidth="40"
                          strokeDasharray={`${criadasDash} ${circumference}`}
                          strokeDashoffset={0} 
                          className="transition-all duration-1000"
                        />

                        {/* Concluídas slice */}
                        <circle cx="170" cy="170" r="100" fill="transparent" stroke="#3b82f6" strokeWidth="40"
                          strokeDasharray={`${concluidasDash} ${circumference}`}
                          strokeDashoffset={-criadasDash} 
                          className="drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000"
                        />
                      </g>

                      {/* Labels and Lines (unrotated) */}
                      {(() => {
                        const getCoords = (percent: number, radius: number) => {
                           const angleRad = percent * 2 * Math.PI;
                           return {
                             x: 170 - radius * Math.sin(angleRad),
                             y: 170 + radius * Math.cos(angleRad)
                           };
                        };

                        const criadasMidPercent = total > 0 ? (criadas / total) / 2 : 0;
                        const concluidasMidPercent = total > 0 ? (criadas / total) + (concluidas / total) / 2 : 0;

                        const c1 = getCoords(criadasMidPercent, 110);
                        const l1 = getCoords(criadasMidPercent, 135);
                        const textAnchor1 = 'end';
                        
                        const c2 = getCoords(concluidasMidPercent, 110);
                        const l2 = getCoords(concluidasMidPercent, 135);
                        const textAnchor2 = 'start';

                        return (
                          <>
                            {criadas > 0 && (
                              <g>
                                <polyline points={`${c1.x},${c1.y} ${l1.x},${l1.y} ${l1.x - 10},${l1.y}`} fill="none" stroke="#52525b" strokeWidth="1.5" />
                                <text x={l1.x - 15} y={l1.y - 4} fill="#a1a1aa" fontSize="11" fontWeight="bold" textAnchor={textAnchor1}>CRIADAS ({criadas})</text>
                                <text x={l1.x - 15} y={l1.y + 10} fill="#71717a" fontSize="10" textAnchor={textAnchor1}>No período</text>
                              </g>
                            )}
                            {concluidas > 0 && (
                              <g>
                                <polyline points={`${c2.x},${c2.y} ${l2.x},${l2.y} ${l2.x + 10},${l2.y}`} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                                <text x={l2.x + 15} y={l2.y - 4} fill="#60a5fa" fontSize="11" fontWeight="bold" textAnchor={textAnchor2}>CONCLUÍDAS ({concluidas})</text>
                                <text x={l2.x + 15} y={l2.y + 10} fill="#3b82f6" fontSize="10" textAnchor={textAnchor2}>No período</text>
                              </g>
                            )}
                          </>
                        );
                      })()}
                    </svg>
                    
                    {/* Inner Text */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-bold text-zinc-100">{metrics.criacaoVsConclusaoVal}x</span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold mt-1 max-w-[80px] leading-tight">Razão<br/>(Cri/Con)</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Line Chart: Tempo Médio por Status ao longo do tempo */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-white uppercase tracking-[0.15em] flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Mediana por Status
            </h3>
          </div>

          <div className="min-h-[400px] flex flex-col justify-between pt-4">
            <div className="flex-1 flex flex-col gap-4 border-b border-zinc-800 pb-4 relative z-10">
              {/* Background grid lines for X axis */}
              <div className="absolute inset-y-0 left-0 right-0 flex justify-between pointer-events-none z-0">
                <div className="w-px h-full border-l border-zinc-500" style={{ opacity: 0.08 }}></div>
                <div className="w-px h-full border-l border-zinc-500" style={{ opacity: 0.08 }}></div>
                <div className="w-px h-full border-l border-zinc-500" style={{ opacity: 0.08 }}></div>
                <div className="w-px h-full border-l border-zinc-500" style={{ opacity: 0.08 }}></div>
                <div className="w-px h-full border-l border-zinc-500" style={{ opacity: 0.08 }}></div>
                <div className="w-px h-full border-l border-zinc-500" style={{ opacity: 0.08 }}></div>
              </div>

              {avgStatusTimeData.map(item => {
                const maxDays = Math.max(10, ...avgStatusTimeData.map(d => d.median));
                const medianPct = Math.max(0.5, (item.median / maxDays) * 100);

                let bgClass = 'bg-gradient-to-r from-indigo-500 to-indigo-400';
                let shadowClass = 'shadow-[0_0_8px_rgba(99,102,241,0.3)]';

                return (
                  <div key={item.status} className="flex flex-col w-full gap-1 mb-2 relative z-10 group">
                    <div className="text-[10px] text-zinc-300 font-bold uppercase tracking-[0.2em] z-20">
                      {item.status}
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <div className="flex-1 h-3 bg-[rgba(255,255,255,0.02)] relative rounded-r overflow-hidden">
                          <div className={`h-full ${bgClass} ${shadowClass} transition-all duration-500 group-hover:brightness-125`} style={{ width: `${medianPct}%` }}></div>
                       </div>
                       <span className="w-6 text-[10px] text-zinc-400 text-left font-mono group-hover:text-zinc-200 transition-colors">{item.median}d</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X Axis Labels */}
            <div className="flex justify-between text-[10px] text-zinc-500/70 font-mono mt-2 ml-0 mr-8">
              <span>0d</span>
              <span>2d</span>
              <span>4d</span>
              <span>6d</span>
              <span>8d</span>
              <span>10d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Saúde do Fluxo */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-[0.1em]">Saúde do Fluxo</h3>
          <span className="px-1.5 py-0.5 bg-zinc-800/80 text-zinc-400 rounded text-[10px] font-medium">{stalledTasks.length}</span>
        </div>

        <div className="border border-zinc-800/60 rounded-xl overflow-hidden bg-[#09090b]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/60 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-transparent">
                <th className="py-2 px-4 pl-5">Título</th>
                <th className="py-2 px-4">Empreendimento</th>
                <th className="py-2 px-4">Prioridade</th>
                <th className="py-2 px-4">Dias Parada</th>
                <th className="py-2 px-4">Responsável</th>
                <th className="py-2 px-4 pr-5 text-right">Lembrete</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stalledTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                    Nenhuma tarefa antiga parada com esses critérios.
                  </td>
                </tr>
              ) : stalledTasks.map((t, i) => (
                <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors group">
                  <td className="py-2.5 px-4 pl-5">
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={t.prio === 'Urgente' ? 'text-red-500' : 'text-blue-500'}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
                      <span className="font-medium text-zinc-200 text-[13px]">{t.title}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                      <span className="text-zinc-300 text-[13px] font-medium">{t.project}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                      t.prio === 'Urgente' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      t.prio === 'Alta' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {t.prio}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      <span className={`text-[12px] font-mono font-medium ${t.days > 25 || (t.prio === 'Urgente' && t.days > 14) ? 'text-red-400' : 'text-zinc-400'}`}>
                        {t.days} dias
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.user)}&background=27272a&color=a1a1aa&size=128`} alt={t.user} className="w-5 h-5 rounded-full" />
                      <span className="text-[13px] text-zinc-300 font-medium">{t.user}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 pr-5 text-right">
                    <div className="flex justify-end">
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-400 text-[11px] font-medium hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                        Adicionar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, suffix, absolute, delta, trend, goodTrend = 'up', tooltip, alertColor }: { title: string, value: string, suffix: string, absolute?: string, delta: string, trend: 'up' | 'down', goodTrend?: 'up' | 'down', tooltip?: string, alertColor?: string }) {
  const isPositive = trend === goodTrend;
  const deltaColor = isPositive ? 'text-green-500 bg-[rgba(34,197,94,0.08)]' : 'text-red-500 bg-[rgba(239,68,68,0.08)]';
  const deltaIcon = trend === 'up' ? '↑' : '↓';
  const cleanDelta = delta.replace('+', '').replace('-', '');

  return (
    <div
      className="bg-gradient-to-br from-[rgba(255,255,255,0.06)] to-[rgba(255,255,255,0.01)] hover:from-[rgba(255,255,255,0.09)] hover:to-[rgba(255,255,255,0.03)] hover:z-50 backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-xl p-4 relative overflow-visible transition-all h-full flex flex-col group shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
      style={{ borderLeftColor: alertColor || 'rgba(255,255,255,0.08)', borderLeftWidth: alertColor ? '2px' : '1px' }}
    >
      <div className="flex items-center justify-between mb-3 relative z-50">
        <div className="relative flex items-center group">
          <h3 className="text-[10px] font-medium text-[#8b949e] uppercase tracking-[0.1em] cursor-default leading-tight">{title}</h3>
          {tooltip && (
            <div className="absolute top-1/2 left-full -translate-y-1/2 ml-3 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a3a3a3] text-[10px] p-2.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] w-48 text-left leading-relaxed">
              {tooltip}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className="text-4xl font-bold text-zinc-100 tracking-[-0.02em] leading-none">{value}</span>
        <span className="text-sm font-normal text-[#737373]">{suffix}</span>
      </div>
      {absolute && (
        <div className="text-xs text-[#525252] font-medium tracking-[0.02em] mb-3">{absolute}</div>
      )}
      {!absolute && <div className="mb-3 h-4"></div>}
      <div className="flex items-center gap-1.5 mt-auto relative z-10">
        <div className={`px-2 py-0.5 rounded-full text-xs font-medium tracking-[0.02em] ${deltaColor}`}>
          {deltaIcon} {cleanDelta}
        </div>
        <span className="text-xs text-[#525252] font-medium tracking-[0.02em]">vs. ant.</span>
      </div>
    </div>
  );
}
