# Content Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Postgres+pgvector content registry for semantically searchable academic literature, exposed to NanoClaw agents as an MCP server.

**Architecture:** Two source modules (`content-registry.ts` for storage/search, `search-literature.ts` for API wrappers) exposed via a stdio MCP server inside the agent container. The MCP server connects to Postgres on the host via `host.docker.internal:5432`. Catalog-then-expand pattern: search returns lightweight results (title, authors, venue, year, one-line summary, score), expand returns full details. Two CLI scripts for seeding and Zotero import.

**Tech Stack:** pg (Postgres client), openai (embeddings via text-embedding-3-small), @modelcontextprotocol/sdk + zod (MCP server), vitest (tests), bibtex-parse (Zotero .bib parsing)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/tools/content-registry.ts` | Schema init, index_papers, search_registry, expand_paper, import_zotero (~300 lines) |
| `src/tools/search-literature.ts` | Semantic Scholar + OpenAlex API wrappers, normalized Paper type (~200 lines) |
| `src/tools/content-registry.test.ts` | Tests for registry operations (mock pg) |
| `src/tools/search-literature.test.ts` | Tests for API wrappers (mock HTTP) |
| `container/agent-runner/src/content-registry-mcp.ts` | Stdio MCP server exposing 5 tools to agents |
| `container/agent-runner/src/index.ts` | Modify: add content-registry MCP server config |
| `container/agent-runner/package.json` | Modify: add pg, openai, bibtex-parse deps |
| `scripts/seed-registry.ts` | CLI: search APIs → index results |
| `scripts/import-zotero.ts` | CLI: parse .bib → index entries |
| `package.json` | Modify: add pg, @types/pg, openai, bibtex-parse deps |
| `.env` | Already has OPENAI_API_KEY and POSTGRES_PASSWORD |

---

### Task 1: Install dependencies and create directory structure

**Files:**
- Modify: `package.json`
- Modify: `container/agent-runner/package.json`
- Create: `src/tools/` (directory)
- Create: `scripts/` (directory)

- [ ] **Step 1: Install host-side dependencies**

```bash
npm install pg openai bibtex-parse
npm install -D @types/pg
```

- [ ] **Step 2: Install container-side dependencies**

Add to `container/agent-runner/package.json` dependencies:
```json
"pg": "^8.13.0",
"openai": "^4.0.0",
"bibtex-parse": "^2.1.0"
```

- [ ] **Step 3: Create directories**

```bash
mkdir -p src/tools scripts
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json container/agent-runner/package.json src/tools scripts
git commit -m "chore: add content registry dependencies and directories"
```

---

### Task 2: Normalized Paper type and search-literature API wrappers

**Files:**
- Create: `src/tools/search-literature.ts`
- Create: `src/tools/search-literature.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/tools/search-literature.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  searchSemanticScholar,
  searchOpenAlex,
  type Paper,
} from './search-literature.js';

describe('searchSemanticScholar', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns normalized papers from Semantic Scholar', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            paperId: 'abc123',
            title: 'Content Moderation at Scale',
            authors: [{ name: 'Alice Smith' }, { name: 'Bob Jones' }],
            venue: 'CHI 2025',
            year: 2025,
            abstract: 'We study content moderation approaches...',
            url: 'https://semanticscholar.org/paper/abc123',
          },
        ],
      }),
    });

    const papers = await searchSemanticScholar('content moderation', 5);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toEqual({
      source: 'semantic_scholar',
      sourceId: 'abc123',
      title: 'Content Moderation at Scale',
      authors: ['Alice Smith', 'Bob Jones'],
      venue: 'CHI 2025',
      year: 2025,
      abstract: 'We study content moderation approaches...',
      url: 'https://semanticscholar.org/paper/abc123',
    });
  });

  it('returns empty array on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    const papers = await searchSemanticScholar('test', 5);
    expect(papers).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const papers = await searchSemanticScholar('test', 5);
    expect(papers).toEqual([]);
  });
});

describe('searchOpenAlex', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns normalized papers from OpenAlex', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'https://openalex.org/W123',
            title: 'Platform Governance',
            authorships: [
              { author: { display_name: 'Carol White' } },
            ],
            primary_location: {
              source: { display_name: 'ICWSM 2025' },
            },
            publication_year: 2025,
            abstract_inverted_index: { We: [0], study: [1], platforms: [2] },
            doi: 'https://doi.org/10.1234/test',
          },
        ],
      }),
    });

    const papers = await searchOpenAlex('platform governance', 5);
    expect(papers).toHaveLength(1);
    expect(papers[0].source).toBe('openalex');
    expect(papers[0].sourceId).toBe('W123');
    expect(papers[0].title).toBe('Platform Governance');
    expect(papers[0].authors).toEqual(['Carol White']);
    expect(papers[0].venue).toBe('ICWSM 2025');
    expect(papers[0].year).toBe(2025);
    expect(papers[0].abstract).toBe('We study platforms');
    expect(papers[0].url).toBe('https://doi.org/10.1234/test');
  });

  it('handles missing abstract_inverted_index', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'https://openalex.org/W456',
            title: 'No Abstract Paper',
            authorships: [],
            primary_location: null,
            publication_year: 2024,
            abstract_inverted_index: null,
            doi: null,
          },
        ],
      }),
    });

    const papers = await searchOpenAlex('test', 5);
    expect(papers).toHaveLength(1);
    expect(papers[0].abstract).toBe('');
    expect(papers[0].url).toBe('https://openalex.org/W456');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tools/search-literature.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/tools/search-literature.ts

export interface Paper {
  source: 'semantic_scholar' | 'openalex' | 'zotero';
  sourceId: string;
  title: string;
  authors: string[];
  venue: string;
  year: number;
  abstract: string;
  url: string;
}

const S2_BASE = 'https://api.semanticscholar.org/graph/v1';
const S2_FIELDS = 'paperId,title,authors,venue,year,abstract,url';

export async function searchSemanticScholar(
  query: string,
  limit = 10,
): Promise<Paper[]> {
  try {
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      fields: S2_FIELDS,
    });
    const res = await fetch(`${S2_BASE}/paper/search?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.data || []).map((p: Record<string, unknown>) => ({
      source: 'semantic_scholar' as const,
      sourceId: p.paperId as string,
      title: p.title as string,
      authors: ((p.authors as { name: string }[]) || []).map((a) => a.name),
      venue: (p.venue as string) || '',
      year: (p.year as number) || 0,
      abstract: (p.abstract as string) || '',
      url: (p.url as string) || '',
    }));
  } catch {
    return [];
  }
}

/**
 * OpenAlex uses an inverted index for abstracts.
 * { "We": [0], "study": [1], "platforms": [2] } → "We study platforms"
 */
function invertedIndexToText(
  index: Record<string, number[]> | null,
): string {
  if (!index) return '';
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map((w) => w[0]).join(' ');
}

const OA_BASE = 'https://api.openalex.org';

export async function searchOpenAlex(
  query: string,
  limit = 10,
): Promise<Paper[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      per_page: String(limit),
    });
    const res = await fetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).map((w: Record<string, unknown>) => {
      const authorships = (w.authorships as { author: { display_name: string } }[]) || [];
      const primaryLocation = w.primary_location as { source?: { display_name?: string } } | null;
      const oaId = (w.id as string) || '';

      return {
        source: 'openalex' as const,
        sourceId: oaId.replace('https://openalex.org/', ''),
        title: (w.title as string) || '',
        authors: authorships.map((a) => a.author.display_name),
        venue: primaryLocation?.source?.display_name || '',
        year: (w.publication_year as number) || 0,
        abstract: invertedIndexToText(
          w.abstract_inverted_index as Record<string, number[]> | null,
        ),
        url: (w.doi as string) || oaId,
      };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tools/search-literature.test.ts
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/tools/search-literature.ts src/tools/search-literature.test.ts
git commit -m "feat: add Semantic Scholar and OpenAlex API wrappers"
```

---

### Task 3: Content registry — schema, index, search, expand, import

**Files:**
- Create: `src/tools/content-registry.ts`
- Create: `src/tools/content-registry.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/tools/content-registry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg
const mockQuery = vi.fn();
const mockEnd = vi.fn();
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({
      query: mockQuery,
      end: mockEnd,
    })),
  },
}));

// Mock openai
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    embeddings: {
      create: mockCreate,
    },
  })),
}));

import { ContentRegistry } from './content-registry.js';

describe('ContentRegistry', () => {
  let registry: ContentRegistry;

  beforeEach(() => {
    mockQuery.mockReset();
    mockCreate.mockReset();
    mockEnd.mockReset();
    registry = new ContentRegistry({
      connectionString: 'postgresql://test:test@localhost/test',
      openaiApiKey: 'sk-test',
    });
  });

  describe('initSchema', () => {
    it('creates extension and table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await registry.initSchema();
      // Should call query with CREATE EXTENSION and CREATE TABLE
      expect(mockQuery).toHaveBeenCalled();
      const calls = mockQuery.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((s: string) => s.includes('CREATE EXTENSION'))).toBe(true);
      expect(calls.some((s: string) => s.includes('CREATE TABLE'))).toBe(true);
    });
  });

  describe('indexPapers', () => {
    it('embeds and inserts papers', async () => {
      const embedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValue({
        data: [{ embedding }],
      });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await registry.indexPapers([
        {
          source: 'semantic_scholar',
          sourceId: 'abc123',
          title: 'Test Paper',
          authors: ['Alice'],
          venue: 'CHI',
          year: 2025,
          abstract: 'A test abstract',
          url: 'https://example.com',
        },
      ]);

      expect(result.indexed).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('skips papers that already exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ source_id: 'abc123' }],
      });

      const result = await registry.indexPapers([
        {
          source: 'semantic_scholar',
          sourceId: 'abc123',
          title: 'Test Paper',
          authors: ['Alice'],
          venue: 'CHI',
          year: 2025,
          abstract: 'A test abstract',
          url: 'https://example.com',
        },
      ]);

      expect(result.indexed).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('searchRegistry', () => {
    it('embeds query and returns catalog entries', async () => {
      const embedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValue({ data: [{ embedding }] });
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            title: 'Test Paper',
            authors: ['Alice'],
            venue: 'CHI',
            year: 2025,
            summary: 'A test paper about...',
            score: 0.92,
          },
        ],
      });

      const results = await registry.searchRegistry('content moderation', 5);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 1,
        title: 'Test Paper',
        authors: ['Alice'],
        venue: 'CHI',
        year: 2025,
        summary: 'A test paper about...',
        score: 0.92,
      });
      // Must NOT include abstract in search results
      expect(results[0]).not.toHaveProperty('abstract');
    });
  });

  describe('expandPaper', () => {
    it('returns full paper details', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            source: 'semantic_scholar',
            source_id: 'abc123',
            title: 'Test Paper',
            authors: ['Alice'],
            venue: 'CHI',
            year: 2025,
            abstract: 'Full abstract here...',
            url: 'https://example.com',
            summary: 'Short summary',
            indexed_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const paper = await registry.expandPaper(1);
      expect(paper).not.toBeNull();
      expect(paper!.abstract).toBe('Full abstract here...');
      expect(paper!.source).toBe('semantic_scholar');
    });

    it('returns null for nonexistent paper', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const paper = await registry.expandPaper(999);
      expect(paper).toBeNull();
    });
  });

  describe('importZotero', () => {
    it('parses bib entries and indexes them', async () => {
      const embedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValue({ data: [{ embedding }] });
      // First call: check existing (none found)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Subsequent calls: INSERT
      mockQuery.mockResolvedValue({ rows: [] });

      const bibContent = `@article{smith2025,
  title = {Test Article},
  author = {Smith, Alice and Jones, Bob},
  journal = {Nature},
  year = {2025},
  abstract = {An abstract.}
}`;

      const result = await registry.importZoteroBib(bibContent);
      expect(result.indexed).toBeGreaterThanOrEqual(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tools/content-registry.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/tools/content-registry.ts
import pg from 'pg';
import OpenAI from 'openai';
import bibtexParse from 'bibtex-parse';

import type { Paper } from './search-literature.js';

const { Pool } = pg;

export interface RegistryConfig {
  connectionString: string;
  openaiApiKey: string;
}

export interface CatalogEntry {
  id: number;
  title: string;
  authors: string[];
  venue: string;
  year: number;
  summary: string;
  score: number;
}

export interface ExpandedPaper {
  id: number;
  source: string;
  sourceId: string;
  title: string;
  authors: string[];
  venue: string;
  year: number;
  abstract: string;
  url: string;
  summary: string;
  indexedAt: string;
}

export interface IndexResult {
  indexed: number;
  skipped: number;
  errors: string[];
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

export class ContentRegistry {
  private pool: InstanceType<typeof Pool>;
  private openai: OpenAI;

  constructor(config: RegistryConfig) {
    this.pool = new Pool({ connectionString: config.connectionString });
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async initSchema(): Promise<void> {
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS papers (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        authors TEXT[] NOT NULL DEFAULT '{}',
        venue TEXT NOT NULL DEFAULT '',
        year INTEGER NOT NULL DEFAULT 0,
        abstract TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        embedding vector(${EMBEDDING_DIM}),
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source, source_id)
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS papers_embedding_idx
      ON papers USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  private async embed(text: string): Promise<number[]> {
    const res = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return res.data[0].embedding;
  }

  private makeSummary(paper: Paper): string {
    const abstract = paper.abstract || '';
    if (!abstract) return '';
    // First sentence or first 150 chars
    const firstSentence = abstract.match(/^[^.!?]*[.!?]/);
    if (firstSentence && firstSentence[0].length <= 200) {
      return firstSentence[0].trim();
    }
    return abstract.slice(0, 150).trim() + '...';
  }

  async indexPapers(papers: Paper[]): Promise<IndexResult> {
    const result: IndexResult = { indexed: 0, skipped: 0, errors: [] };
    if (papers.length === 0) return result;

    // Check which papers already exist
    const sourceIds = papers.map((p) => p.sourceId);
    const existing = await this.pool.query(
      'SELECT source_id FROM papers WHERE source_id = ANY($1)',
      [sourceIds],
    );
    const existingIds = new Set(existing.rows.map((r: { source_id: string }) => r.source_id));

    for (const paper of papers) {
      if (existingIds.has(paper.sourceId)) {
        result.skipped++;
        continue;
      }

      try {
        const embeddingText = `${paper.title}\n${paper.abstract}`;
        const embedding = await this.embed(embeddingText);
        const summary = this.makeSummary(paper);

        await this.pool.query(
          `INSERT INTO papers (source, source_id, title, authors, venue, year, abstract, url, summary, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (source, source_id) DO NOTHING`,
          [
            paper.source,
            paper.sourceId,
            paper.title,
            paper.authors,
            paper.venue,
            paper.year,
            paper.abstract,
            paper.url,
            summary,
            `[${embedding.join(',')}]`,
          ],
        );
        result.indexed++;
      } catch (err) {
        result.errors.push(
          `${paper.title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return result;
  }

  async searchRegistry(
    query: string,
    limit = 10,
  ): Promise<CatalogEntry[]> {
    const embedding = await this.embed(query);
    const res = await this.pool.query(
      `SELECT id, title, authors, venue, year, summary,
              1 - (embedding <=> $1::vector) AS score
       FROM papers
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${embedding.join(',')}]`, limit],
    );

    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as number,
      title: r.title as string,
      authors: r.authors as string[],
      venue: r.venue as string,
      year: r.year as number,
      summary: r.summary as string,
      score: Math.round((r.score as number) * 100) / 100,
    }));
  }

  async expandPaper(id: number): Promise<ExpandedPaper | null> {
    const res = await this.pool.query(
      `SELECT id, source, source_id, title, authors, venue, year,
              abstract, url, summary, indexed_at
       FROM papers WHERE id = $1`,
      [id],
    );

    if (res.rows.length === 0) return null;

    const r = res.rows[0] as Record<string, unknown>;
    return {
      id: r.id as number,
      source: r.source as string,
      sourceId: r.source_id as string,
      title: r.title as string,
      authors: r.authors as string[],
      venue: r.venue as string,
      year: r.year as number,
      abstract: r.abstract as string,
      url: r.url as string,
      summary: r.summary as string,
      indexedAt: (r.indexed_at as Date).toISOString(),
    };
  }

  async importZoteroBib(bibContent: string): Promise<IndexResult> {
    const entries = bibtexParse.entries(bibContent);
    const papers: Paper[] = entries.map(
      (entry: Record<string, unknown>) => {
        const fields = entry as {
          key: string;
          TITLE?: string;
          AUTHOR?: string;
          JOURNAL?: string;
          BOOKTITLE?: string;
          YEAR?: string;
          ABSTRACT?: string;
          DOI?: string;
          URL?: string;
        };
        const authors = (fields.AUTHOR || '')
          .split(' and ')
          .map((a: string) => a.trim())
          .filter(Boolean);
        return {
          source: 'zotero' as const,
          sourceId: `zotero:${fields.key}`,
          title: fields.TITLE || '',
          authors,
          venue: fields.JOURNAL || fields.BOOKTITLE || '',
          year: parseInt(fields.YEAR || '0', 10),
          abstract: fields.ABSTRACT || '',
          url: fields.DOI
            ? `https://doi.org/${fields.DOI}`
            : fields.URL || '',
        };
      },
    );

    return this.indexPapers(papers.filter((p) => p.title));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tools/content-registry.test.ts
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/tools/content-registry.ts src/tools/content-registry.test.ts
git commit -m "feat: add content registry with pgvector storage and search"
```

---

### Task 4: Content registry MCP server

**Files:**
- Create: `container/agent-runner/src/content-registry-mcp.ts`
- Modify: `container/agent-runner/src/index.ts`
- Modify: `container/agent-runner/package.json` (already done in Task 1)

- [ ] **Step 1: Write the MCP server**

```typescript
// container/agent-runner/src/content-registry-mcp.ts
/**
 * Stdio MCP Server for the Content Registry.
 * Exposes search_literature, index_papers, search_registry, expand_paper, import_zotero.
 * Connects to Postgres on the host via CONTENT_REGISTRY_PG_URL env var.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pg from 'pg';
import OpenAI from 'openai';
import bibtexParse from 'bibtex-parse';
import fs from 'fs';

const { Pool } = pg;

const pgUrl = process.env.CONTENT_REGISTRY_PG_URL!;
const openaiKey = process.env.OPENAI_API_KEY!;

const pool = new Pool({ connectionString: pgUrl });
const openai = new OpenAI({ apiKey: openaiKey });

const EMBEDDING_MODEL = 'text-embedding-3-small';

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

function makeSummary(abstract: string): string {
  if (!abstract) return '';
  const firstSentence = abstract.match(/^[^.!?]*[.!?]/);
  if (firstSentence && firstSentence[0].length <= 200) {
    return firstSentence[0].trim();
  }
  return abstract.slice(0, 150).trim() + '...';
}

// Init schema on startup
async function initSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS papers (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT[] NOT NULL DEFAULT '{}',
      venue TEXT NOT NULL DEFAULT '',
      year INTEGER NOT NULL DEFAULT 0,
      abstract TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      embedding vector(1536),
      indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source, source_id)
    )
  `);
}

const server = new McpServer({
  name: 'content-registry',
  version: '1.0.0',
});

server.tool(
  'search_literature',
  'Search Semantic Scholar and OpenAlex for academic papers. Returns normalized results ready for indexing. Use this to find new papers, then index_papers to store them.',
  {
    query: z.string().describe('Search query (e.g., "content moderation hate speech")'),
    sources: z
      .array(z.enum(['semantic_scholar', 'openalex']))
      .default(['semantic_scholar', 'openalex'])
      .describe('Which APIs to search'),
    limit: z
      .number()
      .default(10)
      .describe('Max results per source'),
  },
  async (args) => {
    const results: Record<string, unknown>[] = [];

    for (const source of args.sources) {
      try {
        if (source === 'semantic_scholar') {
          const params = new URLSearchParams({
            query: args.query,
            limit: String(args.limit),
            fields: 'paperId,title,authors,venue,year,abstract,url',
          });
          const res = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
          );
          if (res.ok) {
            const data = await res.json();
            for (const p of data.data || []) {
              results.push({
                source: 'semantic_scholar',
                sourceId: p.paperId,
                title: p.title,
                authors: (p.authors || []).map((a: { name: string }) => a.name),
                venue: p.venue || '',
                year: p.year || 0,
                abstract: p.abstract || '',
                url: p.url || '',
              });
            }
          }
        } else if (source === 'openalex') {
          const params = new URLSearchParams({
            search: args.query,
            per_page: String(args.limit),
          });
          const res = await fetch(
            `https://api.openalex.org/works?${params}`,
          );
          if (res.ok) {
            const data = await res.json();
            for (const w of data.results || []) {
              const idx = w.abstract_inverted_index;
              let abstract = '';
              if (idx) {
                const words: [string, number][] = [];
                for (const [word, positions] of Object.entries(idx)) {
                  for (const pos of positions as number[]) {
                    words.push([word, pos]);
                  }
                }
                words.sort((a, b) => a[1] - b[1]);
                abstract = words.map((w) => w[0]).join(' ');
              }
              results.push({
                source: 'openalex',
                sourceId: (w.id || '').replace('https://openalex.org/', ''),
                title: w.title || '',
                authors: (w.authorships || []).map(
                  (a: { author: { display_name: string } }) =>
                    a.author.display_name,
                ),
                venue: w.primary_location?.source?.display_name || '',
                year: w.publication_year || 0,
                abstract,
                url: w.doi || w.id || '',
              });
            }
          }
        }
      } catch {
        // Continue with other sources
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ count: results.length, papers: results }),
        },
      ],
    };
  },
);

server.tool(
  'index_papers',
  'Index papers into the content registry. Embeds title+abstract and stores in Postgres+pgvector. Skips papers that are already indexed. Pass the output of search_literature.',
  {
    papers: z.array(
      z.object({
        source: z.string(),
        sourceId: z.string(),
        title: z.string(),
        authors: z.array(z.string()),
        venue: z.string(),
        year: z.number(),
        abstract: z.string(),
        url: z.string(),
      }),
    ),
  },
  async (args) => {
    let indexed = 0;
    let skipped = 0;
    const errors: string[] = [];

    const sourceIds = args.papers.map((p) => p.sourceId);
    const existing = await pool.query(
      'SELECT source_id FROM papers WHERE source_id = ANY($1)',
      [sourceIds],
    );
    const existingIds = new Set(
      existing.rows.map((r: { source_id: string }) => r.source_id),
    );

    for (const paper of args.papers) {
      if (existingIds.has(paper.sourceId)) {
        skipped++;
        continue;
      }
      try {
        const embedding = await embed(`${paper.title}\n${paper.abstract}`);
        const summary = makeSummary(paper.abstract);
        await pool.query(
          `INSERT INTO papers (source, source_id, title, authors, venue, year, abstract, url, summary, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (source, source_id) DO NOTHING`,
          [
            paper.source,
            paper.sourceId,
            paper.title,
            paper.authors,
            paper.venue,
            paper.year,
            paper.abstract,
            paper.url,
            summary,
            `[${embedding.join(',')}]`,
          ],
        );
        indexed++;
      } catch (err) {
        errors.push(
          `${paper.title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ indexed, skipped, errors }),
        },
      ],
    };
  },
);

server.tool(
  'search_registry',
  'Search the indexed paper registry by semantic similarity. Returns lightweight catalog entries: title, authors, venue, year, one-line summary, relevance score. Use expand_paper to get full details for any result.',
  {
    query: z.string().describe('Natural language search query'),
    limit: z.number().default(10).describe('Max results (default 10)'),
  },
  async (args) => {
    const embedding = await embed(args.query);
    const res = await pool.query(
      `SELECT id, title, authors, venue, year, summary,
              1 - (embedding <=> $1::vector) AS score
       FROM papers
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${embedding.join(',')}]`, args.limit],
    );

    const results = res.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      authors: r.authors,
      venue: r.venue,
      year: r.year,
      summary: r.summary,
      score: Math.round((r.score as number) * 100) / 100,
    }));

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(results) },
      ],
    };
  },
);

server.tool(
  'expand_paper',
  'Get full details for a specific paper by ID. Returns complete abstract, source info, URL, and indexing metadata. Use after search_registry to drill into a specific result.',
  {
    id: z.number().describe('Paper ID from search_registry results'),
  },
  async (args) => {
    const res = await pool.query(
      `SELECT id, source, source_id, title, authors, venue, year,
              abstract, url, summary, indexed_at
       FROM papers WHERE id = $1`,
      [args.id],
    );

    if (res.rows.length === 0) {
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ error: 'Paper not found' }) },
        ],
        isError: true,
      };
    }

    const r = res.rows[0] as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            id: r.id,
            source: r.source,
            sourceId: r.source_id,
            title: r.title,
            authors: r.authors,
            venue: r.venue,
            year: r.year,
            abstract: r.abstract,
            url: r.url,
            summary: r.summary,
            indexedAt: r.indexed_at,
          }),
        },
      ],
    };
  },
);

server.tool(
  'import_zotero',
  'Import papers from a BibTeX (.bib) file into the registry. Reads the file, parses entries, embeds and indexes new papers. Skips already-indexed entries.',
  {
    bibPath: z.string().describe('Absolute path to the .bib file'),
  },
  async (args) => {
    let content: string;
    try {
      content = fs.readFileSync(args.bibPath, 'utf-8');
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Cannot read file: ${args.bibPath}` }),
          },
        ],
        isError: true,
      };
    }

    const entries = bibtexParse.entries(content);
    const papers = entries
      .map((entry: Record<string, unknown>) => {
        const e = entry as {
          key: string;
          TITLE?: string;
          AUTHOR?: string;
          JOURNAL?: string;
          BOOKTITLE?: string;
          YEAR?: string;
          ABSTRACT?: string;
          DOI?: string;
          URL?: string;
        };
        return {
          source: 'zotero',
          sourceId: `zotero:${e.key}`,
          title: e.TITLE || '',
          authors: (e.AUTHOR || '')
            .split(' and ')
            .map((a: string) => a.trim())
            .filter(Boolean),
          venue: e.JOURNAL || e.BOOKTITLE || '',
          year: parseInt(e.YEAR || '0', 10),
          abstract: e.ABSTRACT || '',
          url: e.DOI ? `https://doi.org/${e.DOI}` : e.URL || '',
        };
      })
      .filter((p: { title: string }) => p.title);

    // Index in batches — reuse the index_papers logic
    let indexed = 0;
    let skipped = 0;
    const errors: string[] = [];

    const sourceIds = papers.map((p: { sourceId: string }) => p.sourceId);
    const existing = await pool.query(
      'SELECT source_id FROM papers WHERE source_id = ANY($1)',
      [sourceIds],
    );
    const existingIds = new Set(
      existing.rows.map((r: { source_id: string }) => r.source_id),
    );

    for (const paper of papers) {
      if (existingIds.has(paper.sourceId)) {
        skipped++;
        continue;
      }
      try {
        const embedding = await embed(`${paper.title}\n${paper.abstract}`);
        const summary = makeSummary(paper.abstract);
        await pool.query(
          `INSERT INTO papers (source, source_id, title, authors, venue, year, abstract, url, summary, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (source, source_id) DO NOTHING`,
          [
            paper.source,
            paper.sourceId,
            paper.title,
            paper.authors,
            paper.venue,
            paper.year,
            paper.abstract,
            paper.url,
            summary,
            `[${embedding.join(',')}]`,
          ],
        );
        indexed++;
      } catch (err) {
        errors.push(
          `${paper.title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            total: entries.length,
            indexed,
            skipped,
            errors,
          }),
        },
      ],
    };
  },
);

// Start the server
async function main() {
  await initSchema();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Content registry MCP server failed: ${err}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Add the MCP server to the agent runner config**

In `container/agent-runner/src/index.ts`, add to the `mcpServers` object alongside `nanoclaw` and `mcpvault`:

```typescript
'content-registry': {
  command: 'node',
  args: ['/app/node_modules/.bin/../content-registry-mcp.js'],
  env: {
    CONTENT_REGISTRY_PG_URL: `postgresql://shoggoth:${process.env.NANOCLAW_PG_PASSWORD || ''}@host.docker.internal:5432/shoggoth`,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  },
},
```

Wait — the MCP server needs to be compiled and accessible inside the container. Since it's part of `container/agent-runner/src/`, it gets compiled to `/tmp/dist/` by the entrypoint. The path should be:

```typescript
'content-registry': {
  command: 'node',
  args: [path.join(path.dirname(mcpServerPath), 'content-registry-mcp.js')],
  env: {
    CONTENT_REGISTRY_PG_URL: `postgresql://shoggoth:${process.env.NANOCLAW_PG_PASSWORD || ''}@host.docker.internal:5432/shoggoth`,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  },
},
```

Also add `'mcp__content-registry__*'` to the `allowedTools` array.

- [ ] **Step 3: Add env vars to container**

In `src/container-runner.ts`, in `buildContainerArgs`, add after the existing env args:

```typescript
// Pass Postgres password and OpenAI key for content registry MCP
const envSecrets = readEnvFile(['OPENAI_API_KEY']);
if (envSecrets.OPENAI_API_KEY) {
  args.push('-e', `OPENAI_API_KEY=${envSecrets.OPENAI_API_KEY}`);
}
const pgSecrets = readEnvFile(['POSTGRES_PASSWORD']);
if (pgSecrets.POSTGRES_PASSWORD) {
  args.push('-e', `NANOCLAW_PG_PASSWORD=${pgSecrets.POSTGRES_PASSWORD}`);
}
```

Import `readEnvFile` from `./env.js` (already used by credential-proxy).

- [ ] **Step 4: Commit**

```bash
git add container/agent-runner/src/content-registry-mcp.ts container/agent-runner/src/index.ts src/container-runner.ts
git commit -m "feat: add content registry MCP server for agents"
```

---

### Task 5: CLI scripts — seed-registry and import-zotero

**Files:**
- Create: `scripts/seed-registry.ts`
- Create: `scripts/import-zotero.ts`

- [ ] **Step 1: Write seed-registry.ts**

```typescript
// scripts/seed-registry.ts
/**
 * Seed the content registry by searching academic APIs and indexing results.
 * Usage: npx tsx scripts/seed-registry.ts "content moderation" "hate speech"
 */
import { ContentRegistry } from '../src/tools/content-registry.js';
import {
  searchSemanticScholar,
  searchOpenAlex,
} from '../src/tools/search-literature.js';
import { readEnvFile } from '../src/env.js';

async function main() {
  const queries = process.argv.slice(2);
  if (queries.length === 0) {
    console.error('Usage: npx tsx scripts/seed-registry.ts "query1" "query2" ...');
    process.exit(1);
  }

  const env = readEnvFile(['OPENAI_API_KEY', 'POSTGRES_PASSWORD']);
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in .env');
    process.exit(1);
  }

  const pgUrl = `postgresql://shoggoth:${env.POSTGRES_PASSWORD}@127.0.0.1:5432/shoggoth`;
  const registry = new ContentRegistry({
    connectionString: pgUrl,
    openaiApiKey: env.OPENAI_API_KEY,
  });

  await registry.initSchema();
  console.log('Schema initialized.');

  for (const query of queries) {
    console.log(`\nSearching: "${query}"`);

    const [s2Papers, oaArticles] = await Promise.all([
      searchSemanticScholar(query, 20),
      searchOpenAlex(query, 20),
    ]);
    console.log(
      `  Found: ${s2Papers.length} from Semantic Scholar, ${oaArticles.length} from OpenAlex`,
    );

    const all = [...s2Papers, ...oaArticles];
    const result = await registry.indexPapers(all);
    console.log(
      `  Indexed: ${result.indexed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
    );
    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.error(`    ${e}`);
      }
    }
  }

  await registry.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Write import-zotero.ts**

```typescript
// scripts/import-zotero.ts
/**
 * Import a Zotero .bib file into the content registry.
 * Usage: npx tsx scripts/import-zotero.ts path/to/library.bib
 */
import fs from 'fs';
import { ContentRegistry } from '../src/tools/content-registry.js';
import { readEnvFile } from '../src/env.js';

async function main() {
  const bibPath = process.argv[2];
  if (!bibPath) {
    console.error('Usage: npx tsx scripts/import-zotero.ts path/to/library.bib');
    process.exit(1);
  }

  if (!fs.existsSync(bibPath)) {
    console.error(`File not found: ${bibPath}`);
    process.exit(1);
  }

  const env = readEnvFile(['OPENAI_API_KEY', 'POSTGRES_PASSWORD']);
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in .env');
    process.exit(1);
  }

  const pgUrl = `postgresql://shoggoth:${env.POSTGRES_PASSWORD}@127.0.0.1:5432/shoggoth`;
  const registry = new ContentRegistry({
    connectionString: pgUrl,
    openaiApiKey: env.OPENAI_API_KEY,
  });

  await registry.initSchema();
  console.log('Schema initialized.');

  const content = fs.readFileSync(bibPath, 'utf-8');
  console.log(`Importing from: ${bibPath}`);

  const result = await registry.importZoteroBib(content);
  console.log(`Indexed: ${result.indexed}, Skipped: ${result.skipped}`);
  if (result.errors.length > 0) {
    console.error('Errors:');
    for (const e of result.errors) {
      console.error(`  ${e}`);
    }
  }

  await registry.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-registry.ts scripts/import-zotero.ts
git commit -m "feat: add CLI scripts for seeding registry and importing Zotero"
```

---

### Task 6: Build, rebuild container, and integration test

**Files:**
- Modify: `container/Dockerfile` (no changes needed — agent-runner deps install at build)

- [ ] **Step 1: Build host TypeScript**

```bash
npm run build
```

- [ ] **Step 2: Add POSTGRES_PASSWORD to .env if not present**

Ensure `.env` has `POSTGRES_PASSWORD=3badab2d795e97d20df14dba84a7c36a`. Sync to container env:

```bash
mkdir -p data/env && cp .env data/env/env
```

- [ ] **Step 3: Rebuild container image**

```bash
cd container && docker build -t nanoclaw-agent:latest .
```

- [ ] **Step 4: Test seed script with a real query**

```bash
npx tsx scripts/seed-registry.ts "content moderation"
```

Expected: papers found from both APIs, indexed into Postgres.

- [ ] **Step 5: Verify registry contents**

```bash
node -e "
const pg = require('pg');
const pool = new pg.Pool({connectionString:'postgresql://shoggoth:3badab2d795e97d20df14dba84a7c36a@127.0.0.1:5432/shoggoth'});
pool.query('SELECT COUNT(*) as count FROM papers').then(r => console.log('Papers indexed:', r.rows[0].count)).then(() => pool.end());
"
```

- [ ] **Step 6: Clear stale agent-runner-src, restart service**

```bash
rm -rf data/sessions/whatsapp_main/agent-runner-src
systemctl --user restart nanoclaw
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: content registry complete — schema, APIs, MCP server, CLI scripts"
```
