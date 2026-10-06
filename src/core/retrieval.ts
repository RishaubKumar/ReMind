// REMind · L0 retrieval (read pipeline)
// query rewrite -> vector search -> better-chunks re-query -> frequency fusion -> graph filter -> context assembly.
// Ported from the POC fetchMemory + the retrieval half of createMessage.
import { complete } from '../llm.js';
import type { MemoryRecord, RetrievalResult, Stores } from '../types.js';

export async function fetchMemory(stores: Stores, agentId: string, query: string, sourceId?: string): Promise<RetrievalResult> {
    // 1. Query rewriting — fix typos + enrich.
    const refined = await complete(`Fix typos and add helpful context to this query so it retrieves better. Return only the rewritten query string.\nQuery: ${query}`);
    // 2. First retrieval.
    const first = await stores.vector.search(agentId, refined, 3, sourceId);
    // 3. Better-chunks re-query.
    const refined2 = await complete(`Given the user's query and the chunks retrieved, produce an improved retrieval query (same intent). Return only the query string.\n` +
        `Original query: ${query}\n` +
        `Rewritten query: ${refined}\n` +
        `Chunks: ${JSON.stringify(first.map((r) => r.content))}`);
    const second = await stores.vector.search(agentId, refined2, 3, sourceId);
    // 4. Frequency fusion — chunks seen in both passes rank higher. A bi-temporal guard
    // drops any chunk whose record has been superseded (validTo closed), so a stale value a
    // newer statement replaced never reaches the context even though it lingers in the index.
    const all = await stores.doc.getRecords(agentId, {});
    const now = Date.now();
    const superseded = new Set(all.filter((r) => r.validTo && Date.parse(r.validTo) <= now).map((r) => r.id));
    const priority = fuse([...first, ...second])
        .filter((r) => !superseded.has(r.id))
        .slice(0, 3);
    // 5. Knowledge-graph relations, filtered to what's relevant.
    const graphMap = await stores.graph.fetchGraph(agentId);
    let relations = '';
    if (graphMap.trim()) {
        relations = await complete(`From the knowledge-graph relations below, keep only those relevant to the retrieved chunks. Do not add anything. Return plain text.\n` +
            `Relations:\n${graphMap}\n` +
            `Relevant chunks: ${JSON.stringify(priority.map((r) => r.content))}`);
    }
    // 6. Durable facts + context assembly.
    const facts = await stores.doc.getFacts(agentId);
    const context = assemble(facts, relations, priority);
    return { context, records: priority, facts };
}

function fuse(records: MemoryRecord[]): MemoryRecord[] {
    const freq = new Map<string, { count: number; first: number; rec: MemoryRecord }>();
    records.forEach((r, i) => {
        const key = r.id || r.content;
        const e = freq.get(key);
        if (e)
            e.count++;
        else
            freq.set(key, { count: 1, first: i, rec: r });
    });
    return [...freq.values()]
        .sort((a, b) => b.count - a.count || a.first - b.first)
        .map((e) => e.rec);
}

function assemble(facts: string[], relations: string, chunks: MemoryRecord[]): string {
    const factsText = facts.length ? facts.map((f) => `- ${f}`).join('\n') : 'None';
    const chunkText = chunks.length ? chunks.map((c) => `- ${c.content}`).join('\n') : 'None';
    return (`Factual context about the user:\n${factsText}\n\n` +
        `Episodic relations:\n${relations.trim() || 'None'}\n\n` +
        `Relevant memory chunks:\n${chunkText}`);
}
