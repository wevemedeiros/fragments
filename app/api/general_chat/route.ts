import { Duration } from '@/lib/duration'
import { getModelClient, getDefaultMode } from '@/lib/models'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { Templates } from '@/lib/templates'
import { streamObject, LanguageModel, CoreMessage } from 'ai'
import { fragmentSchema as schemaGeneral } from '@/lib/schema_general' // Importando o schema_general

export const maxDuration = 60

const rateLimitMaxRequests = process.env.RATE_LIMIT_MAX_REQUESTS
  ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
  : 10

const ratelimitWindow = process.env.RATE_LIMIT_WINDOW
  ? (process.env.RATE_LIMIT_WINDOW as Duration)
  : '1d'

function countTokens(text: string): number {
  const tokens = text.toLowerCase().split(/(\s+|[.,!?;:'"()\[\]{}])/g).filter(Boolean);
  return tokens.length;
}

export async function POST(req: Request) {
  console.log('Received POST request to /api/general_chat')

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

  console.log('///RECEIVED DATA', JSON.stringify({ messages, userID, template, model, config }, null, 2))

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

  console.log('///USER ID:', userID)
  console.log('///TEMPLATE:', JSON.stringify(template, null, 2))
  console.log('///MODEL:', JSON.stringify(model, null, 2))
  console.log('///CONFIG:', JSON.stringify(config, null, 2))

  const { model: modelNameString, apiKey: modelApiKey, ...modelParams } = config
  console.log('///MODEL PARAMETERS:', JSON.stringify(modelParams, null, 2))

  const modelClient = getModelClient(model, config)
  console.log('///Model client created')

  const systemPrompt = toPrompt(template)
  console.log('///SYSTEM PROMPT:', systemPrompt)

  const defaultMode = getDefaultMode(model)
  console.log('///DEFAULT MODE', defaultMode)

  const systemTokens = countTokens(systemPrompt);
  const messageTokens = messages.reduce((acc, msg) => acc + countTokens(JSON.stringify(msg.content)), 0);
  const templateTokens = countTokens(JSON.stringify(template));
  const modelTokens = countTokens(JSON.stringify(model));
  const configTokens = countTokens(JSON.stringify(config));
  const modeTokens = countTokens(defaultMode);

  const totalTokens = systemTokens + messageTokens + templateTokens + modelTokens + configTokens + modeTokens;

  console.log('Token count:', {
    systemTokens,
    messageTokens,
    templateTokens,
    modelTokens,
    configTokens,
    modeTokens,
    totalTokens
  })

  const streamParams = {
    model: modelClient as LanguageModel,
    system: systemPrompt,
    messages,
    mode: defaultMode,
    schema: schemaGeneral, // Usando o schema_general
    ...modelParams
  };

  console.log('Preparing to stream object with parameters:', JSON.stringify(streamParams, null, 2))

  const stream = await streamObject(streamParams)

  console.log('Stream object created')

  const response = stream.toTextStreamResponse()
  console.log('Text stream response created')

  return response
}