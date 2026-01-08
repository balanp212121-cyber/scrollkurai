import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * APPLY POWER-UP EDGE FUNCTION
 * 
 * This function activates a strategic power-up for the user.
 * It is 100% backend-authoritative, atomic, and idempotent.
 * 
 * Guarantees:
 * - Power-ups are logged in domain_events
 * - Duplicate activations return SUCCESS (idempotent)
 * - Cooldown is enforced server-side
 * - Power-ups never corrupt quest state
 */
Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    let userId: string | null = null;
    let powerupId: string | null = null;

    try {
        // === 1. VALIDATE AUTH ===
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('[apply-powerup] No authorization header');
            return new Response(
                JSON.stringify({
                    error: 'Authorization required',
                    error_code: 'AUTH_REQUIRED'
                }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: { headers: { Authorization: authHeader } },
            }
        );

        // Get current user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            console.error('[apply-powerup] Auth error:', userError);
            return new Response(
                JSON.stringify({
                    error: 'Unauthorized',
                    error_code: 'UNAUTHORIZED'
                }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        userId = user.id;

        // === 2. VALIDATE INPUTS ===
        const body = await req.json();
        powerupId = body.powerup_id;

        if (!powerupId || typeof powerupId !== 'string') {
            console.error('[apply-powerup] Invalid powerup_id:', powerupId);
            return new Response(
                JSON.stringify({
                    error: 'powerup_id is required',
                    error_code: 'INVALID_INPUT'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate powerup_id against known IDs
        const validPowerups = ['blood_oath', 'shadow_clone', 'time_dilation', 'phoenix_flame'];
        if (!validPowerups.includes(powerupId)) {
            console.error('[apply-powerup] Unknown powerup_id:', powerupId);
            return new Response(
                JSON.stringify({
                    error: 'Invalid power-up ID',
                    error_code: 'INVALID_POWERUP'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[apply-powerup] Processing: user=${userId}, powerup_id=${powerupId}`);

        // === 3. CALL ATOMIC RPC ===
        const { data: result, error: rpcError } = await supabaseClient.rpc('use_powerup_atomic', {
            p_user_id: userId,
            p_powerup_id: powerupId,
        });

        if (rpcError) {
            console.error('[apply-powerup] RPC error:', rpcError);
            return new Response(
                JSON.stringify({
                    error: 'Failed to apply power-up. Please try again.',
                    error_code: 'RPC_ERROR',
                    details: rpcError.message
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // === 4. HANDLE RPC RESULT ===
        if (!result || !result.success) {
            const errorCode = result?.error_code || 'UNKNOWN';
            const errorMessage = result?.error || 'Power-up activation failed';

            // Map error codes to HTTP status codes
            const statusMap: Record<string, number> = {
                'POWERUP_NOT_FOUND': 404,
                'COOLDOWN_ACTIVE': 429,
                'INTERNAL_ERROR': 500,
            };

            console.error(`[apply-powerup] Failed: code=${errorCode}, msg=${errorMessage}`);

            return new Response(
                JSON.stringify({
                    error: errorMessage,
                    error_code: errorCode,
                    available_at: result?.available_at
                }),
                { status: statusMap[errorCode] || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // === 5. LOG SUCCESS & RETURN ===
        const executionTime = Date.now() - startTime;
        console.log(`[apply-powerup] SUCCESS: user=${userId}, powerup_id=${powerupId}, idempotent=${result.idempotent}, time=${executionTime}ms`);

        return new Response(
            JSON.stringify({
                success: true,
                powerup: result.powerup,
                idempotent: result.idempotent,
                expires_at: result.expires_at,
                message: result.message || 'Power-up activated successfully'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`[apply-powerup] EXCEPTION: user=${userId}, powerup_id=${powerupId}, time=${executionTime}ms, error=`, error);

        return new Response(
            JSON.stringify({
                error: 'An unexpected error occurred. Please try again.',
                error_code: 'INTERNAL_EXCEPTION'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
