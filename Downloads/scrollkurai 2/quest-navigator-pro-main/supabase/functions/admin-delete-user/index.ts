
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Check if the user is authenticated
        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser()

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        // Verify User IS Admin
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: isAdmin, error: roleCheckError } = await supabaseAdmin.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin'
        })

        if (roleCheckError || !isAdmin) {
            console.error('User is not admin or role check failed', roleCheckError)
            return new Response(
                JSON.stringify({ error: 'Forbidden: Admin access required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
        }

        // Get Request Body
        const { targetUserId, reason } = await req.json()
        if (!targetUserId) {
            return new Response(
                JSON.stringify({ error: 'Missing targetUserId' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Attempt to delete the user
        console.log(`Admin ${user.id} deleting user ${targetUserId}. Reason: ${reason || 'No reason provided'}`)

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

        if (deleteError) {
            console.error('Failed to delete user:', deleteError)
            return new Response(
                JSON.stringify({ error: deleteError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        // Log the action
        try {
            await supabaseAdmin.from('admin_audit_logs').insert({
                admin_id: user.id,
                action: 'delete_user',
                target_id: targetUserId,
                details: { reason: reason || 'Manual admin deletion' }
            })
        } catch (logError) {
            console.warn('Failed to log audit entry:', logError)
        }

        return new Response(
            JSON.stringify({ success: true, message: 'User deleted successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal Server Error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
