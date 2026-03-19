import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { searchSemanticScholar, searchOpenAlex } from './search-literature.js';

describe('searchSemanticScholar', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns normalized papers', async () => {
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

  it('returns normalized papers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'https://openalex.org/W123',
            title: 'Platform Governance',
            authorships: [{ author: { display_name: 'Carol White' } }],
            primary_location: { source: { display_name: 'ICWSM 2025' } },
            publication_year: 2025,
            abstract_inverted_index: {
              We: [0],
              study: [1],
              platforms: [2],
            },
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
