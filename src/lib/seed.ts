import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { MOCK_PROJECTS, MOCK_LABELS, MOCK_TASKS } from '../data';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('Seeding data...');

  // Seed Projects
  for (const project of MOCK_PROJECTS) {
    await supabase.from('projects').upsert({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      status: project.status
    });
  }
  console.log('Projects seeded');

  // Seed Labels
  for (const label of MOCK_LABELS) {
    await supabase.from('labels').upsert({
      id: label.id,
      name: label.name,
      color: label.color
    });
  }
  console.log('Labels seeded');

  // Seed Tasks
  for (const task of MOCK_TASKS) {
    // Upsert task
    await supabase.from('tasks').upsert({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      project_id: task.projectId,
      created_at: task.createdAt,
      due_date: task.dueDate,
      assignee_id: task.assigneeId,
      design_briefing: task.designBriefing,
      copy_briefing: task.copyBriefing,
      parent_task_id: task.parentTaskId
    });

    // Subtasks
    if (task.subtasks) {
      for (const st of task.subtasks) {
        await supabase.from('subtasks').upsert({
          id: st.id,
          task_id: task.id,
          title: st.title,
          completed: st.completed,
          canceled: st.canceled,
          reminder_date: st.reminderDate,
          level: st.level
        });
      }
    }

    // Task Labels
    if (task.labels) {
      for (const label of task.labels) {
        await supabase.from('task_labels').upsert({
          task_id: task.id,
          label_id: label.id
        });
      }
    }
  }
  console.log('Tasks seeded');
  console.log('Seeding complete');
}

seed().catch(console.error);
