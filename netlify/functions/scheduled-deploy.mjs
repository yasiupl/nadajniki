import { triggerDeployHook } from '../../lib/deploy-hook.mjs'

// Netlify Scheduled Function. Netlify nie udostępnia jej publicznie pod URL.
export default async () => triggerDeployHook()

export const config = {
    schedule: '0 0 26 * *'
}
