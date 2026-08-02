import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SyncManagerProvider } from './lib/SyncManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30 s — prevents redundant refetches between Realtime events
    },
  },
});

/**
 * Árvore autenticada do app. Vive num módulo separado (e não em main.tsx) para
 * que a rota pública da LP do Corretor não carregue os providers — sessão,
 * notificações, realtime — de que não precisa.
 */
export default function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <SyncManagerProvider>
            <App />
          </SyncManagerProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
