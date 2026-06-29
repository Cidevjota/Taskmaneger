import React, { createContext, useContext, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { patchTask } from './api';
import { Task } from '../types';

interface SyncOptions {
  debounce?: boolean;
  debounceMs?: number;
}

interface SyncManagerContextType {
  updateTask: (taskId: string, updates: Partial<Task>, options?: SyncOptions) => void;
  isFieldDirty: (taskId: string, field: keyof Task) => boolean;
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

  const executeUpdate = async (taskId: string) => {
    const updates = pendingUpdatesRef.current[taskId];
    if (!updates || Object.keys(updates).length === 0) return;
    
    // Clear pending for this run
    delete pendingUpdatesRef.current[taskId];
    const updateKeys = Object.keys(updates) as (keyof Task)[];

    try {
      await patchTask(taskId, updates);
    } catch (err) {
      console.error('Failed to sync task:', taskId, err);
      // Re-queue on failure (simplistic retry)
      pendingUpdatesRef.current[taskId] = { ...updates, ...pendingUpdatesRef.current[taskId] };
    } finally {
      // Clear dirty flags once we confirm it was patched
      clearDirty(taskId, updateKeys);
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
    <SyncManagerContext.Provider value={{ updateTask, isFieldDirty }}>
      {children}
    </SyncManagerContext.Provider>
  );
}

export function useSyncManager() {
  const ctx = useContext(SyncManagerContext);
  if (!ctx) throw new Error('useSyncManager must be used within SyncManagerProvider');
  return ctx;
}
