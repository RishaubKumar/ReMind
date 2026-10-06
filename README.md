# REMind · Capstone Review 2: Foundation Build

**Project Title:** REMind: Brain-Inspired, Self-Securing Long-Term Memory for AI Agents  
**Institution:** VIT Bhopal University — Capstone Project Phase I  
**Evaluation Scope:** Stage 2 — Foundation Build  

---

## 1. Project Overview & Review 2 Scope

REMind is a biologically inspired long-term memory framework designed for AI agents. In human cognition, raw sensory experiences are captured, retained, and synthesized across distinct complementary memory systems before undergoing long-term consolidation.

For **Capstone Review 2**, the objective is strictly focused on **Stage 2: Foundation Build**:
> *Re-implement the Foundation layer end-to-end, unifying vector, graph, and fact storage behind one ingestion API.*

```text
               Agent / Application
                        │
                        ▼
            Unified Foundation Layer
       (core.addToMemory / core.fetchMemory)
            │           │           │
            ▼           ▼           ▼
       Vector Store Graph Store  Fact Store
       (AI Search)  (Gremlin)   (MongoDB)
```

---

## 2. Architecture & Technology Stack

The Foundation layer integrates three complementary storage mechanisms backed by Microsoft Azure services:

| Store Component | Role & Function | Technology Stack | Seam Interface |
| :--- | :--- | :--- | :--- |
| **Fact Store** | Structured, exact, durable factual records with bi-temporal validity filtering | **Azure Cosmos DB (MongoDB API) + Mongoose ODM** | `DocStore` (`src/core/stores/doc.store.ts`) |
| **Vector Store** | Semantic memory retrieval via vector embeddings with per-tenant partitioning | **Azure AI Search** (HNSW profile) + **Azure OpenAI** embeddings | `VectorStore` (`src/core/stores/vector.store.ts`) |
| **Graph Store** | Entity relationships and episodic knowledge-graph triples `(Subject)-[Relation]->(Object)` | **Azure Cosmos DB (Apache Gremlin API)** | `GraphStore` (`src/core/stores/graph.store.ts`) |
| **LLM & Embeddings** | Salience evaluation, factual/episodic classification, triple extraction, query rewrite | **Azure OpenAI** (`gpt-4o-mini`, `text-embedding-3-large`) | `src/llm.ts` |

---

## 3. Scope Boundaries for Review 2

### Included in Review 2
- [x] **Fact Store**: Cosmos DB MongoDB API + Mongoose for durable facts and record metadata.
- [x] **Vector Store**: Azure AI Search for semantic vector storage and retrieval.
- [x] **Graph Store**: Cosmos DB Gremlin API for graph vertices and directed edges.
- [x] **Unified Ingestion API**: Single entry point `core.addToMemory(input)` that handles salience gating, routing, and store persistence.
- [x] **Unified Retrieval API**: Single entry point `core.fetchMemory(agentId, query)` that fuses facts, graph relationships, and vector chunks.
- [x] **Configuration & Doctor**: Diagnostic verification of required Azure environment variables.
- [x] **Review 2 CLI Demonstration**: Automated end-to-end faculty walkthrough.

### Preserved for Later Stages (NOT part of Review 2 Demo)
The complete codebase preserves all subsequent modules for future evaluations, isolated from the Review 2 workflow:
- **Review 3**: Brain Layer (Episodic-to-semantic sleep-cycle consolidation & memory decay/forgetting).
- **Review 4**: MemGuard Security Layer (Ingestion firewall, belief auditor, canary drift monitoring, and poisoning benchmarks).
- **Review 5**: Final Integration (Async Redis queues with BullMQ, HTTP API, and final defense).

---

## 4. Unified Foundation Data Flow

### Ingestion Flow (`core.addToMemory`)
```text
Exchange Input { user, assistant }
                 │
                 ▼
      [ 1. Salience Gate ]  ──── (no) ────► Drop (Ephemeral / noise)
                 │ (yes)
                 ▼
      [ 2. Classification ]
        /              \
       /                \
(Factual)             (Episodic)
     │                     │
     ▼                     ├──────────────────────┐
[ Extract Fact ]      [ Extract Triples ]   [ Denoise Summary ]
     │                     │                      │
     ▼                     ▼                      ▼
  Fact Store          Graph Store            Vector Store
 (Cosmos Mongo)     (Cosmos Gremlin)      (Azure AI Search)
```

### Retrieval Flow (`core.fetchMemory`)
```text
Search Query (e.g., "Which vendor do we use?")
                 │
                 ▼
     [ 1. LLM Query Rewriting ]
                 │
                 ├─────────────────────────────┐
                 ▼                             ▼
       [ 2. Vector Search ]          [ 3. Graph Traversal ]
       (Azure AI Search)           (Cosmos DB Gremlin API)
                 │                             │
                 ▼                             ▼
       [ 4. Frequency Fusion ]        [ 5. Relevant Edges ]
                 │                             │
                 └──────────────┬──────────────┘
                                │
                                ▼
                   [ 6. Durable Facts Lookup ]
                    (Cosmos DB MongoDB API)
                                │
                                ▼
                   [ 7. Assembled Context ]
                  Factual Context + Episodic
                  Relations + Semantic Chunks
```

---

## 5. Prerequisites & Environment Variables

Copy `.env.example` to `.env` to configure your Azure cloud resources:

```bash
cp .env.example .env
```

### Required Variables for Foundation Build

```dotenv
# 1. Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBED_DEPLOYMENT=text-embedding-3-large
AZURE_OPENAI_EMBED_DIMENSIONS=3072

# 2. Azure AI Search (Vector Store)
AZURE_SEARCH_ENDPOINT=https://<your-search-service>.search.windows.net
AZURE_SEARCH_API_KEY=<your-key>
AZURE_SEARCH_INDEX=remind-memory

# 3. Azure Cosmos DB for Apache Gremlin (Knowledge Graph)
COSMOS_GREMLIN_ENDPOINT=wss://<your-cosmos-account>.gremlin.cosmos.azure.com:443/
COSMOS_GREMLIN_KEY=<your-key>
COSMOS_GREMLIN_DB=remind
COSMOS_GREMLIN_GRAPH=memory

# 4. Azure Cosmos DB for MongoDB (Fact Store)
COSMOS_MONGO_URI=mongodb+srv://<user>:<password>@<your-cluster>.mongocluster.cosmos.azure.com/?tls=true...
COSMOS_MONGO_DB=remind

# 5. Execution Mode
SYNC=1
REDIS_URL=
```

---

## 6. How to Run

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Verify Types & Build
```bash
# Verify TypeScript compile check
npm run typecheck

# Build TypeScript to dist/
npm run build
```

### Step 3: Run Environment Diagnostics (Doctor)
Checks for configured Azure services and validates connection parameters:
```bash
npm run doctor
```

### Step 4: Run the Review 2 Foundation Demonstration
```bash
# Live Azure Cloud Execution (requires .env credentials)
npm run demo:foundation

# Immediate Offline Evaluation (uses transparent labeled test adapters)
npm run demo:foundation:test
```

*(Note: `npm run demo:core` is also supported as an alias matching the original project specification).*

---

## 7. Faculty Demonstration Walkthrough

When presenting to faculty, execute `npm run demo:foundation`:

1. **Step 1 — Store Initialization:**
   Shows initialization of `CoreMemory` unifying Azure AI Search, Cosmos DB Gremlin, and Cosmos DB MongoDB behind one engine.
2. **Step 2 — Unified Factual Ingestion:**
   Submit an exchange: `user: "Our recommended vendor for the project is ACME."`.
   Shows salience check, classification as factual, and storage into the Fact Store (`docStore.pushFact` & `docStore.saveRecord`).
3. **Step 3 — Unified Episodic Ingestion with Knowledge Graph:**
   Submit an exchange: `user: "I traveled to Seattle with Bob to meet ACME leadership last week."`.
   Shows extraction of graph triples `(User)-[traveledTo]->(Seattle)` and `(User)-[metWith]->(ACME)` into Gremlin, vector embedding into Azure AI Search, and record persistence.
4. **Step 4 — Unified Retrieval:**
   Query: `"Which vendor do we use for the project and who did we meet?"`.
   Shows query rewrite, simultaneous retrieval from Vector Store, Graph Store, and Fact Store, and assembly of a complete fused prompt context.

---

## 8. Directory Organization

```text
Remind/
├── src/
│   ├── core/                           # Primary Foundation Layer
│   │   ├── stores/
│   │   │   ├── doc.store.ts            # Azure Cosmos DB MongoDB + Mongoose (Fact Store)
│   │   │   ├── graph.store.ts          # Azure Cosmos DB Gremlin API (Graph Store)
│   │   │   └── vector.store.ts         # Azure AI Search (Vector Store)
│   │   ├── ingest.ts                   # Salience gating, classification & extraction
│   │   ├── retrieval.ts                # Multi-store retrieval, frequency fusion & assembly
│   │   ├── memory-types.ts             # Memory taxonomy & retention specs
│   │   └── index.ts                    # CoreMemory class (unified API)
│   ├── config.ts                       # Azure configuration loader & validation
│   ├── llm.ts                          # Azure OpenAI wrapper (chat & embed)
│   ├── ids.ts                          # Deterministic ID generation
│   ├── types.ts                        # Shared contracts & type definitions
│   ├── gremlin.d.ts                    # Gremlin type declarations
│   └── index.ts                        # Unified Foundation package entry point
│
├── examples/
│   ├── doctor.ts                       # Diagnostics & environment checker
│   ├── review2-foundation-demo.ts      # Dedicated Faculty CLI Demonstration
│   ├── core-demo.ts                    # Demo alias
│   └── test-adapters.ts                # Transparent offline test harness
│
├── all stuff/                          # Master archive & documentation (ignored by Git)
│   ├── original-project/               # Unedited complete project archive
│   ├── remind.zip                      # Original project zip
│   ├── generate_guide_pdf.py           # PDF generator script
│   └── REMind_Review_2_Capstone_Guide.pdf # 7-page Capstone Defense Guide PDF
│
├── .env.example                        # Documented environment template
├── .gitignore                          # Ignores 'all stuff/', node_modules, dist, .env
├── tsconfig.json                       # TypeScript compiler configuration
├── package.json                        # Dependencies and scripts
└── README.md                           # Documentation for Review 2
```
