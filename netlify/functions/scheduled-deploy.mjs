import { runScheduledDeploy } from '../../lib/deploy-hook.mjs'

// Netlify Scheduled Function. Netlify nie udostępnia jej publicznie pod URL.
export default async () => runScheduledDeploy()

export const config = {
    schedule: '0 0 26-29 * *'
}
