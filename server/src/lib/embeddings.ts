import { readConfig } from './config.js';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const LOCAL_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// Lazy singleton for the local model so it only downloads/loads once.
let localExtractorPromise: Promise<LocalExtractor> | null = null;

type LocalExtractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array }>;

async function getLocalExtractor(): Promise<LocalExtractor> {
  if (!localExtractorPromise) {
    localExtractorPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return (await pipeline('feature-extraction', LOCAL_EMBEDDING_MODEL)) as unknown as LocalExtractor;
    })();
  }
  return localExtractorPromise;
}

/**
 * Embed a batch of texts. OpenAI keys use OpenAI's hosted embedding model;
 * everyone else (e.g. an Anthropic key, which has no embeddings endpoint)
 * falls back to a small local model (@xenova/transformers) that runs
 * on-device with no extra API key — this is what keeps setup to "paste one
 * key" regardless of provider.
 */
export async function embedTexts(companyId: number, texts: string[]): Promise<number[][]> {
  const config = readConfig(companyId);

  if (config?.provider === 'openai' && config.apiKey) {
    return embedOpenAI(config.apiKey, texts);
  }
  return embedLocal(texts);
}

export async function embedQuery(companyId: number, text: string): Promise<number[]> {
  const [vector] = await embedTexts(companyId, [text]);
  return vector;
}

async function embedOpenAI(apiKey: string, texts: string[]): Promise<number[][]> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const res = await client.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: texts,
  });

  return res.data.map((item) => item.embedding);
}

async function embedLocal(texts: string[]): Promise<number[][]> {
  const extractor = await getLocalExtractor();
  const vectors: number[][] = [];

  for (const text of texts) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    vectors.push(Array.from(output.data));
  }

  return vectors;
}
