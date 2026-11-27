import { inngest, EVENTS } from '../client';
import { indexDocument } from '@/lib/services/drhp/document.service';
import { runAndStoreAnalysis } from '@/lib/services/drhp/analyst.service';

/** Chunk + embed a registered DRHP, then run the 4-factor analysis. */
export const drhpIndexFunction = inngest.createFunction(
  { id: 'drhp-index', concurrency: { limit: 2 }, retries: 2, triggers: [{ event: EVENTS.indexDrhp }] },
  async ({ event, step }) => {
    const documentId = String((event.data as { documentId: string }).documentId);
    const indexed = await step.run('index', () => indexDocument(documentId));
    const analysisId = await step.run('analyze', () => runAndStoreAnalysis(documentId));
    return { documentId, ...indexed, analysisId };
  }
);

export const drhpAnalyzeFunction = inngest.createFunction(
  { id: 'drhp-analyze', concurrency: { limit: 2 }, retries: 1, triggers: [{ event: EVENTS.analyzeDrhp }] },
  async ({ event, step }) => {
    const documentId = String((event.data as { documentId: string }).documentId);
    const analysisId = await step.run('analyze', () => runAndStoreAnalysis(documentId));
    return { documentId, analysisId };
  }
);
