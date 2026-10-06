// REMind · Stage 2 Foundation Build Export
// Foundation Layer = Vector Store + Graph Store + Fact Store behind Unified Ingestion & Retrieval API.

export { CoreMemory, stores, vectorStore, graphStore, docStore } from './core/index.js';
export { config, requireConfig } from './config.js';
export { idFor } from './ids.js';
export * from './types.js';

import { CoreMemory, stores as defaultStores } from './core/index.js';
import type { Stores } from './types.js';

/**
 * Creates an instance of the Unified Foundation Memory layer.
 * Unifies Vector Store (Azure AI Search), Graph Store (Cosmos Gremlin),
 * and Fact Store (Cosmos MongoDB Mongoose) behind a single ingestion API (addToMemory)
 * and unified retrieval API (fetchMemory).
 */
export function createFoundationMemory(customStores?: Stores): CoreMemory {
    return new CoreMemory(customStores ?? defaultStores);
}

export default createFoundationMemory;
