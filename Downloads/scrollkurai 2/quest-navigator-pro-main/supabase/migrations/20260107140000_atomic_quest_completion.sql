-- =============================================
-- ATOMIC QUEST COMPLETION RPC
-- Guarantees all-or-nothing quest completion
-- =============================================

CREATE OR REPLACE FUNCTION complete_quest_atomic(
    p_user_id UUID,
    p_log_id UUID,
    p_reflection_text TEXT,
    p_is_golden_quest BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quest_log RECORD;
    v_profile RECORD;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_new_streak INT;
    v_streak_lost_at TIMESTAMPTZ := NULL;
    v_last_streak_count INT := NULL;
    v_base_xp INT := 250;
    v_streak_bonus INT;
    v_total_xp INT;
    v_new_total_xp INT;
    v_new_level INT;
    v_xp_booster_applied BOOLEAN := FALSE;
    v_streak_freeze_used BOOLEAN := FALSE;
    v_streak_freeze_active BOOLEAN;
    v_streak_freeze_expires_at TIMESTAMPTZ;
    v_xp_booster_active BOOLEAN;
    v_xp_booster_started_at TIMESTAMPTZ;
    v_xp_booster_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. VERIFY QUEST LOG EXISTS AND BELONGS TO USER
    SELECT * INTO v_quest_log
    FROM user_quest_log
    WHERE id = p_log_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Quest not found or does not belong to you',
            'error_code', 'QUEST_NOT_FOUND'
        );
    END IF;

    -- 2. CHECK IF ALREADY COMPLETED
    IF v_quest_log.completed_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Quest already completed',
            'error_code', 'ALREADY_COMPLETED'
        );
    END IF;

    -- 3. GET CURRENT PROFILE
    SELECT * INTO v_profile
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found',
            'error_code', 'PROFILE_NOT_FOUND'
        );
    END IF;

    -- 4. HANDLE STREAK FREEZE EXPIRY
    v_streak_freeze_active := v_profile.streak_freeze_active;
    v_streak_freeze_expires_at := v_profile.streak_freeze_expires_at;

    IF v_streak_freeze_active AND v_streak_freeze_expires_at IS NOT NULL THEN
        IF NOW() >= v_streak_freeze_expires_at THEN
            v_streak_freeze_active := FALSE;
            v_streak_freeze_expires_at := NULL;
        END IF;
    END IF;

    -- 5. CALCULATE STREAK
    IF v_profile.last_quest_date IS NULL THEN
        -- First quest ever
        v_new_streak := 1;
        v_streak_lost_at := NULL;
        v_last_streak_count := NULL;
    ELSIF v_profile.last_quest_date = v_yesterday THEN
        -- Consecutive day - streak continues
        v_new_streak := v_profile.streak + 1;
        v_streak_lost_at := NULL;
        v_last_streak_count := NULL;
    ELSIF v_profile.last_quest_date = v_today THEN
        -- Same day - streak unchanged (shouldn't happen but handle gracefully)
        v_new_streak := v_profile.streak;
    ELSE
        -- Gap detected - check streak freeze
        IF v_streak_freeze_active THEN
            -- Freeze protects streak
            v_new_streak := v_profile.streak + 1;
            v_streak_freeze_active := FALSE;
            v_streak_freeze_expires_at := NULL;
            v_streak_freeze_used := TRUE;
        ELSE
            -- Streak broken
            IF v_profile.streak > 1 THEN
                v_streak_lost_at := NOW();
                v_last_streak_count := v_profile.streak;
            END IF;
            v_new_streak := 1;
        END IF;
    END IF;

    -- 6. CALCULATE XP
    v_streak_bonus := v_new_streak * 10;
    v_total_xp := v_base_xp + v_streak_bonus;

    -- Check XP Booster
    v_xp_booster_active := v_profile.xp_booster_active;
    v_xp_booster_started_at := v_profile.xp_booster_started_at;
    v_xp_booster_expires_at := v_profile.xp_booster_expires_at;

    IF v_xp_booster_active AND v_xp_booster_expires_at IS NOT NULL THEN
        IF NOW() < v_xp_booster_expires_at THEN
            v_total_xp := v_total_xp * 2;
            v_xp_booster_applied := TRUE;
        ELSE
            -- Expired
            v_xp_booster_active := FALSE;
            v_xp_booster_started_at := NULL;
            v_xp_booster_expires_at := NULL;
        END IF;
    END IF;

    -- Golden Quest 3x multiplier
    IF p_is_golden_quest THEN
        v_total_xp := v_total_xp * 3;
    END IF;

    v_new_total_xp := v_profile.xp + v_total_xp;
    v_new_level := FLOOR(v_new_total_xp / 1000) + 1;

    -- 7. UPDATE QUEST LOG (ATOMIC)
    UPDATE user_quest_log
    SET
        completed_at = NOW(),
        reflection_text = p_reflection_text,
        xp_awarded = v_total_xp
    WHERE id = p_log_id;

    -- 8. UPDATE PROFILE (ATOMIC)
    UPDATE profiles
    SET
        xp = v_new_total_xp,
        level = v_new_level,
        streak = v_new_streak,
        last_quest_date = v_today,
        total_quests_completed = total_quests_completed + 1,
        streak_lost_at = v_streak_lost_at,
        last_streak_count = v_last_streak_count,
        xp_booster_active = v_xp_booster_active,
        xp_booster_started_at = v_xp_booster_started_at,
        xp_booster_expires_at = v_xp_booster_expires_at,
        streak_freeze_active = v_streak_freeze_active,
        streak_freeze_expires_at = v_streak_freeze_expires_at
    WHERE id = p_user_id;

    -- 9. RETURN SUCCESS
    RETURN jsonb_build_object(
        'success', true,
        'xp_awarded', v_total_xp,
        'streak', v_new_streak,
        'total_xp', v_new_total_xp,
        'level', v_new_level,
        'xp_booster_applied', v_xp_booster_applied,
        'streak_freeze_used', v_streak_freeze_used
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Something went wrong, your streak is safe. Please try again.',
            'error_code', 'INTERNAL_ERROR',
            'details', SQLERRM
        );
END;
$$;
