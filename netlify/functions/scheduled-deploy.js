

import fetch from 'node-fetch'
import { schedule } from '@netlify/functions'

const BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK

// Schedules the handler function to run at midnight on
// Mondays, Wednesday, and Friday
const handler = schedule('0 0 26 * *', async () => {
  await fetch(BUILD_HOOK, {
    method: 'POST'
  }).then(response => {
    console.log('Build hook response:', response)
  })

  return {
    statusCode: 200
  }
})

export { handler }
