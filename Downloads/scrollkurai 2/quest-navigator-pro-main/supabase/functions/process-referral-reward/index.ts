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
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Processing referral rewards for user:', user.id);

    // Find all referrals where this user was referred and completed Day 1
    const { data: referrals, error: referralsError } = await supabaseClient
      .from('referrals')
      .select('*')
      .eq('referred_id', user.id)
      .eq('status', 'day_1_completed');

    if (referralsError) throw referralsError;

    if (!referrals || referrals.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No referrals to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let totalXpAwarded = 0;

    for (const referral of referrals) {
      // Award 500 XP to the referrer
      const { data: referrerProfile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('xp, level')
        .eq('id', referral.referrer_id)
        .single();

      if (profileError) {
        console.error('Error fetching referrer profile:', profileError);
        continue;
      }

      const newXp = referrerProfile.xp + 500;
      const newLevel = Math.floor(newXp / 1000) + 1;

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', referral.referrer_id);

      if (updateError) {
        console.error('Error updating referrer profile:', updateError);
        continue;
      }

      // Mark referral as rewarded
      const { error: referralUpdateError } = await supabaseClient
        .from('referrals')
        .update({
          status: 'rewarded',
          rewarded_at: new Date().toISOString(),
        })
        .eq('id', referral.id);

      if (referralUpdateError) {
        console.error('Error updating referral status:', referralUpdateError);
      }

      totalXpAwarded += 500;
      console.log(`Awarded 500 XP to referrer ${referral.referrer_id} for referral ${referral.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${referrals.length} referral(s), awarded ${totalXpAwarded} XP`,
        referrals_processed: referrals.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error processing referral rewards:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});