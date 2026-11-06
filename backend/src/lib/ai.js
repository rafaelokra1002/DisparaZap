// Geração de variações do anúncio com IA (Claude).
// Precisa de ANTHROPIC_API_KEY no ambiente; sem ela a função fica desativada.
const Anthropic = require('@anthropic-ai/sdk');

const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

let client = null;

function isAiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

const SYSTEM_PROMPT = `Você escreve anúncios curtos para grupos de WhatsApp no Brasil.
Receberá um anúncio e deve reescrevê-lo em versões diferentes que vendam o MESMO produto, com o MESMO preço, condições e links.
Regras:
- Português do Brasil, tom natural de quem divulga em grupo de WhatsApp.
- Não invente preço, desconto, prazo, bônus ou característica que não esteja no original.
- Mantenha qualquer link (URL) do original exatamente igual.
- Cada versão deve mudar de verdade a abordagem (ex.: começar pelo benefício, pela urgência, por uma pergunta, por prova social já citada no original), não só trocar sinônimos.
- Use a formatação do WhatsApp (*negrito*, quebras de linha) e emojis com moderação.
- Tamanho parecido com o original.`;

class AiNotConfiguredError extends Error {}
class AiRefusedError extends Error {}

async function generateAdVariations(originalText, count = 3) {
  if (!isAiConfigured()) {
    throw new AiNotConfiguredError('IA não configurada no servidor (defina ANTHROPIC_API_KEY).');
  }

  const total = Math.max(1, Math.min(4, Number(count) || 3));

  const response = await getClient().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            variations: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['variations'],
          additionalProperties: false,
        },
      },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Crie ${total} versões diferentes deste anúncio:\n\n<anuncio>\n${originalText}\n</anuncio>`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new AiRefusedError('A IA não conseguiu reescrever este anúncio. Tente ajustar o texto.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('Resposta da IA sem texto');
  }

  const parsed = JSON.parse(textBlock.text);
  return (parsed.variations || [])
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .slice(0, total);
}

module.exports = {
  AI_MODEL,
  isAiConfigured,
  generateAdVariations,
  AiNotConfiguredError,
  AiRefusedError,
};
