import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(req) {
    try {
        const { host, password, is_affiliated } = await req.json();
        
        if (password !== process.env.ADMIN_PASSWORD) {
            return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 });
        }
        
        if (!host) return NextResponse.json({ success: false, error: 'Host missing' });
        
        const { error } = await supabase
            .from('mcpe_servers')
            .update({ is_affiliated })
            .eq('host', host);
            
        if (error) throw error;
        
        return NextResponse.json({ success: true });
    } catch(err) {
        return NextResponse.json({ success: false, error: err.message });
    }
}
