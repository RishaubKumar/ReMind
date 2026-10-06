// REMind · L0 memory taxonomy
// short-term window, working scratchpad, procedural skills + tier defaults.
//
// The frozen contract names five MemoryTypes; ingest.ts produces the two that
// need LLM extraction (factual, episodic). This module owns the other three
// lightweight kinds plus the per-type defaults the whole foundation reads from:
// it is the single source of truth for how a freshly drafted record of any type
// is tiered, trusted, and retained. The Brain layer's consolidate()/decay()
// consume these specs to promote durable memories and expire ephemeral ones.

import type { MemoryRecord, MemoryType, Tier } from '../types.js';
import { idFor } from '../ids.js';

const now = () => new Date().toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface TypeSpec {
    tier: Tier;
    confidence: number;
    durable: boolean;
    ttlMs: number;
    description: string;
}

/** The taxonomy: every MemoryType in the frozen contract has exactly one spec. */
export const MEMORY_TYPES: Record<MemoryType, TypeSpec> = {
    factual: {
        tier: 'hot',
        confidence: 0.8,
        durable: true,
        ttlMs: Infinity,
        description: 'Durable semantic fact about the user or the world.',
    },
    procedural: {
        tier: 'warm',
        confidence: 0.75,
        durable: true,
        ttlMs: Infinity,
        description: 'A learned skill, routine, or how-to the agent can reuse.',
    },
    episodic: {
        tier: 'hot',
        confidence: 0.7,
        durable: true,
        ttlMs: 30 * DAY,
        description: 'A time-stamped event; consolidates into facts/graph over time.',
    },
    short: {
        tier: 'hot',
        confidence: 0.5,
        durable: false,
        ttlMs: HOUR,
        description: 'Recent conversation window; ephemeral context that decays fast.',
    },
    working: {
        tier: 'hot',
        confidence: 0.4,
        durable: false,
        ttlMs: 15 * MINUTE,
        description: 'Active task scratchpad; discarded once the task completes.',
    },
};

/** Tier a fresh record of `type` should default to. */
export const defaultTier = (type: MemoryType): Tier => MEMORY_TYPES[type].tier;

/** Default confidence for `type` when the writer has none. */
export const defaultConfidence = (type: MemoryType): number => MEMORY_TYPES[type].confidence;

/** Durable types survive decay; ephemeral ones (short/working) do not. */
export const isDurable = (type: MemoryType): boolean => MEMORY_TYPES[type].durable;

/** Soft retention budget (ms) for `type`; Infinity means never auto-expire. */
export const retentionFor = (type: MemoryType): number => MEMORY_TYPES[type].ttlMs;

/** True once an ephemeral record has outlived its ttl (measured from last use). */
export function isExpired(record: MemoryRecord, at = now()): boolean {
    const ttl = MEMORY_TYPES[record.type].ttlMs;
    if (!Number.isFinite(ttl))
        return false;
    const since = Date.parse(record.lastUsedAt ?? record.createdAt);
    const checkedAt = Date.parse(at);
    if (Number.isNaN(since) || Number.isNaN(checkedAt))
        return true;
    return checkedAt - since > ttl;
}

export interface LightweightDraftInput {
    agentId: string;
    content: string;
    source?: string;
    sourceId?: string;
}

/** Build a draft record of a lightweight kind. Deterministic id => idempotent persist. */
function build(type: MemoryType, input: LightweightDraftInput): MemoryRecord {
    const spec = MEMORY_TYPES[type];
    return {
        id: idFor(input.agentId, type, input.content),
        agentId: input.agentId,
        type,
        content: input.content,
        trust: 1,
        confidence: spec.confidence,
        provenance: { source: input.source ?? type },
        tier: spec.tier,
        sourceId: input.sourceId,
        createdAt: now(),
    };
}

/** Recent-conversation memory (sliding window). Draft only — does not persist. */
export const draftShortTerm = (input: LightweightDraftInput): MemoryRecord => build('short', input);

/** Per-task scratchpad memory. Draft only — does not persist. */
export const draftWorking = (input: LightweightDraftInput): MemoryRecord => build('working', input);

/** Learned skill / routine memory. Draft only — does not persist. */
export const draftProcedural = (input: LightweightDraftInput): MemoryRecord => build('procedural', input);

/**
 * Sliding short-term window: keep only the `limit` most recent short-term
 * records, newest first. Older ones fall out of context (Brain.decay expires
 * them once they pass their ttl).
 */
export function windowShortTerm(records: MemoryRecord[], limit = 10): MemoryRecord[] {
    return records
        .filter((r) => r.type === 'short')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit);
}
