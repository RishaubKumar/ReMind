// REMind · Deterministic IDs
// idFor(agentId, kind, content) -> stable hash so a retried queue job overwrites instead of duplicating.
import { createHash } from 'node:crypto';

export function idFor(agentId: string, kind: string, content: string): string {
    return createHash('sha1').update(`${agentId}:${kind}:${content}`).digest('hex');
}
