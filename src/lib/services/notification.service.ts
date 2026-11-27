import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { env } from '@/lib/env';
import { DbRepositoryService } from '@/lib/services/db-repository.service';

/**
 * Allotment notifications over three channels: in-app, Web Push (VAPID) and WhatsApp (Twilio).
 * notification_log (unique on application, channel, outcome) guarantees one message per outcome
 * per channel, and channels run with Promise.allSettled so one failure never blocks another.
 */

export type Channel = 'IN_APP' | 'WEB_PUSH' | 'WHATSAPP';

export interface AllotmentNotice {
  applicationId: string;
  userId: string;
  outcome: 'ALLOTTED' | 'NOT_ALLOTTED';
  symbol: string;
  companyName: string;
  holderName: string;
  panMasked: string;
  sharesAllotted: number;
  refundAmount: number;
}

/** Adds +91 when a 10-digit Indian mobile number is given without a country code. */
export function formatIndianWhatsApp(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const bare = digits.replace(/^\+/, '');
  if (/^[6-9]\d{9}$/.test(bare)) return `+91${bare}`;
  if (/^91[6-9]\d{9}$/.test(bare)) return `+${bare}`;
  if (/^0[6-9]\d{9}$/.test(bare)) return `+91${bare.slice(1)}`;
  return null;
}

export function messageFor(n: AllotmentNotice): { title: string; body: string } {
  if (n.outcome === 'ALLOTTED') {
    return {
      title: `Allotted: ${n.companyName}`,
      body: `${n.holderName} (${n.panMasked}) was allotted ${n.sharesAllotted} shares of ${n.companyName}.${
        n.refundAmount > 0 ? ` Refund of Rs ${n.refundAmount.toLocaleString('en-IN')} will be released.` : ''
      }`,
    };
  }
  return {
    title: `Not allotted: ${n.companyName}`,
    body: `${n.holderName} (${n.panMasked}) did not receive an allotment in ${n.companyName}. Your blocked amount will be released.`,
  };
}

/** Claims the (application, channel, outcome) slot. Returns false if already claimed. */
async function claim(n: AllotmentNotice, channel: Channel): Promise<boolean> {
  const rows = await getDb()
    .insert(schema.notificationLogTable)
    .values({ applicationId: n.applicationId, channel, outcome: n.outcome, status: 'PENDING' })
    .onConflictDoNothing()
    .returning({ id: schema.notificationLogTable.id });
  return rows.length > 0;
}

async function finish(n: AllotmentNotice, channel: Channel, status: 'SENT' | 'FAILED' | 'SKIPPED', error?: string) {
  await getDb()
    .update(schema.notificationLogTable)
    .set({ status, error: error?.slice(0, 500) ?? null, sentAt: new Date() })
    .where(
      and(
        eq(schema.notificationLogTable.applicationId, n.applicationId),
        eq(schema.notificationLogTable.channel, channel),
        eq(schema.notificationLogTable.outcome, n.outcome)
      )
    );
}

export interface ChannelSenders {
  webPush: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>;
  whatsapp: (to: string, body: string, n: AllotmentNotice) => Promise<void>;
}

/** Production senders (lazy-loaded so tests and unconfigured environments never import them). */
export const defaultSenders: ChannelSenders = {
  async webPush(sub, payload) {
    const webpush = (await import('web-push')).default;
    const e = env();
    if (!e.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) throw new Error('Web Push is not configured (VAPID keys).');
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    await webpush.sendNotification(sub, payload, { TTL: 24 * 3600 });
  },
  async whatsapp(to, body, n) {
    const e = env();
    if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !e.TWILIO_WHATSAPP_FROM) throw new Error('Twilio WhatsApp is not configured.');
    const twilio = (await import('twilio')).default;
    const client = twilio(e.TWILIO_ACCOUNT_SID, e.TWILIO_AUTH_TOKEN);
    const templateSid = n.outcome === 'ALLOTTED' ? e.TWILIO_TEMPLATE_ALLOTTED_SID : e.TWILIO_TEMPLATE_NOT_ALLOTTED_SID;
    const from = e.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:') ? e.TWILIO_WHATSAPP_FROM : `whatsapp:${e.TWILIO_WHATSAPP_FROM}`;
    await client.messages.create(
      templateSid
        ? {
            from,
            to: `whatsapp:${to}`,
            contentSid: templateSid,
            contentVariables: JSON.stringify({
              1: n.holderName,
              2: n.companyName,
              3: String(n.sharesAllotted),
              4: n.refundAmount.toLocaleString('en-IN'),
            }),
          }
        : { from, to: `whatsapp:${to}`, body }
    );
  },
};

export async function notifyAllotmentOutcome(
  n: AllotmentNotice,
  senders: ChannelSenders = defaultSenders
): Promise<Record<Channel, 'SENT' | 'FAILED' | 'SKIPPED' | 'DUPLICATE'>> {
  const db = getDb();
  const { title, body } = messageFor(n);
  const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, n.userId)).limit(1);

  const run = async (channel: Channel, send: () => Promise<'SENT' | 'SKIPPED'>) => {
    if (!(await claim(n, channel))) return 'DUPLICATE' as const;
    try {
      const status = await send();
      await finish(n, channel, status);
      return status;
    } catch (err) {
      await finish(n, channel, 'FAILED', (err as Error).message);
      throw err;
    }
  };

  const tasks: Array<[Channel, () => Promise<'SENT' | 'SKIPPED' | 'DUPLICATE'>]> = [
    [
      'IN_APP',
      () =>
        run('IN_APP', async () => {
          await DbRepositoryService.createNotification(n.userId, 'ALLOTMENT_OUT', title, body, n.symbol, {
            applicationId: n.applicationId,
            outcome: n.outcome,
          });
          return 'SENT';
        }),
    ],
    [
      'WEB_PUSH',
      () =>
        run('WEB_PUSH', async () => {
          const subs = await db.select().from(schema.pushSubscriptionsTable).where(eq(schema.pushSubscriptionsTable.userId, n.userId));
          if (!subs.length) return 'SKIPPED';
          const payload = JSON.stringify({ title, body, url: '/?tab=portfolio', tag: `allotment-${n.applicationId}` });
          let delivered = 0;
          for (const s of subs) {
            try {
              await senders.webPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
              delivered++;
            } catch (err) {
              const code = (err as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) {
                // Subscription expired or was revoked by the browser: remove it.
                await db.delete(schema.pushSubscriptionsTable).where(eq(schema.pushSubscriptionsTable.endpoint, s.endpoint));
              } else throw err;
            }
          }
          return delivered ? 'SENT' : 'SKIPPED';
        }),
    ],
    [
      'WHATSAPP',
      () =>
        run('WHATSAPP', async () => {
          if (!user?.whatsappOptIn || !user.phone) return 'SKIPPED';
          const to = formatIndianWhatsApp(user.phone);
          if (!to) return 'SKIPPED';
          await senders.whatsapp(to, body, n);
          return 'SENT';
        }),
    ],
  ];

  const settled = await Promise.allSettled(tasks.map(([, t]) => t()));
  const out = {} as Record<Channel, 'SENT' | 'FAILED' | 'SKIPPED' | 'DUPLICATE'>;
  settled.forEach((r, i) => {
    out[tasks[i][0]] = r.status === 'fulfilled' ? r.value : 'FAILED';
  });
  return out;
}
