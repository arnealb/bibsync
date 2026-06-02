/**
 * SERVER-ONLY player pool with stats — used by Hoger/Lager and Raad de speler.
 * Values are illustrative peak market values (in € millions) purely for the
 * game; they don't need to be live-accurate, only relatively sensible. NEVER
 * import into a client component.
 */
export interface StatPlayer {
  name: string;
  accept: string[];
  flag: string;
  country: string;
  position: string;
  /** Illustrative peak market value in € millions (for Hoger/Lager). */
  value: number;
  /** Notable clubs, chronological-ish (for the mystery clues). */
  clubs: string[];
}

export const STAT_PLAYERS: StatPlayer[] = [
  { name: "Kylian Mbappé", accept: ["mbappe", "kylian mbappe"], flag: "🇫🇷", country: "Frankrijk", position: "Aanvaller", value: 180, clubs: ["Monaco", "PSG", "Real Madrid"] },
  { name: "Erling Haaland", accept: ["haaland", "erling haaland"], flag: "🇳🇴", country: "Noorwegen", position: "Aanvaller", value: 180, clubs: ["RB Salzburg", "Dortmund", "Man City"] },
  { name: "Jude Bellingham", accept: ["bellingham", "jude bellingham"], flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Engeland", position: "Middenvelder", value: 180, clubs: ["Birmingham", "Dortmund", "Real Madrid"] },
  { name: "Vinícius Júnior", accept: ["vinicius", "vinicius junior", "vini"], flag: "🇧🇷", country: "Brazilië", position: "Aanvaller", value: 200, clubs: ["Flamengo", "Real Madrid"] },
  { name: "Lionel Messi", accept: ["messi", "lionel messi"], flag: "🇦🇷", country: "Argentinië", position: "Aanvaller", value: 180, clubs: ["Barcelona", "PSG", "Inter Miami"] },
  { name: "Cristiano Ronaldo", accept: ["cristiano ronaldo", "ronaldo", "cr7"], flag: "🇵🇹", country: "Portugal", position: "Aanvaller", value: 120, clubs: ["Sporting", "Man United", "Real Madrid", "Juventus", "Al-Nassr"] },
  { name: "Kevin De Bruyne", accept: ["de bruyne", "kevin de bruyne", "kdb"], flag: "🇧🇪", country: "België", position: "Middenvelder", value: 100, clubs: ["Genk", "Chelsea", "Wolfsburg", "Man City"] },
  { name: "Mohamed Salah", accept: ["salah", "mo salah"], flag: "🇪🇬", country: "Egypte", position: "Aanvaller", value: 100, clubs: ["Basel", "Chelsea", "Roma", "Liverpool"] },
  { name: "Harry Kane", accept: ["kane", "harry kane"], flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Engeland", position: "Aanvaller", value: 100, clubs: ["Tottenham", "Bayern München"] },
  { name: "Robert Lewandowski", accept: ["lewandowski", "lewa"], flag: "🇵🇱", country: "Polen", position: "Aanvaller", value: 45, clubs: ["Dortmund", "Bayern München", "Barcelona"] },
  { name: "Neymar", accept: ["neymar"], flag: "🇧🇷", country: "Brazilië", position: "Aanvaller", value: 90, clubs: ["Santos", "Barcelona", "PSG", "Al-Hilal"] },
  { name: "Luka Modrić", accept: ["modric", "luka modric"], flag: "🇭🇷", country: "Kroatië", position: "Middenvelder", value: 40, clubs: ["Dinamo Zagreb", "Tottenham", "Real Madrid"] },
  { name: "Jamal Musiala", accept: ["musiala", "jamal musiala"], flag: "🇩🇪", country: "Duitsland", position: "Middenvelder", value: 140, clubs: ["Chelsea", "Bayern München"] },
  { name: "Phil Foden", accept: ["foden", "phil foden"], flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Engeland", position: "Middenvelder", value: 130, clubs: ["Man City"] },
  { name: "Rodri", accept: ["rodri", "rodrigo hernandez"], flag: "🇪🇸", country: "Spanje", position: "Middenvelder", value: 110, clubs: ["Villarreal", "Atlético", "Man City"] },
  { name: "Bukayo Saka", accept: ["saka", "bukayo saka"], flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Engeland", position: "Aanvaller", value: 140, clubs: ["Arsenal"] },
  { name: "Lautaro Martínez", accept: ["lautaro", "lautaro martinez"], flag: "🇦🇷", country: "Argentinië", position: "Aanvaller", value: 110, clubs: ["Racing", "Inter"] },
  { name: "Victor Osimhen", accept: ["osimhen", "victor osimhen"], flag: "🇳🇬", country: "Nigeria", position: "Aanvaller", value: 100, clubs: ["Charleroi", "Lille", "Napoli"] },
  { name: "Pedri", accept: ["pedri"], flag: "🇪🇸", country: "Spanje", position: "Middenvelder", value: 100, clubs: ["Las Palmas", "Barcelona"] },
  { name: "Federico Valverde", accept: ["valverde", "federico valverde"], flag: "🇺🇾", country: "Uruguay", position: "Middenvelder", value: 130, clubs: ["Peñarol", "Real Madrid"] },
  { name: "Virgil van Dijk", accept: ["van dijk", "virgil van dijk", "vvd"], flag: "🇳🇱", country: "Nederland", position: "Verdediger", value: 45, clubs: ["Groningen", "Celtic", "Southampton", "Liverpool"] },
  { name: "Frenkie de Jong", accept: ["de jong", "frenkie de jong", "frenkie"], flag: "🇳🇱", country: "Nederland", position: "Middenvelder", value: 70, clubs: ["Ajax", "Barcelona"] },
  { name: "Thibaut Courtois", accept: ["courtois", "thibaut courtois"], flag: "🇧🇪", country: "België", position: "Keeper", value: 30, clubs: ["Genk", "Atlético", "Chelsea", "Real Madrid"] },
  { name: "Romelu Lukaku", accept: ["lukaku", "romelu lukaku"], flag: "🇧🇪", country: "België", position: "Aanvaller", value: 30, clubs: ["Anderlecht", "Chelsea", "Everton", "Inter", "Roma", "Napoli"] },
];

const BY_INDEX = STAT_PLAYERS;

export function statPlayer(index: number): StatPlayer | undefined {
  return BY_INDEX[index];
}
