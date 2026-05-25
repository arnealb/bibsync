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
          avatar_url: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
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
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          join_code: string;
          owner_id: string;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          join_code?: string;
          owner_id?: string;
          created_at?: Timestamp;
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
        };
        Insert: {
          room_id: string;
          user_id: string;
          status: PresenceStatus;
          back_at?: TimeString | null;
          updated_at?: Timestamp;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          status?: PresenceStatus;
          back_at?: TimeString | null;
          updated_at?: Timestamp;
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
    };
    Views: Record<never, never>;
    Functions: {
      join_room: {
        Args: { _code: string };
        Returns: string | null;
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
export type Vote = Database["public"]["Tables"]["votes"]["Row"];
export type Presence = Database["public"]["Tables"]["presence"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
