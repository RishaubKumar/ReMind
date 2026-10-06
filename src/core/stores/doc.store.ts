// REMind · L0 document store
// Azure Cosmos DB for MongoDB (Mongoose drop-in). Holds facts + MemoryRecord metadata.
import mongoose, { Schema } from 'mongoose';
import { config } from '../../config.js';
import type { DocStore, MemoryRecord } from '../../types.js';

let conn: Promise<typeof mongoose> | null = null;

function connect() {
    // `dbName` is the only option we set. mongoose's ConnectOptions extends the mongodb
    // driver's TLS-derived options (Pick<tls.ConnectionOptions, ...>), which some TypeScript
    // versions mis-evaluate as having required members; cast through unknown so the editor
    // and the workspace compiler agree.
    const options = { dbName: config.mongo.db } as unknown as mongoose.ConnectOptions;
    if (!conn)
        conn = mongoose.connect(config.mongo.uri, options);
    return conn;
}

const RecordSchema = new Schema({
    id: { type: String, unique: true, index: true },
    agentId: { type: String, index: true },
    type: String,
    content: String,
    trust: Number,
    confidence: Number,
    provenance: Schema.Types.Mixed,
    validFrom: String,
    validTo: String,
    tier: String,
    quarantined: Boolean,
    sourceId: String,
    createdAt: String,
    lastUsedAt: String,
    triples: Schema.Types.Mixed,
}, { versionKey: false });

const AgentSchema = new Schema({
    agentId: { type: String, unique: true, index: true },
    facts: [String],
}, { versionKey: false });

const RecordModel = mongoose.models.MemoryRecord ?? mongoose.model('MemoryRecord', RecordSchema);
const AgentModel = mongoose.models.Agent ?? mongoose.model('Agent', AgentSchema);

function toRecord(d: any): MemoryRecord {
    return {
        id: d.id,
        agentId: d.agentId,
        type: d.type,
        content: d.content,
        trust: d.trust ?? 1,
        confidence: d.confidence ?? 0.5,
        provenance: d.provenance ?? { source: 'doc' },
        tier: d.tier ?? 'warm',
        validFrom: d.validFrom,
        validTo: d.validTo,
        quarantined: d.quarantined,
        sourceId: d.sourceId,
        createdAt: d.createdAt ?? new Date().toISOString(),
        lastUsedAt: d.lastUsedAt,
        triples: d.triples,
    };
}

export const docStore: DocStore = {
    async pushFact(agentId: string, fact: string): Promise<void> {
        await connect();
        await AgentModel.updateOne({ agentId }, { $addToSet: { facts: fact } }, { upsert: true });
    },
    async getFacts(agentId: string): Promise<string[]> {
        await connect();
        // Single source of truth: derive the user's factual context from the bi-temporal
        // record collection, excluding any belief whose valid-time window has been closed
        // by supersession. The validity filter runs in the DB query (indexed on agentId),
        // so superseded facts never reach retrieval. ISO-8601 UTC strings compare
        // lexicographically in chronological order, so $gt on `validTo` is correct.
        const now = new Date().toISOString();
        const docs = await RecordModel.find({
            agentId,
            type: 'factual',
            $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gt: now } }],
        })
            .sort({ createdAt: 1 })
            .lean();
        const seen = new Set<string>();
        const facts: string[] = [];
        for (const d of docs as any[]) {
            const c = d.content?.trim();
            if (c && !seen.has(c.toLowerCase())) {
                seen.add(c.toLowerCase());
                facts.push(c);
            }
        }
        return facts;
    },
    async saveRecord(record: MemoryRecord): Promise<void> {
        await connect();
        await RecordModel.updateOne({ id: record.id }, { $set: record }, { upsert: true });
    },
    async getRecords(agentId: string, filter: Record<string, unknown> = {}): Promise<MemoryRecord[]> {
        await connect();
        const docs = await RecordModel.find({ agentId, ...filter }).lean();
        return docs.map(toRecord);
    },
};
