import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getTeam } from '@/lib/teams';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, teamId } = await req.json();

  if (!teamId) {
    return new Response('teamId is required', { status: 400 });
  }

  const team = getTeam(teamId);
  if (!team) {
    return new Response(`Team not found: ${teamId}`, { status: 404 });
  }

  let model;
  if (team.provider === 'openai') {
    model = openai(team.model);
  } else if (team.provider === 'anthropic') {
    model = anthropic(team.model);
  } else {
    return new Response('Unknown provider', { status: 400 });
  }

  const result = streamText({
    model,
    system: team.systemPrompt,
    messages,
  });

  return result.toUIMessageStreamResponse();
}
