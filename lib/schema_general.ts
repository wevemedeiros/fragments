import { z } from 'zod'

export const fragmentSchema = z.object({
  commentary: z.string().optional().describe('Optional commentary about the generated fragment.'),
  template: z.string().describe('Name of the template used to generate the fragment.'),
  title: z.string().optional().describe('Short title of the fragment. Max 3 words.'),
  description: z.string().optional().describe('Short description of the fragment. Max 1 sentence.'),
  code: z.string().describe('Code or content generated by the fragment, if applicable.'),
})

export type FragmentSchema = z.infer<typeof fragmentSchema>