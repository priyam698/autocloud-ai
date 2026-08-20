import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Helper: Split text into 500-token chunks with 50-token overlap
function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

// Helper: Generate embedding vector via Gemini
async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
    }
  );
  const data = await res.json();
  return data.embedding.values;
}

export async function POST(req: Request) {
  try {
    const { instanceId, rawContent, url } = await req.json();

    if (!instanceId || !rawContent) {
      return NextResponse.json({ error: 'Missing instanceId or content' }, { status: 400 });
    }

    // 1. Clear old chunks for this instance
    await supabase.from('bot_knowledge_chunks').delete().eq('instance_id', instanceId);

    // 2. Chunk full scraped website content
    const textChunks = chunkText(rawContent);

    // 3. Convert all chunks to vector embeddings and store in Supabase
    for (const chunk of textChunks) {
      const vector = await getEmbedding(chunk);
      await supabase.from('bot_knowledge_chunks').insert({
        instance_id: instanceId,
        content: chunk,
        url: url || '',
        embedding: vector,
      });
    }

    return NextResponse.json({
      success: true,
      totalChunks: textChunks.length,
      message: `Indexed ${textChunks.length} chunks into RAG database`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}