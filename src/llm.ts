// REMind · LLM wrapper
// Single Azure OpenAI choke-point: complete(prompt), classify(prompt), embed(text).
// Hardening: the SDK auto-retries (maxRetries) with backoff on 429 / 5xx / connection errors,
// and deterministic calls (temperature-0 completions + embeddings) are memoized to cut cost
// and latency across all four layers.
import { AzureOpenAI } from 'openai';
import { config } from './config.js';

let client: AzureOpenAI | null = null;
function getClient(): AzureOpenAI {
    if (!client) {
        client = new AzureOpenAI({
            endpoint: config.azureOpenAI.endpoint,
            apiKey: config.azureOpenAI.apiKey,
            apiVersion: config.azureOpenAI.apiVersion,
            maxRetries: 5, // exponential backoff on 429 / 5xx / connection errors (honors Retry-After)
            timeout: 30_000,
        });
    }
    return client;
}

// Deterministic results are safe to memoize for the process lifetime. Bounded FIFO so a
// long-running server never grows without limit.
const CACHE_LIMIT = 5000;
const completionCache = new Map<string, string>();
const embedCache = new Map<string, number[]>();

function remember<T>(cache: Map<string, T>, key: string, value: T): T {
    if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined)
            cache.delete(oldest);
    }
    cache.set(key, value);
    return value;
}

/** Free-form completion. `model` is the Azure *deployment* name. Cached when temperature is 0. */
export async function complete(prompt: string, opts: { temperature?: number } = {}): Promise<string> {
    const temperature = opts.temperature ?? 0.2;
    const key = `${config.azureOpenAI.chatDeployment}|${prompt}`;
    if (temperature === 0) {
        const hit = completionCache.get(key);
        if (hit !== undefined)
            return hit;
    }
    const res = await getClient().chat.completions.create({
        model: config.azureOpenAI.chatDeployment,
        temperature,
        messages: [{ role: 'user', content: prompt }],
    });
    const out = res.choices[0]?.message?.content?.trim() ?? '';
    return temperature === 0 ? remember(completionCache, key, out) : out;
}

/** Deterministic single-token classification (yes/no gates). */
export async function classify(prompt: string): Promise<string> {
    return (await complete(prompt, { temperature: 0 })).trim().toLowerCase();
}

/** Embed text with the Azure embedding deployment. Cached (embeddings are deterministic). */
export async function embed(text: string): Promise<number[]> {
    const key = `${config.azureOpenAI.embedDeployment}|${text}`;
    const hit = embedCache.get(key);
    if (hit)
        return hit;
    const res = await getClient().embeddings.create({
        model: config.azureOpenAI.embedDeployment,
        input: text,
        dimensions: config.azureOpenAI.embedDimensions,
    });
    return remember(embedCache, key, res.data[0].embedding);
}
