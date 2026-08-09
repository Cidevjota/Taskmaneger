// Os fluxos de aprovação (design e copy) compartilham os mesmos componentes, mas
// cada um segue a cor da sua classe de tarefa. As classes precisam aparecer
// literais aqui — o Tailwind não enxerga nomes montados em runtime.

export type DeliveryAccent = 'yellow' | 'pink';

export interface AccentClasses {
  /** Botão sólido de destaque (ex.: "Refazer"). */
  solid: string;
  /** Badge de status pendente. */
  badge: string;
  /** Marcador ativo da timeline. */
  dot: string;
  /** Pílula REV selecionada. */
  pill: string;
  /** Borda de foco em inputs/textareas. */
  focusBorder: string;
  /** Dropdown aberto. */
  selectOpen: string;
  /** Opção selecionada dentro do dropdown. */
  optionActive: string;
  /** Texto de destaque. */
  text: string;
  /** Botão discreto com hover colorido. */
  ghost: string;
  /** Botão de contorno (submit do formulário). */
  outline: string;
  /** Spinner de "salvando". */
  spinner: string;
  /** Área de colar imagem / campo em foco. */
  focusWithin: string;
  /** Barra lateral do trecho citado num comentário. */
  quoteBar: string;
}

const YELLOW: AccentClasses = {
  solid: 'bg-yellow-500 hover:bg-yellow-400 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.2)]',
  badge: 'border-yellow-500/20 text-yellow-500/80',
  dot: 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]',
  pill: 'bg-yellow-500 text-yellow-950 border-yellow-500',
  focusBorder: 'focus:border-yellow-500/50',
  selectOpen: 'border-yellow-500/50 shadow-[0_0_0_2px_rgba(234,179,8,0.1)]',
  optionActive: 'bg-yellow-500/10 text-yellow-500',
  text: 'text-yellow-400',
  ghost: 'hover:text-yellow-400 hover:border-yellow-500/30 hover:bg-yellow-500/5',
  outline: 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400',
  spinner: 'border-yellow-400/40 border-t-yellow-400',
  focusWithin: 'focus-within:border-yellow-500/50',
  quoteBar: 'border-yellow-500/60',
};

const PINK: AccentClasses = {
  solid: 'bg-pink-500 hover:bg-pink-400 text-pink-950 shadow-[0_0_15px_rgba(236,72,153,0.2)]',
  badge: 'border-pink-500/20 text-pink-500/80',
  dot: 'bg-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.5)]',
  pill: 'bg-pink-500 text-pink-950 border-pink-500',
  focusBorder: 'focus:border-pink-500/50',
  selectOpen: 'border-pink-500/50 shadow-[0_0_0_2px_rgba(236,72,153,0.1)]',
  optionActive: 'bg-pink-500/10 text-pink-400',
  text: 'text-pink-400',
  ghost: 'hover:text-pink-400 hover:border-pink-500/30 hover:bg-pink-500/5',
  outline: 'border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400',
  spinner: 'border-pink-400/40 border-t-pink-400',
  focusWithin: 'focus-within:border-pink-500/50',
  quoteBar: 'border-pink-500/60',
};

export function accentClasses(accent: DeliveryAccent = 'yellow'): AccentClasses {
  return accent === 'pink' ? PINK : YELLOW;
}
