import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  const userId = user ? user.id : 'default_user';

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
    const userId = user ? user.id : 'default_user';

    const body = await request.json();
    const { action, id, type, title, message, symbol, metadata } = body;

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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
