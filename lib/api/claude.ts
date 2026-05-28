import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(prompt: string, systemPrompt?: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type');
  return block.text;
}
