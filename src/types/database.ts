/**
 * Hand-written database types matching `supabase/migrations/0001_init.sql`.
 *
 * Shaped like the Supabase CLI output (`public.Tables.<name>.{Row,Insert,Update}`)
 * so it can be passed as the generic to `createServerClient`/`createBrowserClient`.
 * Kept manual for v1 — regenerate via the CLI once the schema stabilises.
 */

// --- Domain enums (mirror the CHECK constraints in SQL) ---

export type ProposalType = "lunch" | "dinner" | "coffee" | "other";
export type VoteValue = "yes" | "maybe" | "no";
export type PresenceStatus = "studying" | "break" | "lunch" | "away" | "done";

// --- Helper aliases ---

type Timestamp = string; // ISO 8601 timestamptz
type DateString = string; // YYYY-MM-DD
type TimeString = string; // HH:MM[:SS]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          display_name_changed_on: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          notify_proposals: boolean;
          notify_chat: boolean;
          notify_comments: boolean;
          notify_votes: boolean;
          created_at: Timestamp;
        };
        Insert: {
          id: string;
          display_name: string;
          display_name_changed_on?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          notify_proposals?: boolean;
          notify_chat?: boolean;
          notify_comments?: boolean;
          notify_votes?: boolean;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          display_name?: string;
          display_name_changed_on?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          notify_proposals?: boolean;
          notify_chat?: boolean;
          notify_comments?: boolean;
          notify_votes?: boolean;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          join_code: string;
          owner_id: string;
          created_at: Timestamp;
          lat: number | null;
          lng: number | null;
          radius_m: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          join_code: string;
          owner_id: string;
          created_at?: Timestamp;
          lat?: number | null;
          lng?: number | null;
          radius_m?: number;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          join_code?: string;
          owner_id?: string;
          created_at?: Timestamp;
          lat?: number | null;
          lng?: number | null;
          radius_m?: number;
        };
        Relationships: [];
      };
      room_members: {
        Row: {
          room_id: string;
          user_id: string;
          joined_at: Timestamp;
        };
        Insert: {
          room_id: string;
          user_id: string;
          joined_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          joined_at?: Timestamp;
        };
        Relationships: [];
      };
      break_proposals: {
        Row: {
          id: string;
          room_id: string;
          created_by: string;
          proposal_type: ProposalType;
          proposal_date: DateString;
          start_time: TimeString;
          duration_minutes: number;
          note: string | null;
          slot_key: string | null;
          destination: string | null;
          is_walk: boolean;
          route_points: { lat: number; lng: number }[] | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          created_by: string;
          proposal_type: ProposalType;
          proposal_date: DateString;
          start_time: TimeString;
          duration_minutes: number;
          note?: string | null;
          slot_key?: string | null;
          destination?: string | null;
          is_walk?: boolean;
          route_points?: { lat: number; lng: number }[] | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          created_by?: string;
          proposal_type?: ProposalType;
          proposal_date?: DateString;
          start_time?: TimeString;
          duration_minutes?: number;
          note?: string | null;
          slot_key?: string | null;
          destination?: string | null;
          is_walk?: boolean;
          route_points?: { lat: number; lng: number }[] | null;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      room_places: {
        Row: {
          id: string;
          room_id: string;
          name: string;
          is_walk: boolean;
          points: { lat: number; lng: number }[] | null;
          created_by: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          name: string;
          is_walk?: boolean;
          points?: { lat: number; lng: number }[] | null;
          created_by?: string | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          name?: string;
          is_walk?: boolean;
          points?: { lat: number; lng: number }[] | null;
          created_by?: string | null;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          proposal_id: string;
          user_id: string;
          vote: VoteValue;
          voted_at: Timestamp;
        };
        Insert: {
          proposal_id: string;
          user_id: string;
          vote: VoteValue;
          voted_at?: Timestamp;
        };
        Update: {
          proposal_id?: string;
          user_id?: string;
          vote?: VoteValue;
          voted_at?: Timestamp;
        };
        Relationships: [];
      };
      presence: {
        Row: {
          room_id: string;
          user_id: string;
          status: PresenceStatus;
          back_at: TimeString | null;
          updated_at: Timestamp;
          at_location: boolean | null;
          location_checked_at: Timestamp | null;
          checked_in_on: string | null;
        };
        Insert: {
          room_id: string;
          user_id: string;
          status: PresenceStatus;
          back_at?: TimeString | null;
          updated_at?: Timestamp;
          at_location?: boolean | null;
          location_checked_at?: Timestamp | null;
          checked_in_on?: string | null;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          status?: PresenceStatus;
          back_at?: TimeString | null;
          updated_at?: Timestamp;
          at_location?: boolean | null;
          location_checked_at?: Timestamp | null;
          checked_in_on?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          author_id: string;
          content: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          author_id: string;
          content: string;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          author_id?: string;
          content?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      proposal_comments: {
        Row: {
          id: string;
          proposal_id: string;
          room_id: string;
          author_id: string;
          content: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          room_id: string;
          author_id: string;
          content: string;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          room_id?: string;
          author_id?: string;
          content?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          endpoint: string;
          user_id: string;
          p256dh: string;
          auth: string;
          created_at: Timestamp;
        };
        Insert: {
          endpoint: string;
          user_id: string;
          p256dh: string;
          auth: string;
          created_at?: Timestamp;
        };
        Update: {
          endpoint?: string;
          user_id?: string;
          p256dh?: string;
          auth?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          room_id: string;
          created_at: Timestamp;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
          room_id: string;
          created_at?: Timestamp;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          emoji?: string;
          room_id?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      instant_break_pushes: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          duration_minutes: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          duration_minutes: number;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          duration_minutes?: number;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      instant_breaks: {
        Row: {
          id: string;
          room_id: string;
          triggered_by: string;
          duration_minutes: number;
          started_at: Timestamp;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          triggered_by: string;
          duration_minutes: number;
          started_at?: Timestamp;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          triggered_by?: string;
          duration_minutes?: number;
          started_at?: Timestamp;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      poker_tables: {
        Row: {
          room_id: string;
          state: Record<string, unknown>;
          version: number;
          updated_at: Timestamp;
        };
        Insert: {
          room_id: string;
          state: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          state?: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      poker_private: {
        Row: { room_id: string; hand_no: number; deck: string[] };
        Insert: { room_id: string; hand_no: number; deck: string[] };
        Update: { room_id?: string; hand_no?: number; deck?: string[] };
        Relationships: [];
      };
      poker_hole_cards: {
        Row: {
          room_id: string;
          hand_no: number;
          user_id: string;
          cards: string[];
        };
        Insert: {
          room_id: string;
          hand_no: number;
          user_id: string;
          cards: string[];
        };
        Update: {
          room_id?: string;
          hand_no?: number;
          user_id?: string;
          cards?: string[];
        };
        Relationships: [];
      };
      game_scores: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          game_key: string;
          score: number;
          cheated: boolean;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          game_key: string;
          score: number;
          cheated?: boolean;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          game_key?: string;
          score?: number;
          cheated?: boolean;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      room_leaderboard_settings: {
        Row: {
          room_id: string;
          show_cheated: boolean;
          updated_at: Timestamp;
        };
        Insert: {
          room_id: string;
          show_cheated?: boolean;
          updated_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          show_cheated?: boolean;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          user_id: string;
          bibcoins: number;
          last_hourly_at: Timestamp;
          last_daily_on: string | null;
        };
        Insert: {
          user_id: string;
          bibcoins?: number;
          last_hourly_at?: Timestamp;
          last_daily_on?: string | null;
        };
        Update: {
          user_id?: string;
          bibcoins?: number;
          last_hourly_at?: Timestamp;
          last_daily_on?: string | null;
        };
        Relationships: [];
      };
      bibcoin_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string;
          ref_key: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          reason: string;
          ref_key?: string;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          reason?: string;
          ref_key?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      user_cosmetics: {
        Row: { user_id: string; item_id: string; acquired_at: Timestamp };
        Insert: { user_id: string; item_id: string; acquired_at?: Timestamp };
        Update: { user_id?: string; item_id?: string; acquired_at?: Timestamp };
        Relationships: [];
      };
      user_loadout: {
        Row: {
          user_id: string;
          frame: string | null;
          name_color: string | null;
          badge: string | null;
          accessory: string | null;
          pet: string | null;
          title: string | null;
          effect: string | null;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          frame?: string | null;
          name_color?: string | null;
          badge?: string | null;
          accessory?: string | null;
          pet?: string | null;
          title?: string | null;
          effect?: string | null;
          updated_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          frame?: string | null;
          name_color?: string | null;
          badge?: string | null;
          accessory?: string | null;
          pet?: string | null;
          title?: string | null;
          effect?: string | null;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          unlocked_at: Timestamp;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
          unlocked_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: Timestamp;
        };
        Relationships: [];
      };
      blackjack_games: {
        Row: {
          user_id: string;
          state: Record<string, unknown>;
          version: number;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          state: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          state?: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      blackjack_tables: {
        Row: {
          room_id: string;
          state: Record<string, unknown>;
          version: number;
          updated_at: Timestamp;
        };
        Insert: {
          room_id: string;
          state: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          state?: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      blackjack_private: {
        Row: { room_id: string; state: Record<string, unknown> };
        Insert: { room_id: string; state: Record<string, unknown> };
        Update: { room_id?: string; state?: Record<string, unknown> };
        Relationships: [];
      };
      roulette_tables: {
        Row: {
          room_id: string;
          state: Record<string, unknown>;
          version: number;
          updated_at: Timestamp;
        };
        Insert: {
          room_id: string;
          state: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          state?: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      mines_games: {
        Row: {
          room_id: string;
          user_id: string;
          state: Record<string, unknown>;
          version: number;
          updated_at: Timestamp;
        };
        Insert: {
          room_id: string;
          user_id: string;
          state: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          state?: Record<string, unknown>;
          version?: number;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      mines_private: {
        Row: { room_id: string; user_id: string; mines: number[] };
        Insert: { room_id: string; user_id: string; mines: number[] };
        Update: { room_id?: string; user_id?: string; mines?: number[] };
        Relationships: [];
      };
      room_timeouts: {
        Row: {
          room_id: string;
          user_id: string;
          created_by: string | null;
          reason: string | null;
          created_at: Timestamp;
        };
        Insert: {
          room_id: string;
          user_id: string;
          created_by?: string | null;
          reason?: string | null;
          created_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          created_by?: string | null;
          reason?: string | null;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      step_sessions: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          steps: number;
          source: string;
          recorded_for: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          steps: number;
          source?: string;
          recorded_for?: string;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          steps?: number;
          source?: string;
          recorded_for?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      health_tokens: {
        Row: {
          user_id: string;
          token: string;
          created_at: Timestamp;
        };
        Insert: {
          user_id: string;
          token: string;
          created_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          token?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      join_room: {
        Args: { _code: string };
        Returns: string | null;
      };
      get_push_targets: {
        Args: { _room_id: string; _pref: string };
        Returns: { endpoint: string; p256dh: string; auth: string }[];
      };
      get_user_push_targets: {
        Args: { _user_id: string; _pref: string };
        Returns: { endpoint: string; p256dh: string; auth: string }[];
      };
      award_bibcoins: {
        Args: {
          _user_id: string;
          _amount: number;
          _reason: string;
          _ref?: string;
        };
        Returns: boolean;
      };
      spend_bibcoins: {
        Args: {
          _user_id: string;
          _amount: number;
          _reason: string;
          _ref?: string;
        };
        Returns: boolean;
      };
      claim_hourly_bibcoins: {
        Args: { _user_id: string };
        Returns: number;
      };
      claim_daily_bibcoins: {
        Args: { _user_id: string };
        Returns: number;
      };
      get_profile_stats: {
        Args: { _user_id: string };
        Returns: {
          bibcoins: number;
          proposals: number;
          comments: number;
          messages: number;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// --- Convenience row aliases for app code ---

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type RoomMember = Database["public"]["Tables"]["room_members"]["Row"];
export type BreakProposal =
  Database["public"]["Tables"]["break_proposals"]["Row"];
export type RoomPlace = Database["public"]["Tables"]["room_places"]["Row"];
export type Vote = Database["public"]["Tables"]["votes"]["Row"];
export type Presence = Database["public"]["Tables"]["presence"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type ProposalComment =
  Database["public"]["Tables"]["proposal_comments"]["Row"];
export type MessageReaction =
  Database["public"]["Tables"]["message_reactions"]["Row"];
export type InstantBreakPush =
  Database["public"]["Tables"]["instant_break_pushes"]["Row"];
export type InstantBreak =
  Database["public"]["Tables"]["instant_breaks"]["Row"];
export type PokerTableRow =
  Database["public"]["Tables"]["poker_tables"]["Row"];
export type GameScore = Database["public"]["Tables"]["game_scores"]["Row"];
export type RoomLeaderboardSettings =
  Database["public"]["Tables"]["room_leaderboard_settings"]["Row"];
export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type UserCosmetic =
  Database["public"]["Tables"]["user_cosmetics"]["Row"];
export type UserLoadout = Database["public"]["Tables"]["user_loadout"]["Row"];
export type UserAchievement =
  Database["public"]["Tables"]["user_achievements"]["Row"];
export type StepSession =
  Database["public"]["Tables"]["step_sessions"]["Row"];
export type HealthToken =
  Database["public"]["Tables"]["health_tokens"]["Row"];
