import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    console.log('=== 1. FETCH all templates ===');
    const { data: templates, error: fetchError } = await supabase
        .from('sms_templates')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (fetchError) {
        console.error('FETCH ERROR:', fetchError);
    } else {
        console.log('Templates found:', templates?.length);
        templates?.forEach(t => console.log(`  - [${t.id}] ${t.title}: ${t.content?.substring(0, 30)}...`));
    }

    console.log('\n=== 2. INSERT test template ===');
    const { data: inserted, error: insertError } = await supabase
        .from('sms_templates')
        .insert({ title: 'TEST_DELETE_ME', content: 'Test content for debugging' })
        .select()
        .single();
    
    if (insertError) {
        console.error('INSERT ERROR:', JSON.stringify(insertError, null, 2));
    } else {
        console.log('INSERT SUCCESS:', inserted);
    }

    if (inserted) {
        console.log('\n=== 3. UPDATE the test template ===');
        const { data: updated, error: updateError } = await supabase
            .from('sms_templates')
            .update({ title: 'TEST_UPDATED', content: 'Updated content' })
            .eq('id', inserted.id)
            .select()
            .single();
        
        if (updateError) {
            console.error('UPDATE ERROR:', JSON.stringify(updateError, null, 2));
        } else {
            console.log('UPDATE SUCCESS:', updated);
        }

        console.log('\n=== 4. DELETE the test template ===');
        const { error: deleteError } = await supabase
            .from('sms_templates')
            .delete()
            .eq('id', inserted.id);
        
        if (deleteError) {
            console.error('DELETE ERROR:', JSON.stringify(deleteError, null, 2));
        } else {
            console.log('DELETE SUCCESS');
        }
    }

    // Try updating an existing template (first one)
    if (templates && templates.length > 0) {
        const first = templates[0];
        console.log(`\n=== 5. UPDATE existing template [${first.id}] ===`);
        console.log(`   Current title: "${first.title}", content: "${first.content?.substring(0, 40)}..."`);
        
        const { data: existingUpdated, error: existingUpdateError } = await supabase
            .from('sms_templates')
            .update({ content: first.content + '' })  // Update with same content (no actual change)
            .eq('id', first.id)
            .select()
            .single();
        
        if (existingUpdateError) {
            console.error('EXISTING UPDATE ERROR:', JSON.stringify(existingUpdateError, null, 2));
        } else {
            console.log('EXISTING UPDATE SUCCESS:', existingUpdated);
        }
    }
}

test().catch(console.error);
