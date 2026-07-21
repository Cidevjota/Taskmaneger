import React, { createContext, useContext, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { patchTask, TaskConflictError } from './api';
import { Task } from '../types';

interface SyncOptions {
  debounce?: boolean;
  debounceMs?: number;
}

interface SyncManagerContextType {
  updateTask: (taskId: string, updates: Partial<Task>, options?: SyncOptions) => void;
  isFieldDirty: (taskId: string, field: keyof Task) => boolean;
  getPendingField: <K extends keyof Task>(taskId: string, field: K) => Task[K] | undefined;
  saveImmediately: (taskId: string, updates: Partial<Task>) => Promise<void>;
  setDescriptionBase: (taskId: string, description: string) => void;
  onDescriptionConflict: (handler: (taskId: string) => void) => () => void;
}

const SyncManagerContext = createContext<SyncManagerContextType | null>(null);

export function SyncManagerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  // Track fields currently being edited to prevent Realtime from overwriting them
  const dirtyFieldsRef = useRef<Record<string, Set<keyof Task>>>({});
  
  // Track debouncing timers
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Accumulate changes before sending to API
  const pendingUpdatesRef = useRef<Record<string, Partial<Task>>>({});

  // Última descrição que sabemos estar gravada no banco, por tarefa. É a base do
  // compare-and-swap em patchTask: sem ela, um editor com conteúdo obsoleto
  // sobrescreve silenciosamente o que outra pessoa escreveu. Preenchida pela UI
  // (ao carregar/adotar o texto do servidor) e atualizada a cada write confirmado.
  const descriptionBasesRef = useRef<Record<string, string>>({});
  const conflictHandlersRef = useRef<Set<(taskId: string) => void>>(new Set());

  const setDescriptionBase = (taskId: string, description: string) => {
    descriptionBasesRef.current[taskId] = description;
  };

  const onDescriptionConflict = (handler: (taskId: string) => void) => {
    conflictHandlersRef.current.add(handler);
    return () => { conflictHandlersRef.current.delete(handler); };
  };

  // Monta as opções do patch. Só ativa o guard quando a UI registrou uma base
  // para a tarefa — writes que não passam por um editor seguem sem verificação.
  const patchOptionsFor = (taskId: string, updates: Partial<Task>) =>
    (updates.description !== undefined && taskId in descriptionBasesRef.current)
      ? { descriptionBase: descriptionBasesRef.current[taskId] }
      : {};

  const handleConflict = (taskId: string) => {
    // A base local é inútil agora: o banco tem uma versão que nunca vimos.
    // Descartamos o write (re-enfileirar só repetiria a sobrescrita) e deixamos
    // o handler recarregar do servidor.
    delete descriptionBasesRef.current[taskId];
    conflictHandlersRef.current.forEach(h => h(taskId));
  };

  const markDirty = (taskId: string, fields: (keyof Task)[]) => {
    if (!dirtyFieldsRef.current[taskId]) {
      dirtyFieldsRef.current[taskId] = new Set();
    }
    fields.forEach(f => dirtyFieldsRef.current[taskId].add(f));
  };

  const clearDirty = (taskId: string, fields: (keyof Task)[]) => {
    if (!dirtyFieldsRef.current[taskId]) return;
    fields.forEach(f => dirtyFieldsRef.current[taskId].delete(f));
  };

  const isFieldDirty = (taskId: string, field: keyof Task) => {
    return dirtyFieldsRef.current[taskId]?.has(field) || false;
  };

  // Exposes a field's value from the still-unflushed update queue, so callers
  // that refetch "fresh" state from the server can detect a write that hasn't
  // landed in the DB yet and avoid basing a new save on stale data (which would
  // silently overwrite the pending update when it flushes).
  const getPendingField = <K extends keyof Task>(taskId: string, field: K): Task[K] | undefined => {
    return pendingUpdatesRef.current[taskId]?.[field] as Task[K] | undefined;
  };

  const executeUpdate = async (taskId: string) => {
    const updates = pendingUpdatesRef.current[taskId];
    if (!updates || Object.keys(updates).length === 0) return;
    
    // Clear pending for this run
    delete pendingUpdatesRef.current[taskId];
    const updateKeys = Object.keys(updates) as (keyof Task)[];

    try {
      await patchTask(taskId, updates, patchOptionsFor(taskId, updates));
      if (updates.description !== undefined) {
        descriptionBasesRef.current[taskId] = updates.description ?? '';
      }
    } catch (err) {
      if (err instanceof TaskConflictError) {
        handleConflict(taskId);
      } else {
        console.error('Failed to sync task:', taskId, err);
        // Re-queue on failure (simplistic retry)
        pendingUpdatesRef.current[taskId] = { ...updates, ...pendingUpdatesRef.current[taskId] };
      }
    } finally {
      // Clear dirty flags once we confirm it was patched
      clearDirty(taskId, updateKeys);
    }
  };

  // Bypasses debounce entirely and awaits the actual DB write. Use this for
  // saves that a notification or other side-effect must not fire ahead of
  // (e.g. adding a creative for approval) — callers can await confirmation
  // before unlocking the UI or notifying anyone.
  const saveImmediately = async (taskId: string, updates: Partial<Task>): Promise<void> => {
    const updateKeys = Object.keys(updates) as (keyof Task)[];
    markDirty(taskId, updateKeys);

    // Merge with whatever is still queued so an in-flight debounced write
    // for this task isn't dropped by this immediate save.
    const merged: Partial<Task> = { ...pendingUpdatesRef.current[taskId], ...updates };
    const mergedKeys = Object.keys(merged) as (keyof Task)[];

    queryClient.setQueryData<Task[]>(['tasks'], (oldTasks) => {
      if (!oldTasks) return oldTasks;
      return oldTasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    });

    if (timersRef.current[taskId]) {
      clearTimeout(timersRef.current[taskId]);
      delete timersRef.current[taskId];
    }
    delete pendingUpdatesRef.current[taskId];

    try {
      await patchTask(taskId, merged, patchOptionsFor(taskId, merged));
      if (merged.description !== undefined) {
        descriptionBasesRef.current[taskId] = merged.description ?? '';
      }
    } catch (err) {
      if (err instanceof TaskConflictError) {
        handleConflict(taskId);
      } else {
        console.error('Failed to sync task immediately:', taskId, err);
        // Re-queue so a later debounced save can retry it.
        pendingUpdatesRef.current[taskId] = { ...merged, ...pendingUpdatesRef.current[taskId] };
      }
      throw err;
    } finally {
      clearDirty(taskId, mergedKeys);
    }
  };

  const updateTask = (taskId: string, updates: Partial<Task>, options: SyncOptions = {}) => {
    const { debounce = false, debounceMs = 500 } = options;
    const updateKeys = Object.keys(updates) as (keyof Task)[];
    
    // 1. Mark fields as dirty so Realtime ignores incoming updates for them
    markDirty(taskId, updateKeys);

    // 2. Accumulate updates
    pendingUpdatesRef.current[taskId] = {
      ...pendingUpdatesRef.current[taskId],
      ...updates
    };

    // 3. Optimistic UI Update via React Query
    queryClient.setQueryData<Task[]>(['tasks'], (oldTasks) => {
      if (!oldTasks) return oldTasks;
      return oldTasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    });

    // 4. Schedule API Call
    if (timersRef.current[taskId]) {
      clearTimeout(timersRef.current[taskId]);
    }

    if (debounce) {
      timersRef.current[taskId] = setTimeout(() => {
        executeUpdate(taskId);
      }, debounceMs);
    } else {
      // Execute immediately (or next microtask)
      timersRef.current[taskId] = setTimeout(() => {
        executeUpdate(taskId);
      }, 0);
    }
  };

  return (
    <SyncManagerContext.Provider value={{ updateTask, isFieldDirty, getPendingField, saveImmediately, setDescriptionBase, onDescriptionConflict }}>
      {children}
    </SyncManagerContext.Provider>
  );
}

export function useSyncManager() {
  const ctx = useContext(SyncManagerContext);
  if (!ctx) throw new Error('useSyncManager must be used within SyncManagerProvider');
  return ctx;
}
