// REMind · L0 vector store
// Azure AI Search (native vector search, replaces Qdrant). Per-agent filtering + idempotent upsert.
import {
    AzureKeyCredential,
    SearchClient,
    SearchIndexClient,
    SearchIndex,
} from '@azure/search-documents';
import { config } from '../../config.js';
import { embed } from '../../llm.js';
import type { MemoryRecord, VectorStore } from '../../types.js';

let searchClient: SearchClient<Record<string, unknown>> | null = null;
let indexClient: SearchIndexClient | null = null;

function getClients() {
    if (!searchClient || !indexClient) {
        const credential = new AzureKeyCredential(config.search.apiKey);
        searchClient = new SearchClient(config.search.endpoint, config.search.index, credential);
        indexClient = new SearchIndexClient(config.search.endpoint, credential);
    }
    return { searchClient, indexClient };
}

/** OData string-literal escaping. */
const esc = (s: string) => s.replace(/'/g, "''");

let ensured = false;
async function ensureIndex() {
    if (ensured)
        return;
    const { indexClient } = getClients();
    const index: SearchIndex = {
        name: config.search.index,
        fields: [
            { name: 'id', type: 'Edm.String', key: true, filterable: true },
            { name: 'agentId', type: 'Edm.String', filterable: true },
            { name: 'type', type: 'Edm.String', filterable: true },
            { name: 'sourceId', type: 'Edm.String', filterable: true },
            { name: 'content', type: 'Edm.String', searchable: true },
            { name: 'createdAt', type: 'Edm.String', filterable: true, sortable: true },
            {
                name: 'embedding',
                type: 'Collection(Edm.Single)',
                searchable: true,
                vectorSearchDimensions: config.azureOpenAI.embedDimensions,
                vectorSearchProfileName: 'remind-hnsw-profile',
            },
        ],
        vectorSearch: {
            algorithms: [{ name: 'remind-hnsw', kind: 'hnsw' }],
            profiles: [{ name: 'remind-hnsw-profile', algorithmConfigurationName: 'remind-hnsw' }],
        },
    };
    await indexClient.createOrUpdateIndex(index);
    ensured = true;
}

export const vectorStore: VectorStore = {
    async upsert(record: MemoryRecord): Promise<void> {
        await ensureIndex();
        const { searchClient } = getClients();
        const embedding = record.embedding ?? (await embed(record.content));
        await searchClient.mergeOrUploadDocuments([
            {
                id: record.id,
                agentId: record.agentId,
                type: record.type,
                content: record.content,
                sourceId: record.sourceId,
                createdAt: record.createdAt,
                embedding,
            },
        ]);
    },
    async search(agentId: string, query: string, k: number = 3, sourceId?: string): Promise<MemoryRecord[]> {
        await ensureIndex();
        const { searchClient } = getClients();
        const vector = await embed(query);
        const filters = [`agentId eq '${esc(agentId)}'`];
        if (sourceId)
            filters.push(`sourceId eq '${esc(sourceId)}'`);
        const results = await searchClient.search('*', {
            vectorSearchOptions: {
                queries: [{ kind: 'vector', vector, kNearestNeighborsCount: k, fields: ['embedding'] }],
            },
            filter: filters.join(' and '),
            top: k,
        });
        const out: MemoryRecord[] = [];
        for await (const r of results.results) {
            const d = r.document as any;
            out.push({
                id: d.id,
                agentId: d.agentId,
                type: d.type,
                content: d.content,
                sourceId: d.sourceId,
                createdAt: d.createdAt,
                trust: 1,
                confidence: 0.7,
                provenance: { source: 'vector' },
                tier: 'warm',
            });
        }
        return out;
    },
};
