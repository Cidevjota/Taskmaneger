import React, { useState, useMemo } from 'react';
import { Project, Task, Label } from '../types';
import { Filter } from 'lucide-react';
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
    <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0A] text-[#EDEDED]">

      {/* Top Filter Bar */}
      <div className="min-h-14 short:min-h-11 border-b border-[#1F1F22] view-pad-x py-2 flex items-center flex-wrap gap-2 shrink-0 bg-[#0A0A0A]">
        <div className="flex items-center gap-2 text-[#6B6B70] mr-3">
          <Filter size={13} strokeWidth={1.75} />
          <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Filtros</span>
        </div>

        <FilterSelect value={period} options={periodOptions} onChange={setPeriod} />
        <FilterSelect value={member} options={memberOptions} onChange={setMember} renderOption={renderMemberOption} />
        <FilterSelect value={project} options={projectOptions} onChange={setProject} />
        <FilterSelect value={taskClass} options={classOptions} onChange={setTaskClass} renderOption={renderClassOption} />
        <FilterSelect value={priority} options={priorityOptions} onChange={setPriority} renderOption={renderPriorityOption} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto view-pad scrollbar-thin">
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
function FilterSelect({ value, options, onChange, renderOption }: { value: string, options: string[], onChange: (val: string) => void, renderOption?: (val: string) => React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1C] rounded-md text-xs font-normal text-[#A0A0A5] hover:bg-[#1F1F22] hover:text-[#EDEDED] transition-colors"
      >
        {renderOption ? renderOption(value) : value}
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 ml-0.5"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] max-w-[240px] max-h-[300px] overflow-y-auto bg-[#111113] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-[100] py-1 custom-scrollbar">
          {options.map((opt, i) => (
            <button
              key={i}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1A1A1C] transition-colors truncate ${value === opt ? 'text-[#EDEDED]' : 'text-[#6B6B70]'}`}
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

    const cutoffDate = cutoffDays > 0
      ? new Date(new Date().getTime() - (cutoffDays * 24 * 60 * 60 * 1000))
      : new Date(0);

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
    <div className="flex flex-col gap-10 short:gap-5 animate-fade-in w-full">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 view-gap">
        <MetricCard title="Entregas" value={metrics.entregas} suffix="tarefas" delta="+0%" trend="up" tooltip="Tarefas entregues no período, com comparativo ao período anterior." />
        <MetricCard title="Entregas no Prazo" value={metrics.entregasNoPrazoVal} suffix="tarefas" delta="+0%" trend="up" tooltip={metrics.entregasNoPrazoAbs} featured />
        <MetricCard title="Tempo de Ciclo (Execução)" value={metrics.avgCycleTime} suffix="dias" delta="-0.0" trend="down" goodTrend="down" tooltip="Tempo decorrido enquanto ativamente trabalhando (acumulado no timer)." />
        <MetricCard title="Tempo de Ciclo (Total)" value={metrics.avgLeadTime} suffix="dias" delta="-0.0" trend="down" goodTrend="down" tooltip="Lead Time: de 'Criado' até 'Concluído'." />
        <MetricCard title="Taxa de Atraso" value={metrics.atrasoVal} suffix="tarefas" delta="+0%" trend="up" goodTrend="down" tooltip={metrics.atrasoAbs} />
        <MetricCard title="Taxa de Aprovação Direta" value={metrics.aprovacaoDiretaVal} suffix="tarefas" delta="+0%" trend="up" goodTrend="up" tooltip={metrics.aprovacaoDiretaAbs} />
        <MetricCard title="Criação vs Conclusão" value={metrics.criacaoVsConclusaoVal} suffix="razão" delta="0.0" trend="up" goodTrend="down" tooltip={metrics.criacaoVsConclusaoAbs} />
        <MetricCard title="Ciclos de Refação" value={metrics.ciclosRefacaoVal} suffix="ciclos/tarefa" delta="0.0" trend="down" goodTrend="down" tooltip={metrics.ciclosRefacaoAbs} />
        <MetricCard title="Taxa de Refação" value={metrics.taxaRefacaoVal} suffix="tarefas" delta="0%" trend="down" goodTrend="down" tooltip={metrics.taxaRefacaoAbs} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 view-gap">
        {/* Donut: Criação vs Conclusão */}
        <div className="bg-[#111113] rounded-lg card-pad">
          <div className="flex items-center justify-between mb-6 short:mb-3">
            <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Criação vs Conclusão</h3>
            <div className="flex items-center gap-3 text-[11px] font-normal text-[#6B6B70]">
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#5E6AD2] opacity-30"></span> Criadas</div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#5E6AD2]"></span> Concluídas</div>
            </div>
          </div>

          <div className="h-[340px] short:h-[240px] flex items-center justify-center relative">
            {(() => {
              const criadas = metrics.criadasTotais;
              const concluidas = metrics.entregasTotais;
              const total = criadas + concluidas || 1;
              const radius = 120;
              const circumference = 2 * Math.PI * radius;
              const criadasDash = (criadas / total) * circumference;
              const concluidasDash = (concluidas / total) * circumference;
              const gap = 2;

              return (
                <div className="relative flex items-center justify-center w-full h-full">
                  <svg width="100%" height="100%" viewBox="0 0 300 300" className="max-w-[300px]">
                    <g transform="rotate(-90 150 150)">
                      <circle cx="150" cy="150" r={radius} fill="transparent" stroke="#5E6AD2" strokeOpacity="0.18" strokeWidth="14"
                        strokeDasharray={`${Math.max(0, criadasDash - gap)} ${circumference}`}
                        strokeDashoffset={0}
                        strokeLinecap="round"
                      />
                      <circle cx="150" cy="150" r={radius} fill="transparent" stroke="#5E6AD2" strokeWidth="14"
                        strokeDasharray={`${Math.max(0, concluidasDash - gap)} ${circumference}`}
                        strokeDashoffset={-criadasDash}
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>

                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-5xl short:text-4xl font-extralight text-[#EDEDED] tracking-[-0.02em]">{metrics.criacaoVsConclusaoVal}<span className="text-2xl text-[#6B6B70]">x</span></span>
                    <span className="text-[11px] text-[#6B6B70] uppercase tracking-[0.05em] mt-2">Razão criação/conclusão</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Bars: Mediana por Status */}
        <div className="bg-[#111113] rounded-lg card-pad">
          <div className="mb-6 short:mb-3">
            <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Mediana por Status</h3>
          </div>

          <div className="flex flex-col justify-between">
            <div className="flex flex-col gap-5 relative">
              {(() => {
                const maxDays = Math.max(10, ...avgStatusTimeData.map(d => d.median));
                const sortedDesc = [...avgStatusTimeData].map(d => d.median).sort((a, b) => b - a);

                return avgStatusTimeData.map(item => {
                  const medianPct = Math.max(0.5, (item.median / maxDays) * 100);
                  const rank = sortedDesc.indexOf(item.median);
                  const opacity = Math.max(0.35, 1 - rank * 0.12);

                  return (
                    <div key={item.status} className="flex flex-col w-full gap-1.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-[#6B6B70] uppercase tracking-[0.05em]">{item.status}</span>
                        <span className="text-[11px] text-[#A0A0A5] font-normal">{item.median}d</span>
                      </div>
                      <div className="w-full h-[5px] bg-[#1A1A1C] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#5E6AD2] transition-all duration-500" style={{ width: `${medianPct}%`, opacity }}></div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="border-t border-dashed border-[#1F1F22] mt-6 pt-2 flex justify-between text-[10px] text-[#6B6B70]">
              <span>0d</span>
              <span>{Math.round(Math.max(10, ...avgStatusTimeData.map(d => d.median)))}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Saúde do Fluxo */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Saúde do Fluxo</h3>
          <span className="text-[11px] text-[#6B6B70]">{stalledTasks.length}</span>
        </div>

        <div className="bg-[#111113] rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F1F22] text-[11px] font-medium uppercase tracking-[0.05em] text-[#6B6B70]">
                <th className="py-3 px-4 pl-5 font-medium">Título</th>
                <th className="py-3 px-4 font-medium">Empreendimento</th>
                <th className="py-3 px-4 font-medium">Prioridade</th>
                <th className="py-3 px-4 font-medium">Dias Parada</th>
                <th className="py-3 px-4 font-medium">Responsável</th>
                <th className="py-3 px-4 pr-5 text-right font-medium">Lembrete</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stalledTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6B6B70] text-xs">
                    Nenhuma tarefa antiga parada com esses critérios.
                  </td>
                </tr>
              ) : stalledTasks.map((t, i) => (
                <tr key={i} className="border-b border-[#1F1F22] last:border-b-0 hover:bg-[#151519] transition-colors">
                  <td className="py-3 px-4 pl-5">
                    <span className="font-normal text-[#EDEDED] text-[13px]">{t.title}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[#A0A0A5] text-[13px] font-normal">{t.project}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-normal ${
                      t.prio === 'Urgente' ? 'text-[#F85149]' :
                      t.prio === 'Alta' ? 'text-[#5E6AD2]' :
                      'text-[#6B6B70]'
                    }`}>
                      {t.prio}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[12px] font-normal ${t.days > 25 || (t.prio === 'Urgente' && t.days > 14) ? 'text-[#F85149]' : 'text-[#A0A0A5]'}`}>
                      {t.days} dias
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.user)}&background=1A1A1C&color=A0A0A5&size=128`} alt={t.user} className="w-5 h-5 rounded-full" />
                      <span className="text-[13px] text-[#A0A0A5] font-normal">{t.user}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 pr-5 text-right">
                    <div className="flex justify-end">
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1A1A1C] text-[#A0A0A5] text-[11px] font-normal hover:bg-[#1F1F22] hover:text-[#EDEDED] transition-colors">
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

function MetricCard({ title, value, suffix, delta, trend, goodTrend = 'up', tooltip, featured }: { title: string, value: string, suffix: string, delta: string, trend: 'up' | 'down', goodTrend?: 'up' | 'down', tooltip?: string, featured?: boolean }) {
  const isPositive = trend === goodTrend;
  const deltaColor = isPositive ? 'text-[#3FB950]' : 'text-[#F85149]';
  const deltaIcon = trend === 'up' ? '↑' : '↓';
  const cleanDelta = delta.replace('+', '').replace('-', '');

  return (
    <div className={`rounded-lg p-5 relative flex flex-col group ${featured ? 'bg-[#151519]' : 'bg-[#111113]'}`}>
      <div className="relative flex items-center mb-3">
        <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em] cursor-default leading-tight">{title}</h3>
        {tooltip && (
          <div className="absolute top-1/2 left-full -translate-y-1/2 ml-3 bg-[#1A1A1C] text-[#A0A0A5] text-[11px] p-2.5 rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] w-48 text-left leading-relaxed">
            {tooltip}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className={`font-extralight text-[#EDEDED] tracking-[-0.02em] leading-none ${featured ? 'text-5xl' : 'text-4xl'}`}>{value}</span>
        <span className="text-sm font-normal text-[#6B6B70]">{suffix}</span>
      </div>
      <div className={`flex items-center gap-1 mt-auto text-xs font-medium tracking-[0.02em] ${deltaColor}`}>
        <span>{deltaIcon}</span>
        <span>{cleanDelta}</span>
      </div>
    </div>
  );
}
