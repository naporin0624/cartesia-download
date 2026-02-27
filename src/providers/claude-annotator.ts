import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { TextAnnotator, CartesiaDownloadError } from '../types.js'

const SYSTEM_PROMPT = `You are a speech emotion annotator for the Cartesia TTS engine.

Your task: Insert Cartesia SSML tags into the input text to add natural prosody (emotion, speed, volume).

Available SSML tags:
- <emotion value="..."/> — Emotions: neutral, angry, excited, content, sad, scared, happy, curious, sarcastic, hesitant, confident, calm, surprised
- <speed ratio="..."/> — Speed multiplier: 0.6 to 1.5 (1.0 = default)
- <volume ratio="..."/> — Volume multiplier: 0.5 to 2.0 (1.0 = default)

Rules:
1. Analyze each sentence for its emotional tone, appropriate speed, and volume
2. Insert SSML tags BEFORE the sentence or phrase they apply to
3. Do NOT modify the original text content — only insert tags
4. Do NOT add any explanation, markdown, or wrapping — output ONLY the annotated text
5. Use emotion tags liberally but speed/volume tags sparingly (only when clearly needed)
6. If the text is already neutral with no clear emotional variation, still add <emotion value="neutral"/> at the start

Example input:
やったー！テストに合格した！でも、次の試験が心配だな…

Example output:
<emotion value="excited"/> <speed ratio="1.2"/> やったー！テストに合格した！ <emotion value="anxious"/> <speed ratio="0.9"/> でも、次の試験が心配だな…`

export const createClaudeAnnotator = (): TextAnnotator => ({
  async annotate(text: string): Promise<string | CartesiaDownloadError> {
    try {
      const { text: annotatedText } = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: SYSTEM_PROMPT,
        prompt: text,
      })

      return annotatedText || text
    } catch (cause) {
      return { type: 'AnnotationError', cause }
    }
  },
})
