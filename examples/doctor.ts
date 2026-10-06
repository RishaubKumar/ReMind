// REMind · Diagnostic Doctor · Review 2: Foundation Build
// Checks Azure environment variables and tests connectivity to the 3 Foundation stores + Azure OpenAI.

import { config } from '../src/config.js';

interface CheckItem {
    name: string;
    group: string;
    value: string | number | undefined;
    description: string;
    optional?: boolean;
}

const checks: CheckItem[] = [
    // Azure OpenAI
    { name: 'AZURE_OPENAI_ENDPOINT', group: 'Azure OpenAI', value: config.azureOpenAI.endpoint, description: 'Endpoint URL for Azure OpenAI resource' },
    { name: 'AZURE_OPENAI_API_KEY', group: 'Azure OpenAI', value: config.azureOpenAI.apiKey ? '***[SET]***' : '', description: 'Authentication key for Azure OpenAI' },
    { name: 'AZURE_OPENAI_CHAT_DEPLOYMENT', group: 'Azure OpenAI', value: config.azureOpenAI.chatDeployment, description: 'Deployment name for chat completions (e.g., gpt-4o-mini)' },
    { name: 'AZURE_OPENAI_EMBED_DEPLOYMENT', group: 'Azure OpenAI', value: config.azureOpenAI.embedDeployment, description: 'Deployment name for text embeddings (e.g., text-embedding-3-large)' },

    // Azure AI Search (Vector Store)
    { name: 'AZURE_SEARCH_ENDPOINT', group: 'Vector Store (Azure AI Search)', value: config.search.endpoint, description: 'Endpoint URL for Azure AI Search' },
    { name: 'AZURE_SEARCH_API_KEY', group: 'Vector Store (Azure AI Search)', value: config.search.apiKey ? '***[SET]***' : '', description: 'Admin key for Azure AI Search' },
    { name: 'AZURE_SEARCH_INDEX', group: 'Vector Store (Azure AI Search)', value: config.search.index, description: 'Search index name (default: remind-memory)' },

    // Azure Cosmos DB Gremlin (Graph Store)
    { name: 'COSMOS_GREMLIN_ENDPOINT', group: 'Graph Store (Azure Cosmos DB Gremlin)', value: config.gremlin.endpoint, description: 'Gremlin WebSocket endpoint (wss://...)' },
    { name: 'COSMOS_GREMLIN_KEY', group: 'Graph Store (Azure Cosmos DB Gremlin)', value: config.gremlin.key ? '***[SET]***' : '', description: 'Cosmos master key for Gremlin API' },
    { name: 'COSMOS_GREMLIN_DB', group: 'Graph Store (Azure Cosmos DB Gremlin)', value: config.gremlin.database, description: 'Gremlin database name (default: remind)' },
    { name: 'COSMOS_GREMLIN_GRAPH', group: 'Graph Store (Azure Cosmos DB Gremlin)', value: config.gremlin.graph, description: 'Gremlin graph collection name (default: memory)' },

    // Azure Cosmos DB MongoDB (Fact Store)
    { name: 'COSMOS_MONGO_URI', group: 'Fact Store (Azure Cosmos DB MongoDB)', value: config.mongo.uri ? '***[SET]***' : '', description: 'MongoDB connection string for Cosmos DB' },
    { name: 'COSMOS_MONGO_DB', group: 'Fact Store (Azure Cosmos DB MongoDB)', value: config.mongo.db, description: 'Database name for Mongoose (default: remind)' },

    // Execution Mode
    { name: 'SYNC', group: 'Execution Mode', value: config.sync ? '1 (Inline / In-process)' : '0 (Async Redis)', description: 'Runs Foundation operations synchronously without Redis' },
    { name: 'REDIS_URL', group: 'Execution Mode', value: config.redis.url || '(not set - inline mode active)', description: 'Optional Redis connection for BullMQ', optional: true },
];

async function main() {
    console.log('='.repeat(70));
    console.log('  REMind · Foundation Health & Diagnostics (Doctor)');
    console.log('  Stage 2: Foundation Build Review');
    console.log('='.repeat(70));
    console.log();

    let missingCount = 0;
    const groups = Array.from(new Set(checks.map((c) => c.group)));

    for (const group of groups) {
        console.log(`\x1b[1m[${group}]\x1b[0m`);
        const groupChecks = checks.filter((c) => c.group === group);
        for (const item of groupChecks) {
            const hasValue = Boolean(item.value && item.value !== '(not set - inline mode active)');
            if (hasValue) {
                console.log(`  \x1b[32m✔\x1b[0m ${item.name.padEnd(32)} : ${item.value}`);
            } else if (item.optional) {
                console.log(`  \x1b[36mℹ\x1b[0m ${item.name.padEnd(32)} : [OPTIONAL] ${item.description}`);
            } else {
                console.log(`  \x1b[31m✖\x1b[0m ${item.name.padEnd(32)} : \x1b[31m[NOT CONFIGURED]\x1b[0m (${item.description})`);
                missingCount++;
            }
        }
        console.log();
    }

    console.log('-'.repeat(70));
    if (missingCount === 0) {
        console.log('\x1b[32m✔ All required Azure environment variables are configured in .env!\x1b[0m');
        console.log('You can run the live demonstration with:');
        console.log('  npm run demo:foundation');
    } else {
        console.log(`\x1b[33mNotice: ${missingCount} required variable(s) not yet configured in .env.\x1b[0m`);
        console.log();
        console.log('For live demonstration against real Azure cloud services:');
        console.log('  1. Copy .env.example to .env:  cp .env.example .env');
        console.log('  2. Fill in your Azure credentials in .env');
        console.log('  3. Re-run:  npm run doctor');
        console.log();
        console.log('For immediate offline pipeline validation without live cloud keys:');
        console.log('  npm run demo:foundation:test');
    }
    console.log('='.repeat(70));
}

main().catch(console.error);
