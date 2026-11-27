import { Inngest } from 'inngest';

/** Inngest client. Locally run `npx inngest-cli dev`; in production set INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY. */
export const inngest = new Inngest({ id: 'ipolens' });

export const EVENTS = {
  ingestIpos: 'ipolens/ipos.ingest',
  refitGmpModel: 'ipolens/gmp.refit',
  indexDrhp: 'ipolens/drhp.index',
  analyzeDrhp: 'ipolens/drhp.analyze',
  allotmentOutcome: 'ipolens/allotment.outcome',
} as const;

/** True when events can be delivered (dev server or cloud keys present). */
export function inngestAvailable(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);
}
