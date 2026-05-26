export interface Achievement {
  id: string;
  title: string;
  description: string;
  reward: number;
}

/** Data-driven achievement catalogue — add more freely. */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_message",
    title: "Eerste woorden",
    description: "Stuur je eerste chatbericht.",
    reward: 25,
  },
  {
    id: "chatterbox",
    title: "Babbelaar",
    description: "Stuur 20 berichten op één dag.",
    reward: 50,
  },
  {
    id: "first_vote",
    title: "Inspraak",
    description: "Stem op je eerste voorstel.",
    reward: 25,
  },
  {
    id: "snake_25",
    title: "Slangenbezweerder",
    description: "Haal 25 in Snake (eerlijk).",
    reward: 50,
  },
  {
    id: "snake_100",
    title: "Snake-koning",
    description: "Haal 100 in Snake (eerlijk).",
    reward: 150,
  },
  {
    id: "first_poker_win",
    title: "Pokerface",
    description: "Win je eerste pokerhand.",
    reward: 50,
  },
  {
    id: "blackjack_win",
    title: "Eenentwintig",
    description: "Win je eerste potje blackjack.",
    reward: 50,
  },
  {
    id: "roulette_win",
    title: "Rien ne va plus",
    description: "Win je eerste keer aan de roulette.",
    reward: 50,
  },
  {
    id: "shopaholic",
    title: "Shopaholic",
    description: "Koop je eerste cosmetic.",
    reward: 25,
  },
  {
    id: "stylist",
    title: "Stylist",
    description: "Rust een frame én een badge uit.",
    reward: 25,
  },
];

export const ACHIEVEMENT_BY_ID = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);
