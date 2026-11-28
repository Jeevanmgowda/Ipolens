import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { NotificationBodySchema, firstIssue } from '@/lib/security/schemas';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { publicErrorMessage } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
  const userId = user.id;

  const notifications = await DbRepositoryService.getNotifications(userId);

  return NextResponse.json({
    success: true,
    data: notifications,
    unreadCount: notifications.filter((n: any) => !n.read).length,
  });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    const userId = user.id;

    const parsed = NotificationBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { action, id, type, title, message, symbol, metadata } = parsed.data;

    if (action === 'markRead' && id) {
      await DbRepositoryService.markNotificationRead(id, userId);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    if (!title || !message) {
      return NextResponse.json({ success: false, error: 'Title and message are required' }, { status: 400 });
    }

    const created = await DbRepositoryService.createNotification(
      userId,
      type || 'SYSTEM',
      title,
      message,
      symbol,
      metadata
    );

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
