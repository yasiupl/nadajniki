import { runScheduledDeploy } from '../lib/deploy-hook.mjs'

// Vercel Cron (patrz vercel.json). Vercel dołącza nagłówek
// "Authorization: Bearer $CRON_SECRET", więc odrzucamy inne wywołania.
export async function GET(request) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
        return new Response('CRON_SECRET is not configured', { status: 500 })
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    return runScheduledDeploy()
}
