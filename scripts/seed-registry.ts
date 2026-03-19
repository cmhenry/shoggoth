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
    console.error(
      'Usage: npx tsx scripts/seed-registry.ts "query1" "query2" ...',
    );
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
