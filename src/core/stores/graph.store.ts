// REMind · L0 knowledge graph
// Azure Cosmos DB for Apache Gremlin (replaces Neo4j). Deterministic, idempotent triple upserts.
import gremlin from 'gremlin';
import { config } from '../../config.js';
import type { GraphStore, Triple } from '../../types.js';

// gremlin ships partial types; treat the driver namespace loosely.
const G = gremlin as any;
let client: any = null;

function getClient() {
    if (client)
        return client;
    const authenticator = new G.driver.auth.PlainTextSaslAuthenticator(
        `/dbs/${config.gremlin.database}/colls/${config.gremlin.graph}`,
        config.gremlin.key
    );
    client = new G.driver.Client(config.gremlin.endpoint, {
        authenticator,
        traversalsource: 'g',
        rejectUnauthorized: true,
        mimeType: 'application/vnd.gremlin-v2.0+json',
    });
    return client;
}

/** Gremlin string-literal escaping. */
const esc = (s: string) => s.replace(/'/g, "\\'");

async function ensureVertex(name: string, agentId: string) {
    const n = esc(name);
    const a = esc(agentId);
    // partitionKey = agentId so every vertex is tenant-scoped (Cosmos requirement).
    await getClient().submit(
        `g.V().has('Entity','name','${n}').has('agentId','${a}').fold()` +
        `.coalesce(unfold(),addV('Entity').property('name','${n}').property('agentId','${a}').property('partitionKey','${a}'))`
    );
}

export const graphStore: GraphStore = {
    async writeTriples(agentId: string, triples: Triple[]): Promise<void> {
        for (const t of triples) {
            if (!t.subject || !t.relation || !t.object)
                continue;
            await ensureVertex(t.subject, agentId);
            await ensureVertex(t.object, agentId);
            const s = esc(t.subject);
            const o = esc(t.object);
            const rel = esc(t.relation);
            const a = esc(agentId);
            await getClient().submit(
                `g.V().has('Entity','name','${s}').has('agentId','${a}').as('s')` +
                `.V().has('Entity','name','${o}').has('agentId','${a}')` +
                `.coalesce(__.inE('${rel}').where(outV().as('s')), addE('${rel}').from('s'))`
            );
        }
    },
    async fetchGraph(agentId: string): Promise<string> {
        const a = esc(agentId);
        // outE/inV (not bothE/otherV) so each directed edge is emitted exactly once,
        // oriented subject -> object — matching the `-[e]->` rendering below.
        const res = await getClient().submit(
            `g.V().has('agentId','${a}').as('v').outE().as('e').inV().as('o').select('v','e','o')`
        );
        const rows = res?._items ?? (typeof res?.toArray === 'function' ? res.toArray() : res) ?? [];
        let map = '';
        for (const row of rows) {
            const v = row?.v?.properties?.name?.[0]?.value ?? row?.v?.label;
            const e = row?.e?.label;
            const o = row?.o?.properties?.name?.[0]?.value ?? row?.o?.label;
            if (v && e && o)
                map += `(${v}) -[${e}]-> (${o})\n`;
        }
        return map;
    },
};
