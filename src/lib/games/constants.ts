/**
 * Daily bibcoins paid to the reigning Snake King (the room's top HONEST snake
 * score). Keep in sync with the 1000 in supabase/migrations/0047_snake_king.sql.
 */
export const SNAKE_KING_REWARD = 1000;

/**
 * Daily bibcoins paid to the reigning King of each non-Snake skill game
 * (Flappy / Tetris / 2048 / Pet Connect / USA Staten). Keep in sync with the
 * 500 in supabase/migrations/0051_game_kings.sql + 0060_usstates_king.sql.
 */
export const GAME_KING_REWARD = 500;
