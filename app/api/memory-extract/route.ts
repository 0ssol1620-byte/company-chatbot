/**
 * /api/memory-extract
 * LLM-based memory extraction endpoint.
 *
 * Called after each NPC conversation turn (fire-and-forget from client).
 * Analyzes the latest exchange and decides what to store in:
 *   - Long-term memory (important facts, decisions, patterns)
 *   - Short-term memory (today's key-points)
 *   - User profile (name, preferences, recurring info)
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import type { MemoryExtractionResult } from "@/lib/npc-memory";

export const maxDuration = 30;

const EXTRACTION_PROMPT = `You are a memory manager for an AI assistant.
Analyze the conversation exchange below and extract ONLY genuinely important information worth remembering.

Apply the OpenClaw memory write rule:
- Store IF: reusable, important for future context, reveals user preferences or patterns
- Ignore IF: trivial, one-time, already obvious from context

Output a JSON object with exactly this structure:
{
  "longTerm": ["fact1", "fact2"],
  "shortTerm": ["key-point1", "key-point2"],
  "userProfile": [{"key": "name", "value": "..."}]
}

Where:
- longTerm: permanent facts (decisions, preferences, important context)
- shortTerm: today's conversation key-points (what was discussed)
- userProfile: user-specific info (name, role, preferences, goals)

If nothing worth storing, return empty arrays. Keep each entry concise (under 100 chars).
Respond with ONLY the JSON, no other text.`;

export async function POST(req: Request) {
  const body = await req.json();
  const { agentConfig, userMessage, npcResponse } = body;

  if (!agentConfig?.apiKey || !userMessage || !npcResponse) {
    return Response.json({ longTerm: [], shortTerm: [], userProfile: [] });
  }

  const { provider, model, apiKey } = agentConfig;

  let aiModel;
  try {
    if (provider === "openai") {
      aiModel = createOpenAI({ apiKey })(model);
    } else if (provider === "anthropic") {
      aiModel = createAnthropic({ apiKey })(model);
    } else if (provider === "google") {
      aiModel = createGoogleGenerativeAI({ apiKey })(model);
    } else if (provider === "groq") {
      aiModel = createGroq({ apiKey })(model);
    } else if (provider === "mistral") {
      aiModel = createMistral({ apiKey })(model);
    } else if (provider === "ollama") {
      const baseURL = (agentConfig.baseUrl as string | undefined) || "http://localhost:11434/v1";
      aiModel = createOpenAI({ apiKey: "ollama", baseURL })(model);
    } else {
      return Response.json({ longTerm: [], shortTerm: [], userProfile: [] });
    }
  } catch {
    return Response.json({ longTerm: [], shortTerm: [], userProfile: [] });
  }

  try {
    const { text } = await generateText({
      model: aiModel,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `User said: "${userMessage}"\n\nAssistant responded: "${npcResponse.slice(0, 500)}"`,
        },
      ],
    });

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ longTerm: [], shortTerm: [], userProfile: [] });
    }

    const result: MemoryExtractionResult = JSON.parse(jsonMatch[0]);
    return Response.json({
      longTerm: Array.isArray(result.longTerm) ? result.longTerm.slice(0, 5) : [],
      shortTerm: Array.isArray(result.shortTerm) ? result.shortTerm.slice(0, 5) : [],
      userProfile: Array.isArray(result.userProfile) ? result.userProfile.slice(0, 5) : [],
    });
  } catch {
    return Response.json({ longTerm: [], shortTerm: [], userProfile: [] });
  }
}
