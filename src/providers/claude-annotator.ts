import { generateText, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ResultAsync } from 'neverthrow';
import type { TextAnnotator, AnnotationError } from '../types.js';
import { parseMarkerStream } from '../core/marker-parser.js';

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
7. ONLY use emotion values from this exact list: neutral, angry, excited, content, sad, scared, happy, curious, sarcastic, hesitant, confident, calm, surprised. Do NOT invent new values like "shocked", "confused", "panicked", "bewildered", "concerned", "anxious", "worried" etc.

Example input:
やったー！テストに合格した！でも、次の試験が心配だな…

Example output:
<emotion value="excited"/> <speed ratio="1.2"/> やったー！テストに合格した！ <emotion value="anxious"/> <speed ratio="0.9"/> でも、次の試験が心配だな…`;

const STREAM_SYSTEM_PROMPT = `${SYSTEM_PROMPT}
8. Insert [SEP] between natural speech units (breath pauses, emotion transitions, sentence endings)
9. Do NOT place [SEP] after the final chunk
10. Each [SEP]-delimited segment should be a natural, self-contained speech unit`;

type ClaudeAnnotatorOptions = {
  apiKey?: string;
  model?: string;
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export const createClaudeAnnotator = (options?: ClaudeAnnotatorOptions): TextAnnotator => ({
  annotate(text: string): ResultAsync<string, AnnotationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const anthropic = createAnthropic(options?.apiKey ? { apiKey: options.apiKey } : {});
        const { text: annotatedText } = await generateText({
          model: anthropic(options?.model ?? DEFAULT_MODEL),
          system: SYSTEM_PROMPT,
          prompt: text,
        });
        return annotatedText || text;
      })(),
      (cause): AnnotationError => ({ type: 'AnnotationError', cause }),
    );
  },
  stream(text: string): ResultAsync<AsyncIterable<string>, AnnotationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const anthropic = createAnthropic(options?.apiKey ? { apiKey: options.apiKey } : {});
        const { textStream } = streamText({
          model: anthropic(options?.model ?? DEFAULT_MODEL),
          system: STREAM_SYSTEM_PROMPT,
          prompt: text,
        });
        return parseMarkerStream(textStream);
      })(),
      (cause): AnnotationError => ({ type: 'AnnotationError', cause }),
    );
  },
});
