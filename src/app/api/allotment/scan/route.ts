import { NextResponse } from 'next/server';
import { z } from 'zod';
import { scanRegistrarText } from '@/lib/services/allotment/text-parser';
import { REGISTRARS } from '@/lib/registrars';
import { handleRouteError } from '@/lib/http';

/** Registrar directory for the manual (Path B) flow. */
export async function GET() {
  return NextResponse.json({ success: true, registrars: Object.values(REGISTRARS) });
}

const Body = z.object({ text: z.string().min(1).max(20000) });

/** Classifies text the user copied from a registrar's allotment page. */
export async function POST(request: Request) {
  try {
    const { text } = Body.parse(await request.json());
    const data = scanRegistrarText(text);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleRouteError(err, 'allotment/scan');
  }
}
