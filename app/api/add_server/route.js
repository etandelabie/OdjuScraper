import { NextResponse } from 'next/server';
import { addCustomServer } from '@/lib/store';

export async function POST(request) {
  try {
    const body = await request.json();
    const { host, port, name } = body;
    
    if (!host) {
      return NextResponse.json({ success: false, error: 'Host is required' }, { status: 400 });
    }
    
    addCustomServer(host, port ? parseInt(port) : 5520);
    
    return NextResponse.json({ success: true, message: 'Server added successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
