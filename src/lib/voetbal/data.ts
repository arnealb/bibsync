/**
 * SERVER-ONLY football data — contains the accepted answers for every round.
 * NEVER import this into a client component (it would leak the solutions); the
 * client gets only masked slots from the server action. Use `categories.ts` for
 * client-safe metadata.
 */
export interface VoetbalPlayer {
  /** Display name shown once guessed. */
  name: string;
  /** Flag emoji of the player's country (hint). */
  flag: string;
  /** Dutch position label (hint): Keeper / Verdediger / Middenvelder / Aanvaller. */
  position: string;
  /** Accepted answers (matched case/accent/space-insensitively). */
  accept: string[];
}

export interface VoetbalCategoryData {
  key: string;
  players: VoetbalPlayer[];
}

const AANVALLER = "Aanvaller";
const MIDDEN = "Middenvelder";
const VERDEDIGER = "Verdediger";
const KEEPER = "Keeper";

const CATEGORIES: VoetbalCategoryData[] = [
  {
    key: "wereld",
    players: [
      { name: "Lionel Messi", flag: "🇦🇷", position: AANVALLER, accept: ["messi", "lionel messi", "leo messi"] },
      { name: "Cristiano Ronaldo", flag: "🇵🇹", position: AANVALLER, accept: ["cristiano ronaldo", "ronaldo", "cr7", "cristiano"] },
      { name: "Kylian Mbappé", flag: "🇫🇷", position: AANVALLER, accept: ["mbappe", "kylian mbappe", "mbappé"] },
      { name: "Erling Haaland", flag: "🇳🇴", position: AANVALLER, accept: ["haaland", "erling haaland"] },
      { name: "Kevin De Bruyne", flag: "🇧🇪", position: MIDDEN, accept: ["de bruyne", "kevin de bruyne", "kdb"] },
      { name: "Vinícius Júnior", flag: "🇧🇷", position: AANVALLER, accept: ["vinicius", "vinicius junior", "vini", "vinicius jr"] },
      { name: "Jude Bellingham", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", position: MIDDEN, accept: ["bellingham", "jude bellingham"] },
      { name: "Mohamed Salah", flag: "🇪🇬", position: AANVALLER, accept: ["salah", "mo salah", "mohamed salah"] },
      { name: "Harry Kane", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", position: AANVALLER, accept: ["kane", "harry kane"] },
      { name: "Robert Lewandowski", flag: "🇵🇱", position: AANVALLER, accept: ["lewandowski", "lewa", "robert lewandowski"] },
      { name: "Neymar", flag: "🇧🇷", position: AANVALLER, accept: ["neymar", "neymar jr"] },
      { name: "Luka Modrić", flag: "🇭🇷", position: MIDDEN, accept: ["modric", "luka modric", "modrić"] },
    ],
  },
  {
    key: "legendes",
    players: [
      { name: "Pelé", flag: "🇧🇷", position: AANVALLER, accept: ["pele", "pelé"] },
      { name: "Diego Maradona", flag: "🇦🇷", position: AANVALLER, accept: ["maradona", "diego maradona"] },
      { name: "Zinédine Zidane", flag: "🇫🇷", position: MIDDEN, accept: ["zidane", "zizou", "zinedine zidane"] },
      { name: "Ronaldo Nazário", flag: "🇧🇷", position: AANVALLER, accept: ["ronaldo nazario", "r9", "ronaldo nazário", "fenomeno", "o fenomeno"] },
      { name: "Ronaldinho", flag: "🇧🇷", position: AANVALLER, accept: ["ronaldinho", "ronaldinho gaucho"] },
      { name: "Johan Cruyff", flag: "🇳🇱", position: AANVALLER, accept: ["cruyff", "cruijff", "johan cruyff", "johan cruijff"] },
      { name: "Franz Beckenbauer", flag: "🇩🇪", position: VERDEDIGER, accept: ["beckenbauer", "franz beckenbauer", "der kaiser"] },
      { name: "Paolo Maldini", flag: "🇮🇹", position: VERDEDIGER, accept: ["maldini", "paolo maldini"] },
      { name: "Thierry Henry", flag: "🇫🇷", position: AANVALLER, accept: ["henry", "thierry henry"] },
      { name: "Andrés Iniesta", flag: "🇪🇸", position: MIDDEN, accept: ["iniesta", "andres iniesta"] },
      { name: "Xavi", flag: "🇪🇸", position: MIDDEN, accept: ["xavi", "xavi hernandez"] },
      { name: "Roberto Baggio", flag: "🇮🇹", position: AANVALLER, accept: ["baggio", "roberto baggio", "il divin codino"] },
    ],
  },
  {
    key: "duivels",
    players: [
      { name: "Kevin De Bruyne", flag: "🇧🇪", position: MIDDEN, accept: ["de bruyne", "kevin de bruyne", "kdb"] },
      { name: "Eden Hazard", flag: "🇧🇪", position: AANVALLER, accept: ["hazard", "eden hazard"] },
      { name: "Romelu Lukaku", flag: "🇧🇪", position: AANVALLER, accept: ["lukaku", "romelu lukaku", "big rom"] },
      { name: "Thibaut Courtois", flag: "🇧🇪", position: KEEPER, accept: ["courtois", "thibaut courtois"] },
      { name: "Jan Vertonghen", flag: "🇧🇪", position: VERDEDIGER, accept: ["vertonghen", "jan vertonghen"] },
      { name: "Toby Alderweireld", flag: "🇧🇪", position: VERDEDIGER, accept: ["alderweireld", "toby alderweireld"] },
      { name: "Dries Mertens", flag: "🇧🇪", position: AANVALLER, accept: ["mertens", "dries mertens"] },
      { name: "Axel Witsel", flag: "🇧🇪", position: MIDDEN, accept: ["witsel", "axel witsel"] },
      { name: "Vincent Kompany", flag: "🇧🇪", position: VERDEDIGER, accept: ["kompany", "vincent kompany"] },
      { name: "Youri Tielemans", flag: "🇧🇪", position: MIDDEN, accept: ["tielemans", "youri tielemans"] },
      { name: "Jérémy Doku", flag: "🇧🇪", position: AANVALLER, accept: ["doku", "jeremy doku"] },
      { name: "Marouane Fellaini", flag: "🇧🇪", position: MIDDEN, accept: ["fellaini", "marouane fellaini"] },
    ],
  },
  {
    key: "oranje",
    players: [
      { name: "Johan Cruyff", flag: "🇳🇱", position: AANVALLER, accept: ["cruyff", "cruijff", "johan cruyff"] },
      { name: "Marco van Basten", flag: "🇳🇱", position: AANVALLER, accept: ["van basten", "marco van basten"] },
      { name: "Ruud Gullit", flag: "🇳🇱", position: MIDDEN, accept: ["gullit", "ruud gullit"] },
      { name: "Frank Rijkaard", flag: "🇳🇱", position: MIDDEN, accept: ["rijkaard", "frank rijkaard"] },
      { name: "Dennis Bergkamp", flag: "🇳🇱", position: AANVALLER, accept: ["bergkamp", "dennis bergkamp"] },
      { name: "Arjen Robben", flag: "🇳🇱", position: AANVALLER, accept: ["robben", "arjen robben"] },
      { name: "Wesley Sneijder", flag: "🇳🇱", position: MIDDEN, accept: ["sneijder", "wesley sneijder"] },
      { name: "Robin van Persie", flag: "🇳🇱", position: AANVALLER, accept: ["van persie", "robin van persie", "rvp"] },
      { name: "Virgil van Dijk", flag: "🇳🇱", position: VERDEDIGER, accept: ["van dijk", "virgil van dijk", "vvd"] },
      { name: "Frenkie de Jong", flag: "🇳🇱", position: MIDDEN, accept: ["de jong", "frenkie de jong", "frenkie"] },
      { name: "Memphis Depay", flag: "🇳🇱", position: AANVALLER, accept: ["depay", "memphis", "memphis depay"] },
      { name: "Ruud van Nistelrooy", flag: "🇳🇱", position: AANVALLER, accept: ["van nistelrooy", "nistelrooy", "ruud van nistelrooy"] },
    ],
  },
];

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

/** The full (answer-bearing) data for a category, or undefined. */
export function categoryData(key: string): VoetbalCategoryData | undefined {
  return BY_KEY.get(key);
}
