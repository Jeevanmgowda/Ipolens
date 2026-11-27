import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireUser } from '@/lib/security/session';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const Subscription = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(10).max(512), auth: z.string().min(4).max(256) }),
});

/** Public VAPID key for the browser to subscribe with. */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  return NextResponse.json({ success: true, configured: Boolean(key && process.env.VAPID_PRIVATE_KEY), publicKey: key });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const sub = Subscription.parse(await request.json());
    await getDb()
      .insert(schema.pushSubscriptionsTable)
      .values({ userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({
        target: schema.pushSubscriptionsTable.endpoint,
        set: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, 'push/subscribe:POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const { endpoint } = z.object({ endpoint: z.string().url().max(2048) }).parse(await request.json());
    await getDb()
      .delete(schema.pushSubscriptionsTable)
      .where(and(eq(schema.pushSubscriptionsTable.endpoint, endpoint), eq(schema.pushSubscriptionsTable.userId, user.id)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, 'push/subscribe:DELETE');
  }
}
