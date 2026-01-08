-- =============================================
-- CANONICAL POWER-UP SYSTEM MIGRATION (FINAL - PART 2b: Complete RPC)
-- =============================================

-- 5. RPC: complete_quest_atomic
CREATE OR REPLACE FUNCTION public.complete_quest_atomic(
    p_user_id UUID,
    p_log_id UUID,
    p_reflection_text TEXT,
    p_is_golden_quest BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_quest_log RECORD;
    v_profile RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_new_streak INT;
    v_streak_lost_at TIMESTAMPTZ := NULL;
    v_base_xp INT := 250;
    v_streak_bonus INT;
    v_total_xp INT;
    v_new_total_xp INT;
    v_new_level INT;
    v_xp_multiplier NUMERIC := 1.0;
    v_active_powerup_names TEXT[] := ARRAY[]::TEXT[];
    v_active_powerup RECORD;
BEGIN
    SELECT * INTO v_quest_log FROM public.user_quest_log WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Quest not found', 'error_code', 'QUEST_NOT_FOUND'); END IF;
    IF v_quest_log.status = 'completed' THEN RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Already completed'); END IF;
    IF v_quest_log.status != 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'Quest not accepted', 'error_code', 'QUEST_NOT_ACTIVE'); END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Profile not found', 'error_code', 'PROFILE_NOT_FOUND'); END IF;

    -- Apply Powerups
    FOR v_active_powerup IN
        SELECT p.name, p.effect
        FROM public.user_strategic_powerups usp
        JOIN public.strategic_powerups p ON usp.powerup_id = p.id
        WHERE usp.user_id = p_user_id AND usp.expires_at > v_now
    LOOP
        v_active_powerup_names := array_append(v_active_powerup_names, v_active_powerup.name);
        IF v_active_powerup.effect->>'xp_multiplier' IS NOT NULL THEN
            v_xp_multiplier := v_xp_multiplier * (v_active_powerup.effect->>'xp_multiplier')::NUMERIC;
        END IF;
    END LOOP;

    -- Streak
    IF v_profile.last_quest_date = v_today THEN v_new_streak := v_profile.streak;
    ELSIF v_profile.last_quest_date = v_yesterday THEN v_new_streak := v_profile.streak + 1;
    ELSE
         IF v_profile.streak > 0 THEN v_streak_lost_at := v_now; END IF;
         v_new_streak := 1;
    END IF;

    -- XP
    v_streak_bonus := v_new_streak * 10;
    v_total_xp := FLOOR((v_base_xp + v_streak_bonus) * v_xp_multiplier);
    IF p_is_golden_quest THEN v_total_xp := v_total_xp * 3; END IF;

    v_new_total_xp := v_profile.xp + v_total_xp;
    v_new_level := FLOOR(v_new_total_xp / 1000) + 1;

    -- Updates
    UPDATE public.user_quest_log SET status = 'completed', completed_at = v_now, reflection_text = p_reflection_text, xp_awarded = v_total_xp WHERE id = p_log_id;
    UPDATE public.profiles SET xp = v_new_total_xp, level = v_new_level, streak = v_new_streak, last_quest_date = v_today, total_quests_completed = total_quests_completed + 1 WHERE id = p_user_id;

    -- Event
    INSERT INTO public.domain_events (event_type, user_id, entity_type, entity_id, payload)
    VALUES ('quest_completed', p_user_id, 'user_quest_log', p_log_id, jsonb_build_object('xp', v_total_xp, 'streak', v_new_streak, 'active_powerups', v_active_powerup_names, 'multiplier', v_xp_multiplier));

    RETURN jsonb_build_object('success', true, 'xp_awarded', v_total_xp, 'streak', v_new_streak, 'active_powerups', v_active_powerup_names);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Completion failed', 'error_code', 'INTERNAL_ERROR', 'details', SQLERRM);
END;
$func$;


