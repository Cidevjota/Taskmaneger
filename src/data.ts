import { Task, Project, Label } from './types';

export const MOCK_LABELS: Label[] = [
  { id: 'l1', name: 'Design', color: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' },
  { id: 'l2', name: 'Copy', color: 'bg-pink-500/10 text-pink-500 border border-pink-500/20' },
  { id: 'l3', name: 'Tarefa', color: 'bg-blue-500/10 text-blue-500 border border-blue-500/20' },
  { id: 'l4', name: 'Orçamento', color: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' },
  { id: 'l5', name: 'Social Mídia', color: 'bg-purple-500/10 text-purple-500 border border-purple-500/20' },
];

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Workspace Redesign', description: 'Revamp the core workspace layout with modern minimalist patterns.', color: 'text-blue-400', status: 'active' },
  { id: 'p2', name: 'Mobile Companion App', description: 'Develop lightweight iOS/Android interfaces using Tailwind.', color: 'text-emerald-400', status: 'active' },
  { id: 'p3', name: 'Integrations SDK v2', description: 'Publish server-side TypeScript wrappers for real-time Sync.', color: 'text-amber-400', status: 'on_hold' },
];

export const MOCK_TASKS: Task[] = [
  {
    id: 'TSK-101',
    title: 'Implement command palette modal (Cmd+K)',
    description: 'Build a flexible shortcut modal inspired by Linear. It must listen to global keyboard shortcuts, search through mock tasks, toggle themes, and navigate views.',
    status: 'in_progress',
    priority: 'high',
    projectId: 'p1',
    labels: [MOCK_LABELS[1]], // Feature
    createdAt: '2026-06-12',
    dueDate: '2026-06-18',
    assigneeId: 'u1',
    subtasks: [
      { id: 's1', title: 'Register global event listener for meta+k', completed: true },
      { id: 's2', title: 'Create fuzzy filter indexing on tasks and projects', completed: true },
      { id: 's3', title: 'Integrate dynamic style presets for themes', completed: false },
    ],
  },
  {
    id: 'TSK-102',
    title: 'Migrate layouts to responsive Tailwind grid',
    description: 'Ensure sidebar and board columns compress fluidly. The workspace must preserve desktop-first precision while collapsing beautifully on smaller tablet ports.',
    status: 'todo',
    priority: 'medium',
    projectId: 'p1',
    labels: [MOCK_LABELS[3]], // Refactor
    createdAt: '2026-06-14',
    dueDate: '2026-06-25',
    assigneeId: 'u2',
    subtasks: [
      { id: 's4', title: 'Implement collapsible trigger in sidebar', completed: true },
      { id: 's5', title: 'Mobile drawer overlay state for layout', completed: false },
    ],
  },
  {
    id: 'TSK-103',
    title: 'Fix state sync rendering issue during Dnd drag events',
    description: 'Address rendering stutter on slow container ticks. Ensure we transition bounding rectangular cards with Framer Motion layout animations.',
    status: 'no_forecast',
    priority: 'urgent',
    projectId: 'p1',
    labels: [MOCK_LABELS[0]], // Bug
    createdAt: '2026-06-10',
    dueDate: '2026-06-17',
    assigneeId: 'u1',
    subtasks: [
      { id: 's6', title: 'Optimize bounding rectangle animations', completed: false },
      { id: 's7', title: 'Debounce fast state shifts on drop triggers', completed: false },
    ],
  },
  {
    id: 'TSK-201',
    title: 'Implement Dark Mode transition contexts',
    description: 'Support seamless color switches with smooth CSS variables transition configurations. Perfect modern Linear graphite themes.',
    status: 'done',
    priority: 'medium',
    projectId: 'p1',
    labels: [MOCK_LABELS[1]], // Feature
    createdAt: '2026-06-12',
    dueDate: '2026-06-14',
    assigneeId: 'u3',
    subtasks: [
      { id: 's8', title: 'Setup dark: prefix triggers across workspace', completed: true },
      { id: 's9', title: 'Configure custom transition durations', completed: true },
    ],
  },
  {
    id: 'TSK-202',
    title: 'Develop calendar task scheduling viewport',
    description: 'Design a clean calendar container that reads task due dates and places interactive task tags directly onto day cards with smooth modal sheets.',
    status: 'in_progress',
    priority: 'medium',
    projectId: 'p2',
    labels: [MOCK_LABELS[1]], // Feature
    createdAt: '2026-06-11',
    dueDate: '2026-06-20',
    assigneeId: 'u2',
    subtasks: [
      { id: 's10', title: 'Calculate calendar grid start/end alignment', completed: true },
      { id: 's11', title: 'Draw interactive hover tags inside grid cells', completed: false },
    ],
  },
  {
    id: 'TSK-301',
    title: 'Draft API contracts for client-server sync layers',
    description: 'Formalize schemas and payload wrappers using standard TS typings. Document fallback protocols for transient query retries.',
    status: 'no_forecast',
    priority: 'no_priority',
    projectId: 'p3',
    labels: [MOCK_LABELS[4]], // Documentation
    createdAt: '2026-06-15',
    dueDate: '2026-07-01',
    subtasks: [],
  },
];
