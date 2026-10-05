import { isDeployDay } from './deploy-day.mjs'

// Wspólna logika dla Vercel Cron i Netlify Scheduled Functions:
// wywołuje deploy hook, który przebudowuje stronę ze świeżymi danymi UKE.
export async function triggerDeployHook() {
    const hookUrl = process.env.DEPLOY_HOOK_URL || process.env.NETLIFY_BUILD_HOOK
    if (!hookUrl) {
        console.error('DEPLOY_HOOK_URL is not configured')
        return new Response('DEPLOY_HOOK_URL is not configured', { status: 500 })
    }

    const response = await fetch(hookUrl, { method: 'POST' })
    console.log('Deploy hook response:', response.status, await response.text())

    return new Response(response.ok ? 'OK' : 'Deploy hook failed', { status: response.ok ? 200 : 502 })
}

// Wywołanie z crona: przebudowa tylko w dniu przebudowy (patrz deploy-day.mjs).
export async function runScheduledDeploy(date = new Date()) {
    if (!isDeployDay(date)) {
        console.log('Not a deploy day, skipping:', date.toISOString())
        return new Response('Skipped: not a deploy day', { status: 200 })
    }

    return triggerDeployHook()
}
