// Verify Settings in Supabase
const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';

async function main() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key,value`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });

    const data = await res.json();
    const settings = {};
    data.forEach(s => settings[s.key] = s.value);

    console.log('🔍 Supabase Settings Check:');
    console.log('-----------------------------------');
    console.log(`✅ statusStages: ${settings.statusStages ? settings.statusStages.length + ' items' : 'MISSING'}`);
    console.log(`✅ secondaryStatuses: ${settings.secondaryStatuses ? settings.secondaryStatuses.length + ' items' : 'MISSING'}`);
    if (settings.secondaryStatuses) console.log(`   Values: ${JSON.stringify(settings.secondaryStatuses)}`);

    console.log(`✅ inboundPaths: ${settings.inboundPaths ? settings.inboundPaths.length + ' items' : 'MISSING'}`);
    console.log(`✅ aiPrompt: ${settings.aiPrompt ? 'Present (' + settings.aiPrompt.length + ' chars)' : 'MISSING'}`);
    console.log('-----------------------------------');
}

main();
