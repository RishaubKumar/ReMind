// REMind · L0 ingest (write pipeline)
// draft(input): salience gate -> factual/episodic routing -> fact extraction OR (graph triples + denoised summary).
// Returns a draft MemoryRecord (does NOT persist). Ported from the POC addToMemory.
import { classify, complete } from '../llm.js';
import { idFor } from '../ids.js';
import type { IngestInput, MemoryRecord, Triple } from '../types.js';

const now = () => new Date().toISOString();

export async function draft(input: IngestInput): Promise<MemoryRecord | null> {
    const { user, assistant } = input.messages;
    const source = input.source ?? 'conversation';
    // 1. Salience / long-term gate.
    const isLongTerm = await classify(`You decide whether a user/assistant exchange contains anything worth storing in LONG-TERM memory.\n` +
        `Respond with a single word: 'yes' or 'no'.\n` +
        `Examples:\n` +
        `- { user: My birthday is on 27th June, assistant: excited for it } -> yes\n` +
        `- { user: what's 2x3, assistant: 6 } -> no\n` +
        `- { user: Pav Bhaji is my favorite food } -> yes\n` +
        `Conversation: { user: ${user}, assistant: ${assistant} }\n` +
        `Answer only 'yes' or 'no'.`);
    if (isLongTerm.startsWith('no'))
        return null;
    // 2. Factual vs episodic routing.
    const isFactual = await classify(`Decide whether the exchange should be stored as FACTUAL memory (durable facts) vs EPISODIC (a time-stamped event).\n` +
        `Respond 'yes' for factual, 'no' for episodic.\n` +
        `Examples:\n` +
        `- { user: My favorite color is blue } -> yes\n` +
        `- { user: I went trekking in Manali last summer } -> no\n` +
        `- { user: I work at Google as a backend developer } -> yes\n` +
        `Conversation: { user: ${user}, assistant: ${assistant} }\n` +
        `Answer only 'yes' or 'no'.`);
    if (isFactual.startsWith('yes')) {
        // 3a. Fact extraction — denoise to a concise statement.
        const fact = await complete(`Extract the durable fact as a short precise statement, no extra words.\n` +
            `Examples:\n` +
            `- { user: My favorite color is blue } -> User's favorite color is blue\n` +
            `- { user: I work at Google as a backend developer } -> User is a backend developer at Google\n` +
            `Conversation: { user: ${user}, assistant: ${assistant} }\n` +
            `Return only the fact string.`, { temperature: 0 });
        return {
            id: idFor(input.agentId, 'fact', fact),
            agentId: input.agentId,
            type: 'factual',
            content: fact,
            trust: 1,
            confidence: 0.8,
            provenance: { source },
            tier: 'hot',
            sourceId: input.sourceId,
            createdAt: now(),
        };
    }
    // 3b. Episodic — extract graph triples + a denoised vector summary.
    const triples = await extractTriples(user, assistant);
    const summary = await complete(`Summarize the episodic event into a single clean sentence for semantic storage, noise removed. Return only the sentence.\n` +
        `Examples:\n` +
        `- { user: I went trekking in Manali last summer } -> User traveled to Manali for trekking last summer.\n` +
        `- { user: I watched Interstellar last weekend } -> User watched the movie Interstellar last weekend.\n` +
        `Conversation: { user: ${user}, assistant: ${assistant} }`, { temperature: 0 });
    return {
        id: idFor(input.agentId, 'episodic', summary),
        agentId: input.agentId,
        type: 'episodic',
        content: summary,
        triples,
        trust: 1,
        confidence: 0.7,
        provenance: { source },
        tier: 'hot',
        sourceId: input.sourceId,
        createdAt: now(),
    };
}

async function extractTriples(user: string, assistant: string): Promise<Triple[]> {
    const raw = await complete(`Extract the episodic event as knowledge-graph triples.\n` +
        `Return ONLY a JSON array of objects: [{"subject":"...","relation":"...","object":"..."}].\n` +
        `Use "User" as the subject when the event is about the user. Keep names concise. No prose, no markdown.\n` +
        `Examples:\n` +
        `- { user: I went trekking in Manali last summer } -> [{"subject":"User","relation":"traveledTo","object":"Manali"}]\n` +
        `- { user: I watched Interstellar last weekend } -> [{"subject":"User","relation":"watchedMovie","object":"Interstellar"}]\n` +
        `Conversation: { user: ${user}, assistant: ${assistant} }`, { temperature: 0 });
    try {
        const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed.filter((t: any) => t && t.subject && t.relation && t.object);
        }
    }
    catch {
        // ignore malformed JSON — episodic still stored as a vector summary.
    }
    return [];
}
