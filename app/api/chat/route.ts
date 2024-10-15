import { Duration } from '@/lib/duration'
import { getModelClient, getDefaultMode } from '@/lib/models'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { fragmentSchema as schema } from '@/lib/schema'
import { Templates } from '@/lib/templates'
import { streamObject, LanguageModel, CoreMessage } from 'ai'

export const maxDuration = 60

const rateLimitMaxRequests = process.env.RATE_LIMIT_MAX_REQUESTS
  ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
  : 10

const ratelimitWindow = process.env.RATE_LIMIT_WINDOW
  ? (process.env.RATE_LIMIT_WINDOW as Duration)
  : '1d'

// Função simplificada para contar tokens (esta é uma aproximação)
function countTokens(text: string): number {
  return text.split(/\s+/).length;
}

export async function POST(req: Request) {
  console.log('Received POST request to /api/chat')

  const {
    messages,
    userID,
    template,
    model,
    config,
  }: {
    messages: CoreMessage[]
    userID: string
    template: Templates
    model: LLMModel
    config: LLMModelConfig
  } = await req.json()

  console.log('Received data:', JSON.stringify({ messages, userID, template, model, config }, null, 2))

  const limit = !config.apiKey
    ? await ratelimit(
        userID,
        rateLimitMaxRequests,
        ratelimitWindow,
      )
    : false

  if (limit) {
    console.log(`Rate limit reached for user: ${userID}`)
    return new Response('You have reached your request limit for the day.', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.amount.toString(),
        'X-RateLimit-Remaining': limit.remaining.toString(),
        'X-RateLimit-Reset': limit.reset.toString(),
      },
    })
  }

  console.log('User ID:', userID)
  console.log('Template:', JSON.stringify(template, null, 2))
  console.log('Model:', JSON.stringify(model, null, 2))
  console.log('Config:', JSON.stringify(config, null, 2))

  const { model: modelNameString, apiKey: modelApiKey, ...modelParams } = config
  console.log('Model parameters:', JSON.stringify(modelParams, null, 2))

  const modelClient = getModelClient(model, config)
  console.log('Model client created')

  const systemPrompt = toPrompt(template)
  console.log('System prompt:', systemPrompt)

  const defaultMode = getDefaultMode(model)
  console.log('Default mode:', defaultMode)

  // Contar tokens
  const systemTokens = countTokens(systemPrompt);
  const messageTokens = messages.reduce((acc, msg) => acc + countTokens(JSON.stringify(msg)), 0);
  const totalTokens = systemTokens + messageTokens;

  console.log('Token count:', {
    systemTokens,
    messageTokens,
    totalTokens
  })

  const streamParams = {
    model: modelClient as LanguageModel,
    schema,
    system: systemPrompt,
    messages,
    mode: defaultMode,
    ...modelParams
  };

  console.log('Preparing to stream object with parameters:', JSON.stringify(streamParams, null, 2))

  const stream = await streamObject(streamParams)

  console.log('Stream object created')

  const response = stream.toTextStreamResponse()
  console.log('Text stream response created')

  return response
}