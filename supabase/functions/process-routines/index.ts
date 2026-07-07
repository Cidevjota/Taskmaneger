import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function processRoutines() {
  console.log("Processing routines...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch all active tasks that might have a routine
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .not('status', 'eq', 'done');

  if (error) {
    console.error('Error fetching tasks:', error);
    return;
  }

  const now = new Date();

  for (const task of tasks) {
    if (!task.routine || typeof task.routine !== 'object' || !task.routine.active) continue;

    const routine = task.routine;
    const { type, intervalValue, intervalUnit, weekdays, lastDuplicatedAt, originalSnapshot } = routine;
    
    let shouldDuplicate = false;
    const lastDate = lastDuplicatedAt ? new Date(lastDuplicatedAt) : new Date(task.created_at);
    
    // Avoid aggressive duplication on the same minute it was set
    if (now.getTime() - lastDate.getTime() < 60000) continue;

    if (type === 'interval' && intervalValue && intervalUnit) {
      const diffTime = now.getTime() - lastDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (intervalUnit === 'days' && diffDays >= intervalValue) shouldDuplicate = true;
      else if (intervalUnit === 'weeks' && diffDays >= (intervalValue * 7)) shouldDuplicate = true;
      else if (intervalUnit === 'months') {
        const monthsDiff = (now.getFullYear() - lastDate.getFullYear()) * 12 + now.getMonth() - lastDate.getMonth();
        if (monthsDiff >= intervalValue) shouldDuplicate = true;
      }
    } else if (type === 'weekdays' && weekdays && Array.isArray(weekdays) && weekdays.length > 0) {
      const jsDay = now.getDay();
      const mappedDay = jsDay === 0 ? 7 : jsDay; // 1=Mon, 7=Sun
      
      if (weekdays.includes(mappedDay)) {
         const lastDateString = lastDate.toISOString().split('T')[0];
         const todayString = now.toISOString().split('T')[0];
         if (lastDateString !== todayString) {
           shouldDuplicate = true;
         }
      }
    }

    if (shouldDuplicate) {
      console.log(`Duplicating task: ${task.id}`);
      const newTaskId = crypto.randomUUID();
      
      const snapshot = originalSnapshot || {};
      
      // Recreate task as a copy
      const clonedTask = {
         id: newTaskId,
         title: snapshot.title || task.title,
         description: snapshot.description || task.description,
         status: 'todo',
         priority: snapshot.priority || task.priority,
         project_id: snapshot.projectId || task.project_id,
         created_at: now.toISOString(),
         updated_at: now.toISOString(),
         routine: null, // clear nested routines
         routine_origin_id: task.id
      };
      
      const updatedRoutine = { ...routine, lastDuplicatedAt: now.toISOString() };

      try {
        const { error: insertError } = await supabase.from('tasks').insert([clonedTask]);
        if (insertError) throw insertError;

        // Also duplicate labels if they exist in the snapshot
        if (snapshot.labels && Array.isArray(snapshot.labels)) {
          const labelInserts = snapshot.labels.map((l: any) => ({
            task_id: newTaskId,
            label_id: l.id || l
          }));
          if (labelInserts.length > 0) {
             await supabase.from('task_labels').insert(labelInserts);
          }
        }
        
        // Update original task
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ routine: updatedRoutine })
          .eq('id', task.id);
        
        if (updateError) throw updateError;
        
      } catch (e) {
        console.error("Error duplicating routine for task", task.id, e);
      }
    }
  }
}

// @ts-ignore
Deno.cron("Process Routines", "*/15 * * * *", () => {
  processRoutines();
});

// Also expose as standard Edge Function for manual triggers or pg_cron
serve(async (req: Request) => {
  if (req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${Deno.env.get('SIENGE_WEBHOOK_TOKEN') || 'sienge-taskmanager-secret-token'}`) {
       // Just basic protection
       if (req.headers.get('X-Cron-Trigger') !== 'true') {
         return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
       }
    }
    
    await processRoutines();
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response("Process Routines Edge Function (Supports Deno Cron)", { status: 200 });
});
