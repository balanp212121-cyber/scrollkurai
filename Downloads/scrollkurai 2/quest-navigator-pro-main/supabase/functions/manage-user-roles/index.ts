import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoleRequest {
  targetUserId: string;
  role: 'admin' | 'moderator' | 'user';
  action: 'add' | 'remove';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the requesting user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} attempting role management`);

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requesting user is an admin using the has_role function
    const { data: isAdmin, error: roleCheckError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleCheckError) {
      console.error('Error checking admin status:', roleCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.error(`User ${user.id} is not an admin, access denied`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { targetUserId, role, action }: RoleRequest = await req.json();

    // Validate input
    if (!targetUserId || !role || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: targetUserId, role, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['admin', 'moderator', 'user'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, moderator, or user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['add', 'remove'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be add or remove' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent admins from removing their own admin role
    if (action === 'remove' && role === 'admin' && targetUserId === user.id) {
      console.error('Admin attempted to remove their own admin role');
      return new Response(
        JSON.stringify({ error: 'Cannot remove your own admin role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target user exists
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('id', targetUserId)
      .single();

    if (profileError || !targetProfile) {
      console.error('Target user not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} ${action}ing role '${role}' for user ${targetUserId} (${targetProfile.username})`);

    if (action === 'add') {
      // Check if role already exists manually (to avoid 500 if unique constraint is missing)
      const { data: existingRole, error: checkError } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('role', role)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing role:', checkError);
        return new Response(
          JSON.stringify({ error: 'Failed to check existing role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!existingRole) {
        const { error: insertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: targetUserId, role: role });

        if (insertError) {
          console.error('Error adding role:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to add role' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log(`Role ${role} already exists for user ${targetUserId}, skipping insert.`);
      }

      // Log the audit entry
      await supabaseAdmin.from('role_audit_log').insert({
        admin_id: user.id,
        target_user_id: targetUserId,
        action: 'add',
        role: role,
        target_username: targetProfile.username
      });

      // Unified admin audit log
      try {
        await supabaseAdmin.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_action: 'role_change',
          p_target_type: 'user',
          p_target_id: targetUserId,
          p_metadata: { type: 'add', role: role, username: targetProfile.username }
        });
      } catch (e) { console.warn('Unified audit log failed:', e); }

      console.log(`Successfully added role '${role}' to user ${targetUserId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Role '${role}' added to user ${targetProfile.username}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Remove role from user
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', role);

      if (deleteError) {
        console.error('Error removing role:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to remove role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the audit entry
      await supabaseAdmin.from('role_audit_log').insert({
        admin_id: user.id,
        target_user_id: targetUserId,
        action: 'remove',
        role: role,
        target_username: targetProfile.username
      });

      // Unified admin audit log
      try {
        await supabaseAdmin.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_action: 'role_change',
          p_target_type: 'user',
          p_target_id: targetUserId,
          p_metadata: { type: 'remove', role: role, username: targetProfile.username }
        });
      } catch (e) { console.warn('Unified audit log failed:', e); }

      console.log(`Successfully removed role '${role}' from user ${targetUserId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Role '${role}' removed from user ${targetProfile.username}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
