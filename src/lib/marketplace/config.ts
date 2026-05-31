/** Bibcoin klussenmarkt tuning. */

export const OFFER_TITLE_MAX = 60;
export const OFFER_DESCRIPTION_MAX = 200;
export const OFFER_PRICE_MIN = 1;
export const OFFER_PRICE_MAX = 1_000_000;

/** 'offer' = I provide a service · 'request' = I need something (others bid). */
export const OFFER_KINDS = ["offer", "request"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export interface OfferPreset {
  emoji: string;
  title: string;
  description: string;
  price: number;
}

/** Quick-fill suggestions for common library favours, with sensible prices. */
export const OFFER_PRESETS: readonly OfferPreset[] = [
  { emoji: "💧", title: "Waterfles vullen", description: "Ik vul je waterfles bij.", price: 200 },
  { emoji: "☕", title: "Koffie halen", description: "Ik haal koffie voor je.", price: 300 },
  { emoji: "🥐", title: "Snack halen", description: "Ik haal een snack of broodje.", price: 400 },
  { emoji: "🪑", title: "Plek vrijhouden", description: "Ik hou je plek 15 min vrij.", price: 150 },
  { emoji: "🖊️", title: "Materiaal uitlenen", description: "Pen, oplader of papier nodig? Ik leen het uit.", price: 50 },
  { emoji: "📋", title: "Samenvatting delen", description: "Ik deel mijn samenvatting met je.", price: 750 },
  { emoji: "📸", title: "Foto van het bord", description: "Ik stuur je een foto van het bord/notities.", price: 250 },
  { emoji: "🧹", title: "Rommel opruimen", description: "Ik ruim je plek op.", price: 250 },
  { emoji: "🚗", title: "Naar huis voeren", description: "Ik voer je na de bib naar huis.", price: 1000 },
];

/** Quick-fill suggestions for common library requests, with sensible budgets. */
export const REQUEST_PRESETS: readonly OfferPreset[] = [
  { emoji: "🥤", title: "Redbull van de Okay", description: "Haal een Redbull voor me bij de Okay.", price: 500 },
  { emoji: "☕", title: "Koffie nodig", description: "Ik wil een koffie — wie haalt er een?", price: 400 },
  { emoji: "🥐", title: "Iets te eten", description: "Honger! Haal een broodje/snack voor me.", price: 600 },
  { emoji: "🖊️", title: "Oplader lenen", description: "Iemand een oplader (USB-C/lightning)?", price: 100 },
  { emoji: "📋", title: "Samenvatting gezocht", description: "Wie deelt zijn samenvatting met me?", price: 1000 },
];
