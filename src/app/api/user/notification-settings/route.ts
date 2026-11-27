import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireUser } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';
import { formatIndianWhatsApp } from '@/lib/services/notification.service';

export const dynamic = 'force-dynamic';

const mask = (p: string | null) => (p ? `${p.slice(0, 3)}******${p.slice(-2)}` : null);

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const db = getDb();
    const [row] = await db.select({ phone: schema.usersTable.phone, optIn: schema.usersTable.whatsappOptIn }).from(schema.usersTable).where(eq(schema.usersTable.id, user.id));
    const subs = await db.select({ id: schema.pushSubscriptionsTable.id }).from(schema.pushSubscriptionsTable).where(eq(schema.pushSubscriptionsTable.userId, user.id));
    return NextResponse.json({
      success: true,
      data: {
        phoneMasked: mask(row?.phone ?? null),
        whatsappOptIn: row?.optIn ?? false,
        pushDevices: subs.length,
        whatsappConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_FROM),
      },
    });
  } catch (err) {
    return handleRouteError(err, 'notification-settings:GET');
  }
}

const Body = z.object({ phone: z.string().trim().max(20).optional(), whatsappOptIn: z.boolean() });

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = Body.parse(await request.json());
    let phone: string | undefined;
    if (body.phone) {
      const formatted = formatIndianWhatsApp(body.phone);
      if (!formatted) return jsonError(400, 'Enter a valid mobile number (10 digits, or with country code).');
      phone = formatted;
    }
    if (body.whatsappOptIn && !phone) {
      const [row] = await getDb().select({ phone: schema.usersTable.phone }).from(schema.usersTable).where(eq(schema.usersTable.id, user.id));
      if (!row?.phone) return jsonError(400, 'Add a mobile number to enable WhatsApp alerts.');
    }
    await getDb()
      .update(schema.usersTable)
      .set({ ...(phone ? { phone } : {}), whatsappOptIn: body.whatsappOptIn, updatedAt: new Date() })
      .where(eq(schema.usersTable.id, user.id));
    return NextResponse.json({ success: true, data: { phoneMasked: mask(phone ?? null), whatsappOptIn: body.whatsappOptIn } });
  } catch (err) {
    return handleRouteError(err, 'notification-settings:PUT');
  }
}
