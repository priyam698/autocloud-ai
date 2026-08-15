import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

interface GenerateAIParams {
  teamId: string;
  platform: 'slack' | 'telegram' | 'web' | 'whatsapp' | 'meta_dm' | 'discord';
  sessionId: string;
  userPrompt: string;
  systemPersona?: string;
}

export async function processCustomerMessage({
  teamId,
  platform,
  sessionId,
  userPrompt,
  systemPersona = 'You are a professional, helpful, and concise AI workplace assistant for AutoCloud AI.'
}: GenerateAIParams): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return "Error: AI engine is currently unconfigured. Please check back shortly.";
  }

  // 1. Fetch relevant Knowledge Base articles for this workspace (RAG)
  let knowledgeContext = "";
  if (supabase) {
    try {
      const { data: docs } = await supabase
        .from('knowledge_base')
        .select('title, content')
        .eq('team_id', teamId)
        .limit(5);

      if (docs && docs.length > 0) {
        knowledgeContext = docs
          .map((doc) => `### Document: ${doc.title}\n${doc.content}`)
          .join('\n\n');
      }
    } catch (err) {
      console.error('Knowledge Base lookup error:', err);
    }
  }

  // 2. Fetch last 6 messages from this thread/session for context continuity (Memory)
  let conversationHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
  if (supabase) {
    try {
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('team_id', teamId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(6);

      if (history && history.length > 0) {
        conversationHistory = history.reverse().map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        }));
      }
    } catch (err) {
      console.error('Chat history lookup error:', err);
    }
  }

  // 3. Assemble System Prompt with dynamic knowledge
  const systemInstruction = `
${systemPersona}

COMPANY KNOWLEDGE BASE:
${knowledgeContext || 'No specific internal documents uploaded yet. Answer based on general domain knowledge.'}

GUIDELINES:
- Prioritize facts found in the COMPANY KNOWLEDGE BASE.
- Be clear, friendly, and structured.
- Keep answers formatted in clean markdown.
  `.trim();

  const fullMessages = [
    { role: 'system' as const, content: systemInstruction },
    ...conversationHistory,
    { role: 'user' as const, content: userPrompt }
  ];

  // 4. Run Groq Inference
  let aiResponse = "I'm having trouble processing that request right now. Please try again.";
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: fullMessages,
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      aiResponse = data.choices?.[0]?.message?.content || aiResponse;
    }
  } catch (err) {
    console.error('Groq execution error:', err);
  }

  // 5. Persist interaction into Supabase memory
  if (supabase) {
    try {
      await supabase.from('chat_history').insert([
        { team_id: teamId, platform, session_id: sessionId, role: 'user', content: userPrompt },
        { team_id: teamId, platform, session_id: sessionId, role: 'assistant', content: aiResponse },
      ]);
    } catch (err) {
      console.error('Failed to persist conversation turn:', err);
    }
  }

  return aiResponse;
}