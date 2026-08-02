import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

import { LP_CORRETOR_BASE_PATH } from './lib/lpCorretor';

// Carregados sob demanda para que os dois lados não paguem o bundle do outro —
// a LP é aberta no celular do corretor e não pode arrastar junto os providers,
// o editor e as planilhas do app interno.
const AppRoot = lazy(() => import('./AppRoot'));
const LpCorretorPage = lazy(() => import('./components/LpCorretorPage'));

// Rota pública da LP do Corretor (/tabela/<slug>): renderizada fora do
// AuthProvider e de todo o resto do app, então quem abre o link não carrega —
// nem alcança — nenhuma outra tela. O conteúdo vem da RPC get_lp_corretor,
// a única coisa liberada para a chave anon.
const lpSlug = (() => {
  const prefix = `${LP_CORRETOR_BASE_PATH}/`;
  const path = decodeURIComponent(window.location.pathname);
  if (!path.startsWith(prefix)) return null;
  return path.slice(prefix.length).replace(/\/+$/, '') || null;
})();

// A LP tem visual próprio e não segue a preferência de tema do usuário do
// sistema; sem a classe `dark` os overrides de :root:not(.dark) do index.css
// converteriam a paleta inteira para o tema claro.
if (lpSlug) {
  document.documentElement.classList.add('dark');
  document.documentElement.style.colorScheme = 'dark';
  // viewport-fit=cover deixa o banner sangrar até as bordas do iPhone e habilita
  // env(safe-area-inset-*), que a LP usa para desviar do notch e do indicador de
  // gestos. Aplicado só aqui: o app interno não é desenhado para áreas seguras.
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-[#08080a]" />}>
      {lpSlug ? <LpCorretorPage slug={lpSlug} /> : <AppRoot />}
    </Suspense>
  </StrictMode>,
);
