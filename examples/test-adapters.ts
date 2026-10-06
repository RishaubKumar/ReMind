// REMind · Test Adapters (Offline Demonstration Harness)
//
// IMPORTANT NOTICE:
// These adapters provide an isolated, transparent in-memory implementation of the
// Vector, Graph, and Fact stores and LLM extraction for testing the Foundation pipeline
// flow when live Azure credentials are not available in the local environment.
// All operations are explicitly labeled so faculty can verify the algorithmic routing
// without pretending to execute against live cloud endpoints.

import type { DocStore, GraphStore, MemoryRecord, Stores, Triple, VectorStore } from '../src/types.js';

export function createTestStores(): Stores {
    const recordsMap = new Map<string, MemoryRecord>();
    const factsMap = new Map<string, Set<string>>();
    const graphMap = new Map<string, Triple[]>();
    const vectorMap = new Map<string, MemoryRecord>();

    const doc: DocStore = {
        async pushFact(agentId: string, fact: string): Promise<void> {
            console.log(`    \x1b[36m[TEST ADAPTER -> Fact Store (Cosmos MongoDB Mongoose)]\x1b[0m pushFact("${agentId}", "${fact}")`);
            if (!factsMap.has(agentId)) {
                factsMap.set(agentId, new Set());
            }
            factsMap.get(agentId)!.add(fact);
        },
        async getFacts(agentId: string): Promise<string[]> {
            const list = Array.from(factsMap.get(agentId) ?? []);
            console.log(`    \x1b[36m[TEST ADAPTER -> Fact Store (Cosmos MongoDB Mongoose)]\x1b[0m getFacts("${agentId}") -> ${list.length} fact(s)`);
            return list;
        },
        async saveRecord(record: MemoryRecord): Promise<void> {
            console.log(`    \x1b[36m[TEST ADAPTER -> Fact Store (Cosmos MongoDB Mongoose)]\x1b[0m saveRecord(id="${record.id}", type="${record.type}")`);
            recordsMap.set(record.id, { ...record });
        },
        async getRecords(agentId: string, filter: Record<string, unknown> = {}): Promise<MemoryRecord[]> {
            const all = Array.from(recordsMap.values()).filter((r) => r.agentId === agentId);
            return all;
        },
    };

    const vector: VectorStore = {
        async upsert(record: MemoryRecord): Promise<void> {
            console.log(`    \x1b[35m[TEST ADAPTER -> Vector Store (Azure AI Search)]\x1b[0m upsert(id="${record.id}", content="${record.content}")`);
            vectorMap.set(record.id, { ...record });
        },
        async search(agentId: string, query: string, k: number = 3, sourceId?: string): Promise<MemoryRecord[]> {
            console.log(`    \x1b[35m[TEST ADAPTER -> Vector Store (Azure AI Search)]\x1b[0m search(agentId="${agentId}", query="${query}", top=${k})`);
            const matched = Array.from(vectorMap.values())
                .filter((r) => r.agentId === agentId)
                .slice(0, k);
            return matched;
        },
    };

    const graph: GraphStore = {
        async writeTriples(agentId: string, triples: Triple[]): Promise<void> {
            console.log(`    \x1b[33m[TEST ADAPTER -> Graph Store (Cosmos DB Gremlin)]\x1b[0m writeTriples("${agentId}", count=${triples.length})`);
            for (const t of triples) {
                console.log(`      \x1b[33mGremlin Traversal:\x1b[0m g.V('${t.subject}').addE('${t.relation}').to('${t.object}')`);
            }
            if (!graphMap.has(agentId)) {
                graphMap.set(agentId, []);
            }
            graphMap.get(agentId)!.push(...triples);
        },
        async fetchGraph(agentId: string): Promise<string> {
            const triples = graphMap.get(agentId) ?? [];
            console.log(`    \x1b[33m[TEST ADAPTER -> Graph Store (Cosmos DB Gremlin)]\x1b[0m fetchGraph("${agentId}") -> ${triples.length} edge(s)`);
            return triples.map((t) => `(${t.subject}) -[${t.relation}]-> (${t.object})`).join('\n');
        },
    };

    return { doc, vector, graph };
}
