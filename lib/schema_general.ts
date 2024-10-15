import { z } from 'zod'

export const fragmentSchema = z.object({
  commentary: z.string().optional().describe('Only directly answer to the users question'),

  

})

export type FragmentSchema = z.infer<typeof fragmentSchema>