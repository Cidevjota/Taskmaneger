import React, { useState } from 'react';
import { FolderPlus, Flame, Folder, Calendar, Plus, ChevronRight, PieChart, SquarePlay, Layers, Edit2 } from 'lucide-react';
import { Project, Task } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  onSelectProjectFilter: (projectId: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
}

export default function ProjectsView({
  projects,
  tasks,
  onSelectProjectFilter,
  onAddProject,
  onUpdateProject
}: ProjectsViewProps) {
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Colors array to allocate to new projects
  const availableColors = [
    'text-blue-400',
    'text-rose-400',
    'text-amber-400',
    'text-emerald-400',
    'text-sky-400',
    'text-pink-400'
  ];

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    if (editingProjectId) {
      const existing = projects.find(p => p.id === editingProjectId);
      if (existing) {
        onUpdateProject({
          ...existing,
          name: newProjName.trim(),
          description: newProjDesc.trim() || 'Sem descrição cadastrada.',
        });
      }
    } else {
      const newProj: Project = {
        id: `p-${Date.now()}`,
        name: newProjName.trim(),
        description: newProjDesc.trim() || 'Sem descrição cadastrada.',
        color: availableColors[Math.floor(Math.random() * availableColors.length)],
        status: 'active'
      };
      onAddProject(newProj);
    }

    setNewProjName('');
    setNewProjDesc('');
    setShowAddForm(false);
    setEditingProjectId(null);
  };

  const handleEditClick = (project: Project) => {
    setEditingProjectId(project.id);
    setNewProjName(project.name);
    setNewProjDesc(project.description);
    setShowAddForm(true);
    // Scroll to top where form is
    const container = document.querySelector('.overflow-y-auto');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingProjectId(null);
    setNewProjName('');
    setNewProjDesc('');
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto select-none space-y-6 bg-[#08080a]">
      
      {/* Projects Title Banner */}
      <div className="flex items-center justify-between bg-zinc-950/50 p-4 rounded-lg border border-zinc-900">
        <div className="flex items-center gap-2">
          <PieChart size={14} className="text-zinc-400" />
          <h2 className="text-xs font-semibold text-zinc-350 uppercase tracking-widest font-mono">Workspace Empreendimentos</h2>
          <span className="text-[9px] bg-zinc-900 text-zinc-500 py-0.5 px-2 rounded-full font-mono font-medium border border-zinc-800">
            {projects.length} Total
          </span>
        </div>

        <button
          onClick={() => {
            if (showAddForm && !editingProjectId) {
              handleCancelForm();
            } else {
              setEditingProjectId(null);
              setNewProjName('');
              setNewProjDesc('');
              setShowAddForm(true);
            }
          }}
          className="h-8 flex items-center gap-1.5 px-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-100 rounded text-xs font-semibold border border-zinc-700/50 transition-all shadow-sm"
        >
          <FolderPlus size={12} />
          <span>Novo Empreendimento</span>
        </button>
      </div>

      {/* Add Project collapsible Inline Form */}
      {showAddForm && (
        <form 
          onSubmit={handleCreateProject}
          className="bg-zinc-950 p-4 rounded-lg border border-zinc-900 space-y-3 animate-fade-in max-w-lg"
        >
          <h3 className="text-[10px] font-bold font-mono uppercase text-zinc-400">
            {editingProjectId ? 'Editar Empreendimento' : 'Criar Novo Empreendimento'}
          </h3>
          <div>
            <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">Nome</label>
            <input
              type="text"
              required
              placeholder="Ex. Portal de Onboarding..."
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              className="w-full bg-[#08080a] border border-zinc-900 p-2 text-xs rounded text-zinc-200 outline-none focus:border-zinc-750"
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">Descrição</label>
            <textarea
              placeholder="Ex. Tarefas de landing e sincronização..."
              rows={2}
              value={newProjDesc}
              onChange={(e) => setNewProjDesc(e.target.value)}
              className="w-full bg-[#08080a] border border-zinc-900 p-2 text-xs rounded text-zinc-200 outline-none focus:border-zinc-750 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-semibold border border-zinc-700/40"
            >
              Confirmar
            </button>
          </div>
        </form>
      )}

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(project => {
          const projectTasks = tasks.filter(t => t.projectId === project.id);
          const totalTasks = projectTasks.length;
          const completedTasks = projectTasks.filter(t => t.status === 'done').length;
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          
          return (
            <div
              key={project.id}
              className="bg-transparent border border-zinc-900/80 hover:border-zinc-700/60 hover:bg-zinc-900/10 p-5 rounded-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              onClick={() => onSelectProjectFilter(project.id)}
            >
              <div>
                {/* Header title */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-zinc-100 truncate max-w-[150px]" title={project.name}>
                      {project.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(project); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-zinc-300 transition-opacity"
                      title="Editar"
                    >
                      <Edit2 size={11} />
                    </button>
                    <span className="text-[10px] text-zinc-600 uppercase font-bold font-mono tracking-wider">
                      {project.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[12px] text-zinc-500 leading-relaxed min-h-[36px] mb-5">
                  {project.description}
                </p>

                {/* Meter progress metrics */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{completedTasks}/{totalTasks} Concluídas</span>
                    <span className="text-zinc-400">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-[1px] bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300 bg-zinc-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Linked task IDs preview */}
                <div className="space-y-2 shrink-0">
                  {projectTasks.length === 0 ? (
                    <div className="text-[11px] text-zinc-600">Nenhuma tarefa.</div>
                  ) : (
                    projectTasks.slice(0, 2).map(t => (
                      <div key={t.id} className="flex items-start gap-2 text-[12px] text-zinc-400">
                        <span className="text-[9px] font-mono text-zinc-600 font-medium w-10 mt-0.5 shrink-0">{t.id}</span>
                        <span className={`truncate w-full ${t.status === 'done' ? 'line-through text-zinc-600' : ''}`}>{t.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Enter/Explore Link */}
              <div
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium mt-6 group-hover:text-zinc-300 transition-colors w-fit"
              >
                <span>Explorar</span>
                <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
