import React, { useState } from 'react';
import { FolderPlus, Image as ImageIcon, Megaphone, Tag, History, Copy, Check, ChevronRight, PieChart, Edit2, Building2 } from 'lucide-react';
import { Project, Task } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  onSelectProjectFilter: (projectId: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
}

const QUICK_SECTIONS = [
  { label: 'Imagens, Fotos e Vídeos', icon: ImageIcon },
  { label: 'Material de Marketing', icon: Megaphone },
  { label: 'Tabela de Preços', icon: Tag },
  { label: 'Linha do tempo', icon: History },
];

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Ativo',
  completed: 'Concluído',
  on_hold: 'Pausado',
};

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
      title="Copiar código"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
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
  const [newProjCode, setNewProjCode] = useState('');
  const [newProjCoverImage, setNewProjCoverImage] = useState('');
  const [newProjBuildProgress, setNewProjBuildProgress] = useState(0);
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
          code: newProjCode.trim() || null,
          coverImage: newProjCoverImage.trim() || null,
          buildProgress: newProjBuildProgress,
        });
      }
    } else {
      const newProj: Project = {
        id: `p-${Date.now()}`,
        name: newProjName.trim(),
        description: newProjDesc.trim() || 'Sem descrição cadastrada.',
        color: availableColors[Math.floor(Math.random() * availableColors.length)],
        status: 'active',
        code: newProjCode.trim() || null,
        coverImage: newProjCoverImage.trim() || null,
        buildProgress: newProjBuildProgress,
      };
      onAddProject(newProj);
    }

    setNewProjName('');
    setNewProjDesc('');
    setNewProjCode('');
    setNewProjCoverImage('');
    setNewProjBuildProgress(0);
    setShowAddForm(false);
    setEditingProjectId(null);
  };

  const handleEditClick = (project: Project) => {
    setEditingProjectId(project.id);
    setNewProjName(project.name);
    setNewProjDesc(project.description);
    setNewProjCode(project.code || '');
    setNewProjCoverImage(project.coverImage || '');
    setNewProjBuildProgress(project.buildProgress || 0);
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
    setNewProjCode('');
    setNewProjCoverImage('');
    setNewProjBuildProgress(0);
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
              setNewProjCode('');
              setNewProjCoverImage('');
              setNewProjBuildProgress(0);
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">Nome</label>
              <input
                type="text"
                required
                placeholder="Ex. Green Park..."
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                className="w-full bg-[#08080a] border border-zinc-900 p-2 text-xs rounded text-zinc-200 outline-none focus:border-zinc-750"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">Código / Matrícula</label>
              <input
                type="text"
                placeholder="Ex. 34.0001.2589..."
                value={newProjCode}
                onChange={(e) => setNewProjCode(e.target.value)}
                className="w-full bg-[#08080a] border border-zinc-900 p-2 text-xs rounded text-zinc-200 outline-none focus:border-zinc-750 font-mono"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">Evolução da Obra ({newProjBuildProgress}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={newProjBuildProgress}
                onChange={(e) => setNewProjBuildProgress(Number(e.target.value))}
                className="w-full accent-zinc-400 mt-2.5"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">URL da Imagem de Capa</label>
              <input
                type="text"
                placeholder="https://..."
                value={newProjCoverImage}
                onChange={(e) => setNewProjCoverImage(e.target.value)}
                className="w-full bg-[#08080a] border border-zinc-900 p-2 text-xs rounded text-zinc-200 outline-none focus:border-zinc-750"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] text-zinc-550 font-bold uppercase block mb-1">Descrição</label>
              <textarea
                placeholder="Ex. Lotes em Guaxuma..."
                rows={2}
                value={newProjDesc}
                onChange={(e) => setNewProjDesc(e.target.value)}
                className="w-full bg-[#08080a] border border-zinc-900 p-2 text-xs rounded text-zinc-200 outline-none focus:border-zinc-750 resize-none"
              />
            </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {projects.map(project => {
          const projectTasks = tasks.filter(t => t.projectId === project.id);
          const totalTasks = projectTasks.length;
          const completedTasks = projectTasks.filter(t => t.status === 'done').length;
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const buildProgress = Math.max(0, Math.min(100, project.buildProgress ?? 0));

          return (
            <div
              key={project.id}
              className="group bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-xl overflow-hidden transition-all duration-300 flex flex-col cursor-pointer hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_-8px_rgba(0,0,0,0.5)]"
              onClick={() => onSelectProjectFilter(project.id)}
            >
              {/* Cover */}
              <div className={`relative h-28 shrink-0 overflow-hidden ${project.color}`}>
                {project.coverImage ? (
                  <img
                    src={project.coverImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-current opacity-[0.12] flex items-center justify-center">
                    <Building2 size={22} className="opacity-60" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
                <span className="absolute top-2.5 right-2.5 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-200 bg-black/50 backdrop-blur-sm py-0.5 px-2 rounded-full border border-white/10">
                  {STATUS_LABEL[project.status]}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleEditClick(project); }}
                  className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 p-1 bg-black/50 backdrop-blur-sm rounded text-zinc-300 hover:text-white transition-opacity border border-white/10"
                  title="Editar"
                >
                  <Edit2 size={10} />
                </button>
              </div>

              <div className="p-4 flex flex-col flex-1">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-[13.5px] font-semibold text-zinc-100 truncate" title={project.name}>
                    {project.name}
                  </h3>
                </div>
                {project.code && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] font-mono text-zinc-600 truncate">{project.code}</span>
                    <CopyCodeButton code={project.code} />
                  </div>
                )}
                {!project.code && <div className="mb-3" />}

                <p className="text-[11.5px] text-zinc-500 leading-relaxed line-clamp-2 mb-3.5">
                  {project.description}
                </p>

                {/* Quick sections (decorative) */}
                <div className="border-t border-zinc-900 -mx-4 px-4 pt-2.5 pb-1 space-y-0.5">
                  {QUICK_SECTIONS.map(({ label, icon: Icon }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 py-1 text-[11.5px] text-zinc-500"
                    >
                      <Icon size={12} className="text-zinc-600 shrink-0" />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex-1" />

                {/* Build progress meter */}
                <div className={`space-y-1.5 mt-3 mb-3 ${project.color}`}>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-zinc-500">Evolução da Obra</span>
                    <span className="text-zinc-300 font-semibold">{buildProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current rounded-full transition-all duration-300"
                      style={{ width: `${buildProgress}%` }}
                    />
                  </div>
                </div>

                {/* Tasks meta + open button */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-900 text-[10px] text-zinc-600 font-mono mb-3">
                  <span>{completedTasks}/{totalTasks} tarefas concluídas</span>
                  <span className="text-zinc-500">{progressPercent}%</span>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onSelectProjectFilter(project.id); }}
                  className="w-full flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg py-2 transition-colors group-hover:border-zinc-700"
                >
                  <span>Abrir Empreendimento</span>
                  <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
