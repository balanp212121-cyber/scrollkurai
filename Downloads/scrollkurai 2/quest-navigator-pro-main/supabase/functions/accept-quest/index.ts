import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ACCEPT QUEST EDGE FUNCTION
 * 
 * This function transitions a quest from 'pending' to 'active' status.
 * It is 100% backend-authoritative, atomic, and idempotent.
 * 
 * Guarantees:
 * - Accept can never fail for valid state
 * - Duplicate accepts return SUCCESS (idempotent)
 * - No race condition possible (uses row-level locking in RPC)
 */
Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    let userId: string | null = null;
    let logId: string | null = null;

    try {
        // === 1. VALIDATE AUTH ===
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('[accept-quest] No authorization header');
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
            console.error('[accept-quest] Auth error:', userError);
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
        logId = body.log_id;

        if (!logId || typeof logId !== 'string') {
            console.error('[accept-quest] Invalid log_id:', logId);
            return new Response(
                JSON.stringify({
                    error: 'log_id is required and must be a valid UUID',
                    error_code: 'INVALID_INPUT'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // UUID format validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(logId)) {
            console.error('[accept-quest] Invalid UUID format:', logId);
            return new Response(
                JSON.stringify({
                    error: 'log_id must be a valid UUID',
                    error_code: 'INVALID_UUID'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[accept-quest] Processing: user=${userId}, log_id=${logId}`);

        // === 3. CALL ATOMIC RPC ===
        const { data: result, error: rpcError } = await supabaseClient.rpc('accept_quest_atomic', {
            p_user_id: userId,
            p_log_id: logId,
        });

        if (rpcError) {
            console.error('[accept-quest] RPC error:', rpcError);
            return new Response(
                JSON.stringify({
                    error: 'Failed to accept quest. Please try again.',
                    error_code: 'RPC_ERROR',
                    details: rpcError.message
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // === 4. HANDLE RPC RESULT ===
        if (!result || !result.success) {
            const errorCode = result?.error_code || 'UNKNOWN';
            const errorMessage = result?.error || 'Quest acceptance failed';

            // Map error codes to HTTP status codes
            const statusMap: Record<string, number> = {
                'QUEST_NOT_FOUND': 404,
                'INTERNAL_ERROR': 500,
            };

            console.error(`[accept-quest] Failed: code=${errorCode}, msg=${errorMessage}`);

            return new Response(
                JSON.stringify({
                    error: errorMessage,
                    error_code: errorCode
                }),
                { status: statusMap[errorCode] || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // === 5. LOG SUCCESS & RETURN ===
        const executionTime = Date.now() - startTime;
        console.log(`[accept-quest] SUCCESS: user=${userId}, log_id=${logId}, idempotent=${result.idempotent}, time=${executionTime}ms`);

        return new Response(
            JSON.stringify({
                success: true,
                status: result.status,
                accepted_at: result.accepted_at,
                quest_id: result.quest_id,
                idempotent: result.idempotent,
                message: result.message || 'Quest accepted successfully'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`[accept-quest] EXCEPTION: user=${userId}, log_id=${logId}, time=${executionTime}ms, error=`, error);

        return new Response(
            JSON.stringify({
                error: 'An unexpected error occurred. Please try again.',
                error_code: 'INTERNAL_EXCEPTION'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
