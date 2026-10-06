// REMind · L0 Foundation export
// CoreMemory implements MemoryEngineCore over the three Azure stores. The single public seam of core/.
import { draft as draftFn } from './ingest.js';
import { fetchMemory as fetchFn } from './retrieval.js';
import { vectorStore } from './stores/vector.store.js';
import { graphStore } from './stores/graph.store.js';
import { docStore } from './stores/doc.store.js';
import type { IngestInput, MemoryEngineCore, MemoryRecord, RetrievalResult, Stores } from '../types.js';

export const stores: Stores = { vector: vectorStore, graph: graphStore, doc: docStore };

export class CoreMemory implements MemoryEngineCore {
    stores: Stores;

    constructor(customStores?: Stores) {
        this.stores = customStores ?? stores;
    }

    async draft(input: IngestInput): Promise<MemoryRecord | null> {
        return draftFn(input);
    }

    /** Idempotent: vector/graph/doc writes key on deterministic ids. */
    async persist(record: MemoryRecord): Promise<MemoryRecord> {
        if (record.type === 'factual') {
            await this.stores.doc.pushFact(record.agentId, record.content);
        }
        else {
            await this.stores.vector.upsert(record);
            if (record.triples?.length) {
                await this.stores.graph.writeTriples(record.agentId, record.triples);
            }
        }
        await this.stores.doc.saveRecord(record);
        return record;
    }

    async fetchMemory(agentId: string, query: string, sourceId?: string): Promise<RetrievalResult> {
        return fetchFn(this.stores, agentId, query, sourceId);
    }

    /**
     * Unified Foundation Ingestion API:
     * Takes an exchange input, runs salience gating + factual/episodic classification,
     * extracts facts or graph triples + vector summaries, and persists them into the unified stores.
     */
    async addToMemory(input: IngestInput): Promise<MemoryRecord | null> {
        const draft = await this.draft(input);
        if (!draft)
            return null;
        return this.persist(draft);
    }
}

export { vectorStore, graphStore, docStore };
