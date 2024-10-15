import { Templates, templatesToPrompt } from '@/lib/templates'

export function toPrompt(template: Templates) {
  return `
    You are a general assistant.
    You always answer in the user's text language.
  `
}
