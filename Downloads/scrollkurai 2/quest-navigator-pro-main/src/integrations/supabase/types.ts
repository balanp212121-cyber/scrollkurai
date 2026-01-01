export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_goal_usage: {
        Row: {
          created_at: string
          generated_at: string
          goal_content: string | null
          goal_month: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          goal_content?: string | null
          goal_month: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          goal_content?: string | null
          goal_month?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string | null
          description: string
          icon: string
          id: string
          is_premium_only: boolean
          name: string
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          created_at?: string | null
          description: string
          icon: string
          id?: string
          is_premium_only?: boolean
          name: string
          requirement_type: string
          requirement_value: number
        }
        Update: {
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          is_premium_only?: boolean
          name?: string
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          baseline_quests: number | null
          baseline_streak: number | null
          baseline_xp: number | null
          challenge_id: string
          completed: boolean | null
          current_progress: number | null
          duo_partner_id: string | null
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          baseline_quests?: number | null
          baseline_streak?: number | null
          baseline_xp?: number | null
          challenge_id: string
          completed?: boolean | null
          current_progress?: number | null
          duo_partner_id?: string | null
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          baseline_quests?: number | null
          baseline_streak?: number | null
          baseline_xp?: number | null
          challenge_id?: string
          completed?: boolean | null
          current_progress?: number | null
          duo_partner_id?: string | null
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_rewards: {
        Row: {
          awarded_at: string
          badge_awarded: string | null
          challenge_id: string
          id: string
          user_id: string
          xp_awarded: number | null
        }
        Insert: {
          awarded_at?: string
          badge_awarded?: string | null
          challenge_id: string
          id?: string
          user_id: string
          xp_awarded?: number | null
        }
        Update: {
          awarded_at?: string
          badge_awarded?: string | null
          challenge_id?: string
          id?: string
          user_id?: string
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_rewards_badge_awarded_fkey"
            columns: ["badge_awarded"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_rewards_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: string
          created_at: string
          creator_id: string
          description: string
          duration_days: number
          ends_at: string
          id: string
          is_public: boolean | null
          reward_badge_id: string | null
          reward_xp: number | null
          starts_at: string
          target_type: string
          target_value: number
          title: string
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          creator_id: string
          description: string
          duration_days?: number
          ends_at: string
          id?: string
          is_public?: boolean | null
          reward_badge_id?: string | null
          reward_xp?: number | null
          starts_at?: string
          target_type: string
          target_value: number
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          creator_id?: string
          description?: string
          duration_days?: number
          ends_at?: string
          id?: string
          is_public?: boolean | null
          reward_badge_id?: string | null
          reward_xp?: number | null
          starts_at?: string
          target_type?: string
          target_value?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_reward_badge_id_fkey"
            columns: ["reward_badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean | null
          likes_count: number | null
          quest_content: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          likes_count?: number | null
          quest_content?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          likes_count?: number | null
          quest_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      league_participations: {
        Row: {
          badge_awarded: string | null
          created_at: string | null
          demoted: boolean | null
          id: string
          league_tier: Database["public"]["Enums"]["league_tier"]
          promoted: boolean | null
          rank: number | null
          user_id: string
          week_id: string
          xp_earned: number
        }
        Insert: {
          badge_awarded?: string | null
          created_at?: string | null
          demoted?: boolean | null
          id?: string
          league_tier: Database["public"]["Enums"]["league_tier"]
          promoted?: boolean | null
          rank?: number | null
          user_id: string
          week_id: string
          xp_earned?: number
        }
        Update: {
          badge_awarded?: string | null
          created_at?: string | null
          demoted?: boolean | null
          id?: string
          league_tier?: Database["public"]["Enums"]["league_tier"]
          promoted?: boolean | null
          rank?: number | null
          user_id?: string
          week_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_participations_badge_awarded_fkey"
            columns: ["badge_awarded"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_participations_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "league_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      league_weeks: {
        Row: {
          created_at: string | null
          id: string
          processed: boolean | null
          processed_at: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          created_at: string | null
          id: string
          min_rank: number
          name: string
          tier: Database["public"]["Enums"]["league_tier"]
          xp_multiplier: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_rank: number
          name: string
          tier: Database["public"]["Enums"]["league_tier"]
          xp_multiplier?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          min_rank?: number
          name?: string
          tier?: Database["public"]["Enums"]["league_tier"]
          xp_multiplier?: number
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          lesson_id: string
          progress_percent: number
          started_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          lesson_id: string
          progress_percent?: number
          started_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          lesson_id?: string
          progress_percent?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "premium_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          created_at: string
          event_context: Json | null
          event_type: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_context?: Json | null
          event_type: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_context?: Json | null
          event_type?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          community_activity: boolean | null
          created_at: string
          daily_quest_reminder: boolean | null
          friend_challenge: boolean | null
          id: string
          notification_frequency: string | null
          streak_reminder: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          community_activity?: boolean | null
          created_at?: string
          daily_quest_reminder?: boolean | null
          friend_challenge?: boolean | null
          id?: string
          notification_frequency?: string | null
          streak_reminder?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          community_activity?: boolean | null
          created_at?: string
          daily_quest_reminder?: boolean | null
          friend_challenge?: boolean | null
          id?: string
          notification_frequency?: string | null
          streak_reminder?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          skipped: boolean | null
          step_completed: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          skipped?: boolean | null
          step_completed?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          skipped?: boolean | null
          step_completed?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_proof_audit: {
        Row: {
          action: string
          admin_note: string | null
          created_at: string
          id: string
          proof_id: string
          reviewer_id: string
        }
        Insert: {
          action: string
          admin_note?: string | null
          created_at?: string
          id?: string
          proof_id: string
          reviewer_id: string
        }
        Update: {
          action?: string
          admin_note?: string | null
          created_at?: string
          id?: string
          proof_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proof_audit_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "payment_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          admin_note: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_id: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          item_name: string
          item_type: string
          payment_method: string
          receipt_data: Json | null
          status: string
          transaction_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          item_name: string
          item_type: string
          payment_method: string
          receipt_data?: Json | null
          status?: string
          transaction_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          item_name?: string
          item_type?: string
          payment_method?: string
          receipt_data?: Json | null
          status?: string
          transaction_date?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      power_ups: {
        Row: {
          created_at: string
          description: string
          effect_type: string
          effect_value: number
          icon: string
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          description: string
          effect_type: string
          effect_value: number
          icon: string
          id?: string
          name: string
          price: number
        }
        Update: {
          created_at?: string
          description?: string
          effect_type?: string
          effect_value?: number
          icon?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      premium_lessons: {
        Row: {
          category: string
          created_at: string
          description: string
          duration_minutes: number
          id: string
          order_index: number
          title: string
          video_url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          duration_minutes: number
          id?: string
          order_index?: number
          title: string
          video_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          order_index?: number
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      premium_themes: {
        Row: {
          color_accent: string
          color_background: string
          color_primary: string
          created_at: string
          description: string
          display_name: string
          id: string
          is_premium_only: boolean
          name: string
          preview_image: string | null
        }
        Insert: {
          color_accent: string
          color_background: string
          color_primary: string
          created_at?: string
          description: string
          display_name: string
          id?: string
          is_premium_only?: boolean
          name: string
          preview_image?: string | null
        }
        Update: {
          color_accent?: string
          color_background?: string
          color_primary?: string
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          is_premium_only?: boolean
          name?: string
          preview_image?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          archetype: string
          brain_rot_score: number | null
          created_at: string
          id: string
          last_quest_date: string | null
          last_streak_count: number | null
          level: number
          premium_status: boolean | null
          quiz_completed: boolean | null
          streak: number
          streak_freeze_active: boolean | null
          streak_freeze_expires_at: string | null
          streak_lost_at: string | null
          total_quests_completed: number
          updated_at: string
          username: string | null
          xp: number
          xp_booster_active: boolean | null
          xp_booster_expires_at: string | null
          xp_booster_started_at: string | null
        }
        Insert: {
          archetype?: string
          brain_rot_score?: number | null
          created_at?: string
          id: string
          last_quest_date?: string | null
          last_streak_count?: number | null
          level?: number
          premium_status?: boolean | null
          quiz_completed?: boolean | null
          streak?: number
          streak_freeze_active?: boolean | null
          streak_freeze_expires_at?: string | null
          streak_lost_at?: string | null
          total_quests_completed?: number
          updated_at?: string
          username?: string | null
          xp?: number
          xp_booster_active?: boolean | null
          xp_booster_expires_at?: string | null
          xp_booster_started_at?: string | null
        }
        Update: {
          archetype?: string
          brain_rot_score?: number | null
          created_at?: string
          id?: string
          last_quest_date?: string | null
          last_streak_count?: number | null
          level?: number
          premium_status?: boolean | null
          quiz_completed?: boolean | null
          streak?: number
          streak_freeze_active?: boolean | null
          streak_freeze_expires_at?: string | null
          streak_lost_at?: string | null
          total_quests_completed?: number
          updated_at?: string
          username?: string | null
          xp?: number
          xp_booster_active?: boolean | null
          xp_booster_expires_at?: string | null
          xp_booster_started_at?: string | null
        }
        Relationships: []
      }
      push_notification_tokens: {
        Row: {
          created_at: string
          id: string
          push_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          push_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          push_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          content: string
          created_at: string
          id: string
          reflection_prompt: string
          target_archetype: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reflection_prompt: string
          target_archetype: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reflection_prompt?: string
          target_archetype?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      reflections_analysis: {
        Row: {
          created_at: string
          id: string
          insights: string | null
          sentiment_score: number | null
          suggested_next_quest: string | null
          user_quest_log_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: string | null
          sentiment_score?: number | null
          suggested_next_quest?: string | null
          user_quest_log_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: string | null
          sentiment_score?: number | null
          suggested_next_quest?: string | null
          user_quest_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_analysis_user_quest_log_id_fkey"
            columns: ["user_quest_log_id"]
            isOneToOne: false
            referencedRelation: "user_quest_log"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          role: string
          target_user_id: string
          target_username: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          role: string
          target_user_id: string
          target_username?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          role?: string
          target_user_id?: string
          target_username?: string | null
        }
        Relationships: []
      }
      streak_override_audit: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          previous_streak: number
          reason: string
          restored_streak: number
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          previous_streak?: number
          reason?: string
          restored_streak: number
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          previous_streak?: number
          reason?: string
          restored_streak?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          started_at: string
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tier?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      team_challenge_progress: {
        Row: {
          baseline_data: Json | null
          challenge_id: string
          completed: boolean
          completed_at: string | null
          current_progress: number
          id: string
          joined_at: string
          team_id: string
        }
        Insert: {
          baseline_data?: Json | null
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          current_progress?: number
          id?: string
          joined_at?: string
          team_id: string
        }
        Update: {
          baseline_data?: Json | null
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          current_progress?: number
          id?: string
          joined_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "team_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_challenge_progress_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_challenges: {
        Row: {
          created_at: string
          description: string
          duration_days: number
          ends_at: string
          id: string
          reward_badge_id: string | null
          reward_xp: number | null
          starts_at: string
          target_type: string
          target_value: number
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          duration_days?: number
          ends_at: string
          id?: string
          reward_badge_id?: string | null
          reward_xp?: number | null
          starts_at?: string
          target_type: string
          target_value: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_days?: number
          ends_at?: string
          id?: string
          reward_badge_id?: string | null
          reward_xp?: number | null
          starts_at?: string
          target_type?: string
          target_value?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_challenges_reward_badge_id_fkey"
            columns: ["reward_badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          id: string
          max_members: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          max_members?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          max_members?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_analytics_daily: {
        Row: {
          created_at: string
          date: string
          id: string
          quests_completed: number | null
          streak: number | null
          time_saved_minutes: number | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          quests_completed?: number | null
          streak?: number | null
          time_saved_minutes?: number | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          quests_completed?: number | null
          streak?: number | null
          time_saved_minutes?: number | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: []
      }
      user_avatars: {
        Row: {
          avatar_preset: string | null
          avatar_type: string
          avatar_url: string | null
          border_color: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_preset?: string | null
          avatar_type?: string
          avatar_url?: string | null
          border_color?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_preset?: string | null
          avatar_type?: string
          avatar_url?: string | null
          border_color?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          created_at: string
          current_baseline: number | null
          goal_type: string
          id: string
          is_active: boolean | null
          progress: number | null
          target_app: string | null
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_baseline?: number | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          progress?: number | null
          target_app?: string | null
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_baseline?: number | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          progress?: number | null
          target_app?: string | null
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_leagues: {
        Row: {
          id: string
          joined_at: string | null
          league_tier: Database["public"]["Enums"]["league_tier"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          league_tier?: Database["public"]["Enums"]["league_tier"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          league_tier?: Database["public"]["Enums"]["league_tier"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_milestones: {
        Row: {
          achieved_at: string
          created_at: string
          id: string
          milestone_type: string
          milestone_value: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          id?: string
          milestone_type: string
          milestone_value: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          created_at?: string
          id?: string
          milestone_type?: string
          milestone_value?: number
          user_id?: string
        }
        Relationships: []
      }
      user_power_ups: {
        Row: {
          id: string
          power_up_id: string
          purchased_at: string
          quantity: number
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          power_up_id: string
          purchased_at?: string
          quantity?: number
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          power_up_id?: string
          purchased_at?: string
          quantity?: number
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_power_ups_power_up_id_fkey"
            columns: ["power_up_id"]
            isOneToOne: false
            referencedRelation: "power_ups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quest_log: {
        Row: {
          assigned_at: string
          completed_at: string | null
          created_at: string
          id: string
          quest_id: string
          reflection_text: string | null
          user_id: string
          xp_awarded: number | null
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          quest_id: string
          reflection_text?: string | null
          user_id: string
          xp_awarded?: number | null
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          quest_id?: string
          reflection_text?: string | null
          user_id?: string
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_quest_log_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_theme_selection: {
        Row: {
          id: string
          selected_at: string
          theme_id: string
          user_id: string
        }
        Insert: {
          id?: string
          selected_at?: string
          theme_id: string
          user_id: string
        }
        Update: {
          id?: string
          selected_at?: string
          theme_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_theme_selection_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "premium_themes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_community_posts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          is_anonymous: boolean | null
          likes_count: number | null
          quest_content: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          is_anonymous?: boolean | null
          likes_count?: number | null
          quest_content?: string | null
          user_id?: never
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          is_anonymous?: boolean | null
          likes_count?: number | null
          quest_content?: string | null
          user_id?: never
        }
        Relationships: []
      }
    }
    Functions: {
      decrement_likes: { Args: { post_id: string }; Returns: undefined }
      get_community_posts: {
        Args: { limit_count?: number; offset_count?: number }
        Returns: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          likes_count: number
          quest_content: string
          user_id: string
        }[]
      }
      get_current_league_week: { Args: never; Returns: string }
      get_league_leaderboard: {
        Args: {
          league_tier_param: Database["public"]["Enums"]["league_tier"]
          week_id_param?: string
        }
        Returns: {
          league_tier: Database["public"]["Enums"]["league_tier"]
          rank: number
          user_id: string
          username: string
          xp_earned: number
        }[]
      }
      get_post_like_count: { Args: { post_id_param: string }; Returns: number }
      get_profiles_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          archetype: string
          id: string
          level: number
          streak: number
          username: string
          xp: number
        }[]
      }
      get_profiles_by_ids_admin: {
        Args: { user_ids: string[] }
        Returns: {
          archetype: string
          id: string
          level: number
          streak: number
          username: string
          xp: number
        }[]
      }
      get_public_challenges: {
        Args: never
        Returns: {
          challenge_type: string
          description: string
          duration_days: number
          ends_at: string
          id: string
          is_public: boolean
          reward_xp: number
          starts_at: string
          target_type: string
          target_value: number
          title: string
        }[]
      }
      get_public_profiles: {
        Args: { limit_count?: number; order_by?: string }
        Returns: {
          archetype: string
          id: string
          level: number
          streak: number
          username: string
          xp: number
        }[]
      }
      get_team_member_profiles: {
        Args: { team_id_param: string }
        Returns: {
          archetype: string
          level: number
          premium_status: boolean
          streak: number
          total_quests_completed: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      get_user_avatar: {
        Args: { user_id_param: string }
        Returns: {
          avatar_preset: string
          avatar_type: string
          avatar_url: string
          border_color: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_user_liked_post: { Args: { post_id_param: string }; Returns: boolean }
      increment_likes: { Args: { post_id: string }; Returns: undefined }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      search_users_by_username: {
        Args: { search_term: string }
        Returns: {
          id: string
          level: number
          username: string
        }[]
      }
      set_premium_status: {
        Args: { new_status: boolean; target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      league_tier: "bronze" | "silver" | "gold" | "platinum" | "diamond"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      league_tier: ["bronze", "silver", "gold", "platinum", "diamond"],
    },
  },
} as const
