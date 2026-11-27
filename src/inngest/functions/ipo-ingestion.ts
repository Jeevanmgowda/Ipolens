import { inngest, EVENTS } from '../client';
import { runIpoIngestion } from '@/lib/ingestion/ipo-ingestion.service';
import { refitGmpModel, predictActiveIpos } from '@/lib/services/gmp-prediction.service';

/** Live IPO ingestion: every 15 min during Indian market hours on weekdays, hourly otherwise. */
export const ipoIngestionCron = inngest.createFunction(
  {
    id: 'ipo-ingestion',
    concurrency: { limit: 1 },
    triggers: [
      { cron: 'TZ=Asia/Kolkata */15 9-18 * * 1-5' },
      { cron: 'TZ=Asia/Kolkata 0 0-8,19-23 * * *' },
      { cron: 'TZ=Asia/Kolkata 0 9-18 * * 0,6' },
      { event: EVENTS.ingestIpos },
    ],
  },
  async ({ step }) => {
    const report = await step.run('ingest-live-ipos', () => runIpoIngestion());
    const predictions = await step.run('predict-gmp', () => predictActiveIpos());
    return { report, predictions };
  }
);

/** Nightly refit of the AI listing-gain model on all listed IPOs in the database. */
export const gmpModelRefitCron = inngest.createFunction(
  {
    id: 'gmp-model-refit',
    triggers: [{ cron: 'TZ=Asia/Kolkata 30 2 * * *' }, { event: EVENTS.refitGmpModel }],
  },
  async ({ step }) => {
    const model = await step.run('refit', () => refitGmpModel());
    const predictions = await step.run('predict', () => predictActiveIpos());
    return { model, predictions };
  }
);
