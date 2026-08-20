import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Fallback HTML cleaner if direct DOM parsing is needed
function cleanHtmlContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove unwanted junk elements
  $('script, style, svg, noscript, iframe, nav, footer, header, form, link, meta, [role="alert"], [aria-hidden="true"]').remove();

  // Extract structured headings and text
  const contentParts: string[] = [];

  $('h1, h2, h3, h4, p, li, table, blockquote').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().replace(/\s+/g, ' ').trim();

    if (text.length > 2) {
      if (['h1', 'h2', 'h3'].includes(tag)) {
        contentParts.push(`\n### ${text}\n`);
      } else if (tag === 'li') {
        contentParts.push(`- ${text}`);
      } else {
        contentParts.push(text);
      }
    }
  });

  return contentParts.join('\n').trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    let targetUrl = body?.url || body?.websiteUrl || body?.targetUrl;
    const instanceId = body?.instanceId || body?.instance_id || body?.id;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return NextResponse.json(
        { error: 'A valid website URL is required.' },
        { status: 400 }
      );
    }

    // Normalize URL
    targetUrl = targetUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    console.log(`[Scraper] Starting deep scrape for: ${targetUrl}`);

    let rawExtractedText = '';

    // Engine 1: Headless Markdown Extractor (Handles SPAs, Client-rendered React/Next.js)
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${targetUrl}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/plain, text/markdown',
        },
      });

      if (jinaRes.ok) {
        const markdown = await jinaRes.text();
        if (markdown && markdown.length > 100) {
          rawExtractedText = markdown;
          console.log(`[Scraper] Engine 1 (Jina) succeeded. Length: ${markdown.length} chars`);
        }
      }
    } catch (err) {
      console.warn('[Scraper] Engine 1 failed, attempting Engine 2 (Cheerio direct)...', err);
    }

    // Engine 2: Direct Fetch + Cheerio Parser (Fallback)
    if (!rawExtractedText) {
      try {
        const directRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });

        if (directRes.ok) {
          const html = await directRes.text();
          rawExtractedText = cleanHtmlContent(html);
          console.log(`[Scraper] Engine 2 (Cheerio) extracted ${rawExtractedText.length} chars`);
        }
      } catch (err) {
        console.error('[Scraper] Engine 2 failed:', err);
      }
    }

    if (!rawExtractedText || rawExtractedText.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract content from the provided website URL. Please ensure the website is publicly accessible.' },
        { status: 422 }
      );
    }

    // Trim text length if website is massive (keep top 12,000 characters for token limit safety)
    const truncatedText = rawExtractedText.slice(0, 12000);

    // AI Structuring Prompt: Convert raw page text into a high-precision knowledge base
    const structuringPrompt = `
You are an expert AI Knowledge Base Architect.
Analyze the following raw scraped website content and convert it into an ultra-clean, structured, and comprehensive Knowledge Base for an AI Customer Support Agent.

FORMAT SPECIFICATION:
1. PLATFORM OVERVIEW:
   - What the product does, key mission, and core value proposition.
2. CORE FEATURES & CAPABILITIES:
   - Itemized list of supported features, channels, and platform integrations.
3. PRICING & SUBSCRIPTIONS:
   - Exact pricing breakdown per tier/bot, setup fees ($0), billing terms, and refund policy.
4. TROUBLESHOOTING & CRITICAL FAQS:
   - Forgot password / credentials instructions: "Email priyamrana069@gmail.com to reset access."
   - Deleted instance recovery: "Send billing receipt to priyamrana069@gmail.com along with query to restore."
   - Human support contact: priyamrana069@gmail.com.
5. OUT-OF-SCOPE BEHAVIOR:
   - Politely decline non-platform questions and route to support.

RAW WEBSITE CONTENT:
${truncatedText}
`.trim();

    let structuredKnowledge = '';

    // Step 3A: Structure with Groq (llama-3.3-70b-versatile)
    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'You extract and organize website content into clean, structured Markdown knowledge bases for customer support bots.',
              },
              { role: 'user', content: structuringPrompt },
            ],
            max_tokens: 1000,
            temperature: 0.1,
          }),
        });

        const groqData = await groqRes.json();
        structuredKnowledge = groqData.choices?.[0]?.message?.content?.trim() || '';
      } catch (err) {
        console.error('[Scraper] Groq structuring error:', err);
      }
    }

    // Step 3B: Structure with Cerebras (Fallback)
    const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
    if (!structuredKnowledge && cerebrasKey) {
      try {
        const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cerebrasKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3.1-8b',
            messages: [
              {
                role: 'system',
                content: 'You extract and organize website content into clean, structured Markdown knowledge bases.',
              },
              { role: 'user', content: structuringPrompt },
            ],
            max_tokens: 1000,
            temperature: 0.1,
          }),
        });

        const cerebrasData = await cerebrasRes.json();
        structuredKnowledge = cerebrasData.choices?.[0]?.message?.content?.trim() || '';
      } catch (err) {
        console.error('[Scraper] Cerebras structuring error:', err);
      }
    }

    // Step 3C: Structure with Gemini (Fallback)
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
    if (!structuredKnowledge && geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: structuringPrompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
            }),
          }
        );

        const geminiData = await geminiRes.json();
        structuredKnowledge = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      } catch (err) {
        console.error('[Scraper] Gemini structuring error:', err);
      }
    }

    // If AI generation fails, fall back to cleaned extracted text directly
    if (!structuredKnowledge) {
      structuredKnowledge = truncatedText;
    }

    // Step 4: If instanceId is provided, auto-sync to Supabase
    if (instanceId) {
      const { error: dbError } = await supabase
        .from('deployments')
        .update({
          custom_context: structuredKnowledge,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      if (dbError) {
        console.error('[Scraper] Failed to auto-save to database:', dbError);
      } else {
        console.log(`[Scraper] Successfully updated custom_context for instance: ${instanceId}`);
      }
    }

    return NextResponse.json({
      success: true,
      url: targetUrl,
      context: structuredKnowledge,
      knowledge: structuredKnowledge,
      text: structuredKnowledge,
      length: structuredKnowledge.length,
    });
  } catch (err: any) {
    console.error('[Scrape API Fatal Exception]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to scrape website' },
      { status: 500 }
    );
  }
}