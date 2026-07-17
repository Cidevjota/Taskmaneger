import React, { useEffect, useState } from 'react';
import { X, History as HistoryIcon, Loader2 } from 'lucide-react';
import { TaskHistoryEntry, Project } from '../types';
import { fetchTaskHistory } from '../lib/api';

interface TaskHistoryPanelProps {
  taskId: string;
  taskCode?: string;
  projects: Project[];
  users: { id: string; name: string }[];
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  status: 'Status',
  priority: 'Prioridade',
  project_id: 'Projeto',
  due_date: 'Prazo',
  assignee_id: 'Responsável',
  planned_date: 'Data planejada',
  reminder_date: 'Lembrete',
  parent_task_id: 'Tarefa pai',
  description: 'Descrição',
  design_briefing: 'Briefing de design',
  copy_briefing: 'Briefing de copy',
  planning_briefing: 'Briefing de planejamento',
  chat_messages: 'Chat',
  attachments: 'Anexos',
  proposals: 'Propostas',
  social_media_approval: 'Aprovação de social media',
  time_tracking: 'Tempo registrado',
};

const STATUS_LABELS: Record<string, string> = {
  no_forecast: 'Sem previsão',
  todo: 'A fazer',
  in_progress: 'Em progresso',
  paused: 'Pausado',
  approval: 'Aprovação',
  rework: 'Refação',
  implementation: 'Implementação',
  done: 'Concluído',
};

const PRIORITY_LABELS: Record<string, string> = {
  no_priority: 'Sem Prioridade',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

// Fields whose old/new value is not stored (large jsonb content) — only the fact that it changed is shown.
const CONTENT_ONLY_FIELDS = new Set([
  'design_briefing', 'copy_briefing', 'planning_briefing', 'chat_messages',
  'attachments', 'proposals', 'social_media_approval', 'time_tracking',
]);

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `há ${diffD}d`;
  return date.toLocaleDateString('pt-BR');
}

export default function TaskHistoryPanel({ taskId, taskCode, projects, users, onClose }: TaskHistoryPanelProps) {
  const [entries, setEntries] = useState<TaskHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchTaskHistory(taskId)
      .then(data => { if (!cancelled) setEntries(data); })
      .catch(err => { if (!cancelled) setError(err.message || 'Erro ao carregar histórico.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const userName = (id: string | null) => {
    if (!id) return 'Sistema';
    return users.find(u => u.id === id)?.name || id;
  };

  const projectName = (id: string | null) => {
    if (!id) return '—';
    return projects.find(p => p.id === id)?.name || id;
  };

  const formatValue = (field: string, value: string | null): string => {
    if (value === null || value === undefined || value === '') return '—';
    switch (field) {
      case 'status':
        return STATUS_LABELS[value] || value;
      case 'priority':
        return PRIORITY_LABELS[value] || value;
      case 'project_id':
        return projectName(value);
      case 'assignee_id':
      case 'parent_task_id':
        return userName(value) !== value ? userName(value) : value;
      default:
        return value.length > 80 ? `${value.slice(0, 80)}…` : value;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" onMouseDown={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[61] w-full md:w-[420px] bg-[#0c0c0e] border-l border-zinc-900 shadow-2xl flex flex-col animate-slide-in text-zinc-200">
        <div className="h-14 px-4 border-b border-zinc-900 flex items-center justify-between shrink-0 bg-[#08080a]">
          <div className="flex items-center gap-2">
            <HistoryIcon size={15} className="text-zinc-500" />
            <span className="text-sm font-semibold text-zinc-200">Histórico</span>
            {taskCode && <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded font-mono text-zinc-500">{taskCode}</span>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 rounded transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-zinc-500 gap-2 text-xs">
              <Loader2 size={14} className="animate-spin" /> Carregando...
            </div>
          )}

          {!isLoading && error && (
            <div className="text-xs text-red-400 py-4">{error}</div>
          )}

          {!isLoading && !error && entries.length === 0 && (
            <div className="text-xs text-zinc-600 py-4 text-center">Nenhuma alteração registrada ainda.</div>
          )}

          {!isLoading && !error && entries.length > 0 && (
            <div className="flex flex-col gap-2">
              {entries.map(entry => (
                <div key={entry.id} className="border border-zinc-900 rounded-md px-3 py-2.5 bg-[#111113]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-300">{FIELD_LABELS[entry.field] || entry.field}</span>
                    <span className="text-[10px] text-zinc-600" title={new Date(entry.changedAt).toLocaleString('pt-BR')}>
                      {formatRelativeTime(entry.changedAt)}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-1">{userName(entry.changedBy)}</div>
                  {CONTENT_ONLY_FIELDS.has(entry.field) ? (
                    <div className="text-xs text-zinc-400">Conteúdo atualizado</div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <span className="text-zinc-500 line-through decoration-zinc-700">{formatValue(entry.field, entry.oldValue)}</span>
                      <span className="text-zinc-600">→</span>
                      <span className="text-zinc-200">{formatValue(entry.field, entry.newValue)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
