import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 50KB Limit
const MAX_FILE_SIZE = 51200;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No file uploaded' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 1. Size Check
        if (file.size > MAX_FILE_SIZE) {
            return new Response(JSON.stringify({ error: 'File too large. Max 50KB allowed.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 2. Magic Byte Validation
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer.slice(0, 4));
        let mimeType = '';

        // JPEG: FF D8 FF
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            mimeType = 'image/jpeg';
        }
        // PNG: 89 50 4E 47
        else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            mimeType = 'image/png';
        }
        // WEBP: RIFF....WEBP (Need to check bytes 0-3 and 8-11)
        else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
            // Deep check for WEBP
            const webpBytes = new Uint8Array(buffer.slice(8, 12));
            if (webpBytes[0] === 0x57 && webpBytes[1] === 0x45 && webpBytes[2] === 0x42 && webpBytes[3] === 0x50) {
                mimeType = 'image/webp';
            }
        }

        if (!mimeType) {
            return new Response(JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 3. Authenticate User
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 4. Upload to Storage (Using Service Role to bypass bucket strictness if needed, but better to use user context if RLS allows)
        // Actually, we want to bypass the bucket RLS in this function to be the sole gatekeeper, 
        // OR we rely on the bucket policies. 
        // Since we are validating here, let's use the Service Role to upload, ensuring only this function can write?
        // User requested "Storage bucket is locked". If we lock it completely, users can't upload directly.
        // So using Service Role here is the right pattern for strict control.

        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const fileExt = mimeType.split('/')[1];
        const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

        const { data, error: uploadError } = await serviceClient
            .storage
            .from('payment-proofs')
            .upload(fileName, file, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return new Response(JSON.stringify({ error: 'Failed to upload file to storage' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            message: 'Upload successful',
            path: data.path,
            fullPath: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/payment-proofs/${data.path}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
