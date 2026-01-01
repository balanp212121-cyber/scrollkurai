/**
 * Shared CORS configuration for ScrollKurai Edge Functions
 * 
 * USAGE: Import in your Edge Function:
 * import { corsHeaders, handleCors } from '../_shared/cors.ts';
 * 
 * Solo founder pragmatic approach:
 * - Production: Restrict to actual domain
 * - Development: Allow localhost
 */

// Production domain - UPDATE THIS before launch
const PRODUCTION_DOMAIN = 'https://scrollkurai.com';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    PRODUCTION_DOMAIN,
    'https://www.scrollkurai.com',
    // Vercel preview deployments
    'https://*.vercel.app',
    // Local development
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
];

/**
 * Get CORS headers for a request
 * Returns appropriate Origin header based on request origin
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
    // Default to wildcard for backwards compatibility during transition
    // TODO: Remove wildcard after verifying all clients work
    let allowedOrigin = '*';

    if (requestOrigin) {
        // Check if origin matches any allowed pattern
        for (const allowed of ALLOWED_ORIGINS) {
            if (allowed.includes('*')) {
                // Wildcard matching (e.g., *.vercel.app)
                const pattern = allowed.replace('*', '.*');
                if (new RegExp(`^${pattern}$`).test(requestOrigin)) {
                    allowedOrigin = requestOrigin;
                    break;
                }
            } else if (allowed === requestOrigin) {
                allowedOrigin = requestOrigin;
                break;
            }
        }
    }

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    };
}

/**
 * Simple CORS headers (current approach - works, less strict)
 * Use this for quick migration without breaking anything
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Handle CORS preflight request
 * @param req The incoming request
 * @returns Response if it's a preflight request, null otherwise
 */
export function handleCors(req: Request): Response | null {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.get('Origin');
        return new Response(null, { headers: getCorsHeaders(origin) });
    }
    return null;
}
