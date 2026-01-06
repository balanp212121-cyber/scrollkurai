import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { token } = await req.json();

        if (!token || typeof token !== 'string') {
            throw new Error('Invalid invite token');
        }

        console.log('User', user.id, 'attempting to join via invite token');

        // Call the RPC function which handles all validation
        const { data, error } = await supabaseClient.rpc('join_via_invite', {
            p_token: token
        });

        if (error) {
            console.error('Join via invite error:', error);
            throw new Error(error.message);
        }

        console.log('Join successful:', data);

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully joined ${data.team_type === 'duo' ? 'Duo' : 'Team'} "${data.team_name}"!`,
                team_name: data.team_name,
                team_type: data.team_type
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error) {
        console.error('Error in join-via-invite:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
