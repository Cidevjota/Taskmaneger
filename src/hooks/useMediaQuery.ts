import { useEffect, useState } from 'react';

/**
 * Assina uma media query e devolve se ela casa agora.
 *
 * Existe para os casos em que responsividade não é só CSS — quando a altura da
 * tela precisa mudar QUANTOS itens são renderizados (fatias de lista, número de
 * colunas de um gráfico), e não apenas como eles aparecem. Para tudo que dá
 * para resolver com classe/variante, prefira o CSS: ele não custa re-render.
 *
 * As queries devem espelhar os breakpoints de `index.css` (short/xshort/nb/nbs).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Altura de notebook: 1440x900, 1920x1080 a 150%. Espelha a variante `short`. */
export const SHORT_SCREEN = '(max-height: 859.98px)';
/** Altura crítica: 1366x768 com barra do navegador. Espelha a variante `xshort`. */
export const XSHORT_SCREEN = '(max-height: 719.98px)';
/** Espelha a variante `nbs` — abaixo disso a sidebar não cabe junto do conteúdo. */
export const NARROW_SCREEN = '(max-width: 1279.98px)';
