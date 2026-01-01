import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's auth for permission check
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user (admin)
    const {
      data: { user: adminUser },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _role: 'admin',
      _user_id: adminUser.id,
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { target_user_id, restore_streak_count, reason } = await req.json();

    if (!target_user_id || !restore_streak_count) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get target user's current profile
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('streak, streak_lost_at, last_streak_count, username')
      .eq('id', target_user_id)
      .single();

    if (profileError || !targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const previousStreak = targetProfile.streak || 0;
    const today = new Date().toISOString().split('T')[0];

    // Restore the streak (bypassing 24-hour limit)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        streak: restore_streak_count,
        last_quest_date: today,
        streak_lost_at: null,
        last_streak_count: null,
      })
      .eq('id', target_user_id);

    if (updateError) {
      console.error('Error restoring streak:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to restore streak' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the admin override action
    const { error: auditError } = await supabaseAdmin
      .from('streak_override_audit')
      .insert({
        admin_id: adminUser.id,
        user_id: target_user_id,
        previous_streak: previousStreak,
        restored_streak: restore_streak_count,
        reason: reason || 'manual override',
      });

    if (auditError) {
      console.error('Error logging audit:', auditError);
      // Don't fail the request, streak is already restored
    }

    // Unified admin audit log (fire-and-forget)
    try {
      await supabaseAdmin.rpc('log_admin_action', {
        p_admin_user_id: adminUser.id,
        p_action: 'streak_restore',
        p_target_type: 'user',
        p_target_id: target_user_id,
        p_metadata: {
          previous_streak: previousStreak,
          restored_streak: restore_streak_count,
          reason: reason || 'manual override',
          username: targetProfile.username
        }
      });
    } catch (e) {
      console.warn('Unified audit log failed:', e);
    }

    console.log('Admin streak restore:', {
      adminId: adminUser.id,
      targetUserId: target_user_id,
      previousStreak,
      restoredStreak: restore_streak_count,
      reason,
    });

    return new Response(
      JSON.stringify({
        success: true,
        previous_streak: previousStreak,
        restored_streak: restore_streak_count,
        target_username: targetProfile.username,
        message: 'Streak restored successfully via admin override',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in admin-restore-streak:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
