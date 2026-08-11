import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { instanceId, websiteUrl } = await req.json();

    if (!instanceId || !websiteUrl) {
      return NextResponse.json({ error: 'Missing instanceId or websiteUrl' }, { status: 400 });
    }

    // Ensure valid URL format
    let targetUrl = websiteUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // 1. Fetch website HTML
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AutoCloudBot/1.0' },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Could not reach ${targetUrl}` }, { status: 400 });
    }

    const html = await response.text();

    // 2. Clean HTML to extract readable text
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000); // Take top 10k characters for prompt context

    // 3. Format as custom system prompt
    const knowledgeContext = `
You are an AI Customer Support Agent for the business at ${targetUrl}.
Use the following official website information to answer user questions accurately and politely:

=== OFFICIAL WEBSITE KNOWLEDGE ===
${cleanText}
==================================

If a user asks something not covered in the knowledge above, politely inform them that you can pass their query to human support.
`;

    // 4. Save directly into Supabase deployments table
    const { error: updateErr } = await supabase
      .from('deployments')
      .update({ custom_context: knowledgeContext })
      .eq('id', instanceId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update database context' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Website knowledge successfully scraped & attached to AI agent!',
      charCount: cleanText.length,
    });

  } catch (err: any) {
    console.error('Scraping error:', err);
    return NextResponse.json({ error: 'Failed to scrape website' }, { status: 500 });
  }
}