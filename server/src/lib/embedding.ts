import { pipeline } from '@xenova/transformers'

import { config } from '../config.js'

let extractorPromise: Promise<Awaited<ReturnType<typeof pipeline>>> | null = null

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', config.semanticModel)
  }

  return extractorPromise
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!config.semanticSearchEnabled || texts.length === 0) {
    return null
  }

  try {
    const extractor = (await getExtractor()) as (
      input: string,
      options: {
        pooling: 'mean'
        normalize: true
      },
    ) => Promise<{ tolist: () => number[] }>

    return Promise.all(
      texts.map(async (text) => {
        const output = await extractor(text, {
          pooling: 'mean',
          normalize: true,
        })

        const values = output.tolist()
        return Array.isArray(values[0]) ? (values[0] as number[]) : (values as number[])
      }),
    )
  } catch (error) {
    console.warn('Semantic embeddings unavailable, falling back to lexical-only search.', error)
    return null
  }
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0
  }

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] * left[index]
    rightMagnitude += right[index] * right[index]
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}
