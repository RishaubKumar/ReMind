// REMind · Config
// Loads .env and exposes the Azure / Microsoft service settings every layer reads.
import 'dotenv/config';

function opt(name: string, fallback: string = ''): string {
    return process.env[name] ?? fallback;
}

export const config = {
    azureOpenAI: {
        endpoint: opt('AZURE_OPENAI_ENDPOINT'),
        apiKey: opt('AZURE_OPENAI_API_KEY'),
        apiVersion: opt('AZURE_OPENAI_API_VERSION', '2024-10-21'),
        chatDeployment: opt('AZURE_OPENAI_CHAT_DEPLOYMENT', 'gpt-4o-mini'),
        embedDeployment: opt('AZURE_OPENAI_EMBED_DEPLOYMENT', 'text-embedding-3-large'),
        embedDimensions: Number(opt('AZURE_OPENAI_EMBED_DIMENSIONS', '3072')),
    },
    // Azure AI Search — vector store (replaces Qdrant)
    search: {
        endpoint: opt('AZURE_SEARCH_ENDPOINT'),
        apiKey: opt('AZURE_SEARCH_API_KEY'),
        index: opt('AZURE_SEARCH_INDEX', 'remind-memory'),
    },
    // Azure Cosmos DB for Apache Gremlin — knowledge graph (replaces Neo4j)
    gremlin: {
        endpoint: opt('COSMOS_GREMLIN_ENDPOINT'),
        key: opt('COSMOS_GREMLIN_KEY'),
        database: opt('COSMOS_GREMLIN_DB', 'remind'),
        graph: opt('COSMOS_GREMLIN_GRAPH', 'memory'),
    },
    // Azure Cosmos DB for MongoDB — facts/records (Mongoose drop-in)
    mongo: {
        uri: opt('COSMOS_MONGO_URI'),
        db: opt('COSMOS_MONGO_DB', 'remind'),
    },
    // Azure Cache for Redis — queues (Layer 0 does not use this yet)
    redis: { url: opt('REDIS_URL') },
    sync: opt('SYNC', '1') === '1',
};

/**
 * Fail fast with a clear, actionable message when a credential needed to actually run is
 * missing — call this at process entry points (demo, server) before touching Azure.
 */
export function requireConfig(): void {
    const missing: string[] = [];
    const need = (value: unknown, name: string) => {
        if (!value)
            missing.push(name);
    };
    need(config.azureOpenAI.endpoint, 'AZURE_OPENAI_ENDPOINT');
    need(config.azureOpenAI.apiKey, 'AZURE_OPENAI_API_KEY');
    need(config.search.endpoint, 'AZURE_SEARCH_ENDPOINT');
    need(config.search.apiKey, 'AZURE_SEARCH_API_KEY');
    need(config.gremlin.endpoint, 'COSMOS_GREMLIN_ENDPOINT');
    need(config.gremlin.key, 'COSMOS_GREMLIN_KEY');
    need(config.mongo.uri, 'COSMOS_MONGO_URI');
    if (!config.sync)
        need(config.redis.url, 'REDIS_URL');
    if (missing.length > 0) {
        throw new Error(`REMind is missing required environment variables:\n  - ${missing.join('\n  - ')}\n` +
            `Copy .env.example to .env and fill these in.`);
    }
}
