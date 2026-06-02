/**
 * SERVER-ONLY trivia questions. `correct` is the index into `options`. NEVER
 * import into a client component — the action sends options without revealing
 * which one is right.
 */
export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { q: "Welk land won het WK 2022 in Qatar?", options: ["Frankrijk", "Argentinië", "Brazilië", "Kroatië"], correct: 1 },
  { q: "Hoeveel spelers staan er per ploeg op het veld?", options: ["10", "11", "12", "9"], correct: 1 },
  { q: "Welke speler won de meeste Ballon d'Ors?", options: ["Cristiano Ronaldo", "Lionel Messi", "Johan Cruyff", "Michel Platini"], correct: 1 },
  { q: "Bij welke club speelde Lionel Messi het langst?", options: ["PSG", "Inter Miami", "FC Barcelona", "Newell's"], correct: 2 },
  { q: "Hoe lang duurt een reguliere voetbalwedstrijd?", options: ["80 minuten", "90 minuten", "100 minuten", "120 minuten"], correct: 1 },
  { q: "Welk land won het WK 2018 in Rusland?", options: ["Kroatië", "Duitsland", "Frankrijk", "België"], correct: 2 },
  { q: "Wie is de all-time topscorer van het Belgische nationale elftal?", options: ["Eden Hazard", "Romelu Lukaku", "Paul Van Himst", "Dries Mertens"], correct: 1 },
  { q: "Welke club staat bekend als 'The Red Devils'?", options: ["Liverpool", "Arsenal", "Manchester United", "Man City"], correct: 2 },
  { q: "In welk land speelt Ajax?", options: ["België", "Nederland", "Duitsland", "Denemarken"], correct: 1 },
  { q: "Hoeveel punten krijg je voor een overwinning in de competitie?", options: ["1", "2", "3", "4"], correct: 2 },
  { q: "Welke keeper speelt voor Real Madrid en België?", options: ["Jan Oblak", "Thibaut Courtois", "Alisson", "Marc-André ter Stegen"], correct: 1 },
  { q: "Wie scoorde de 'Hand of God'-goal in 1986?", options: ["Pelé", "Diego Maradona", "Zico", "Romário"], correct: 1 },
  { q: "Welke kleur kaart betekent uitsluiting?", options: ["Geel", "Rood", "Groen", "Blauw"], correct: 1 },
  { q: "Welke club won de meeste Champions League-titels?", options: ["FC Barcelona", "Bayern München", "Real Madrid", "AC Milan"], correct: 2 },
  { q: "Uit welk land komt Erling Haaland?", options: ["Zweden", "Denemarken", "Noorwegen", "IJsland"], correct: 2 },
  { q: "Hoe heet de Belgische hoogste voetbalcompetitie (kort)?", options: ["Eredivisie", "Pro League", "Bundesliga", "La Liga"], correct: 1 },
  { q: "Welke speler wordt 'CR7' genoemd?", options: ["Cristiano Ronaldo", "Ronaldinho", "Ronaldo Nazário", "Coutinho"], correct: 0 },
  { q: "Hoeveel minuten extra tijd is de standaard rust tussen twee helften?", options: ["10", "15", "20", "5"], correct: 1 },
  { q: "Welk land won als eerste vier WK's?", options: ["Duitsland", "Italië", "Brazilië", "Argentinië"], correct: 2 },
  { q: "Welke Nederlander wordt 'De Verlosser' / icoon nr. 14 genoemd?", options: ["Marco van Basten", "Johan Cruyff", "Ruud Gullit", "Dennis Bergkamp"], correct: 1 },
];

export function quizQuestion(index: number): QuizQuestion | undefined {
  return QUIZ_QUESTIONS[index];
}
