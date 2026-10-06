// REMind · Frozen Contract
// Shared types + the three seam interfaces. The only file all four layers import.

export type MemoryType = 'episodic' | 'factual' | 'short' | 'working' | 'procedural';
export type Tier = 'hot' | 'warm' | 'cold';

export interface Provenance {
    source: string;
    derivedFrom?: string[];
}

/** A knowledge-graph edge extracted from an episodic memory. */
export interface Triple {
    subject: string;
    relation: string;
    object: string;
}

export interface MemoryRecord {
    id: string;
    agentId: string;
    type: MemoryType;
    content: string;
    embedding?: number[];
    triples?: Triple[];
    trust: number;
    confidence: number;
    provenance: Provenance;
    validFrom?: string;
    validTo?: string;
    tier: Tier;
    quarantined?: boolean;
    sourceId?: string;
    createdAt: string;
    lastUsedAt?: string;
}

export interface IngestInput {
    agentId: string;
    messages: {
        user: string;
        assistant: string;
    };
    source?: string;
    sourceId?: string;
}

export interface RetrievalResult {
    context: string;
    records: MemoryRecord[];
    facts: string[];
}

export interface ConsolidationReport {
    promoted: MemoryRecord[];
    blocked: {
        record: MemoryRecord;
        reason: string;
    }[];
    merged: number;
}

export interface VectorStore {
    upsert(record: MemoryRecord): Promise<void>;
    search(agentId: string, query: string, k?: number, sourceId?: string): Promise<MemoryRecord[]>;
}

export interface GraphStore {
    writeTriples(agentId: string, triples: Triple[]): Promise<void>;
    fetchGraph(agentId: string): Promise<string>;
}

export interface DocStore {
    pushFact(agentId: string, fact: string): Promise<void>;
    getFacts(agentId: string): Promise<string[]>;
    saveRecord(record: MemoryRecord): Promise<void>;
    getRecords(agentId: string, filter?: Record<string, unknown>): Promise<MemoryRecord[]>;
}

export interface Stores {
    vector: VectorStore;
    graph: GraphStore;
    doc: DocStore;
}

export interface MemoryEngineCore {
    draft(input: IngestInput): Promise<MemoryRecord | null>;
    persist(record: MemoryRecord): Promise<MemoryRecord>;
    fetchMemory(agentId: string, query: string, sourceId?: string): Promise<RetrievalResult>;
    addToMemory?(input: IngestInput): Promise<MemoryRecord | null>;
}

export type PromotionGate = (candidate: MemoryRecord, from: MemoryRecord[]) => Promise<{
    promote: boolean;
    reason?: string;
}>;

export interface Brain {
    consolidate(agentId: string, stores: Stores, gate: PromotionGate): Promise<ConsolidationReport>;
    decay(agentId: string, stores: Stores): Promise<void>;
}

export interface MemGuardHooks {
    onIngest(input: IngestInput, draft: MemoryRecord): Promise<{
        allow: boolean;
        record: MemoryRecord;
        reason?: string;
    }>;
    onConsolidate: PromotionGate;
    onOutput(records: MemoryRecord[]): Promise<MemoryRecord[]>;
    checkCanaries(): Promise<{
        drift: boolean;
        details: string;
    }>;
}
