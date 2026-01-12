// Buffer API helper for scheduling posts to LinkedIn and Instagram

const BUFFER_API_URL = 'https://api.bufferapp.com/1'

export async function getBufferProfiles(accessToken) {
  try {
    const response = await fetch(`${BUFFER_API_URL}/profiles.json?access_token=${accessToken}`)
    if (!response.ok) throw new Error('Failed to fetch profiles')
    return await response.json()
  } catch (error) {
    console.error('Buffer profiles error:', error)
    throw error
  }
}

export async function schedulePost({ accessToken, profileIds, text, scheduledAt, media }) {
  try {
    const body = new URLSearchParams({
      access_token: accessToken,
      text,
      shorten: 'false',
      now: scheduledAt ? 'false' : 'true',
    })

    // Add profile IDs
    profileIds.forEach(id => body.append('profile_ids[]', id))

    // Add scheduled time if provided
    if (scheduledAt) {
      body.append('scheduled_at', scheduledAt)
    }

    // Add media if provided
    if (media?.photo) {
      body.append('media[photo]', media.photo)
    }

    const response = await fetch(`${BUFFER_API_URL}/updates/create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to schedule post')
    }

    return await response.json()
  } catch (error) {
    console.error('Buffer schedule error:', error)
    throw error
  }
}

export async function getScheduledPosts(accessToken, profileId) {
  try {
    const response = await fetch(
      `${BUFFER_API_URL}/profiles/${profileId}/updates/pending.json?access_token=${accessToken}`
    )
    if (!response.ok) throw new Error('Failed to fetch scheduled posts')
    return await response.json()
  } catch (error) {
    console.error('Buffer pending posts error:', error)
    throw error
  }
}

export async function deleteScheduledPost(accessToken, updateId) {
  try {
    const response = await fetch(`${BUFFER_API_URL}/updates/${updateId}/destroy.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `access_token=${accessToken}`,
    })
    if (!response.ok) throw new Error('Failed to delete post')
    return await response.json()
  } catch (error) {
    console.error('Buffer delete error:', error)
    throw error
  }
}

// Helper to convert our scheduled time format to Buffer's format
export function toBufferTime(dateString) {
  // Input: "2025-01-15 09:00"
  // Output: Unix timestamp
  const date = new Date(dateString.replace(' ', 'T') + ':00')
  return Math.floor(date.getTime() / 1000)
}

// Get Buffer OAuth URL for connecting accounts
export function getBufferAuthUrl(clientId, redirectUri) {
  return `https://bufferapp.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
}
