// Update the first/default quest to be more engaging
import pkg from '@supabase/supabase-js';
const { createClient } = pkg;

const SUPABASE_URL = 'https://vfxvvovudyaofgdbkfua.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmeHZ2b3Z1ZHlhb2ZnZGJrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzIzNzc0NSwiZXhwIjoyMDgyODEzNzQ1fQ.gcsL6ezXgphSzlMY47IgQI2glPqJD5prHdFhXRq05d0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updateFirstQuest() {
    // Create a more exciting first quest
    const excitingFirstQuest = {
        content: "🚀 Welcome, Warrior! Take 5 minutes right now to write down ONE thing you've been avoiding — and commit to starting it TODAY.",
        reflection_prompt: "What's that one thing you've been putting off? How does it feel to finally confront it?",
    };

    // Update the "grateful" quest to be more engaging
    const { data, error } = await supabase
        .from('quests')
        .update(excitingFirstQuest)
        .eq('id', '480c97bd-45b5-4ab9-952d-585cbaaf1ba5')
        .select();

    if (error) {
        console.error('Error updating quest:', error);
    } else {
        console.log('✅ First quest updated successfully!');
        console.log('New content:', data?.[0]?.content);
    }
}

updateFirstQuest();
