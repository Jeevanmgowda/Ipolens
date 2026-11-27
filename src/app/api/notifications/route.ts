import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUser } from '@/lib/security/session';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const notifications = await DbRepositoryService.getNotifications(user.id);
    return NextResponse.json({ success: true, data: notifications, unreadCount: notifications.filter((n) => !n.read).length });
  } catch (err) {
    return handleRouteError(err, 'notifications:GET');
  }
}

const Body = z.object({ action: z.literal('markRead'), id: z.string().min(1).max(64) });

/** Notifications are created by the server (allotment engine, alerts); clients can only mark them read. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { id } = Body.parse(await request.json());
    await DbRepositoryService.markNotificationRead(id, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, 'notifications:POST');
  }
}
