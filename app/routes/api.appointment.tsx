import type {Route} from './+types/api.appointment';
import {parseAppointment, bookAppointment} from '~/lib/appointments.server';

// POST target for the "Book Private Consultation" form. All Admin API work is
// server-side in appointments.server.ts; this route only validates and relays.
export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ok: false, error: 'Method not allowed'}, {status: 405});
  }

  const {data, errors} = parseAppointment(await request.formData());
  if (errors) return Response.json({ok: false, errors}, {status: 400});

  try {
    await bookAppointment(context.env as any, data!);
    return Response.json({ok: true});
  } catch (error) {
    console.error('[appointment] booking failed:', error);
    return Response.json(
      {
        ok: false,
        error:
          'We could not submit your request right now. Please try again in a moment.',
      },
      {status: 502},
    );
  }
}
