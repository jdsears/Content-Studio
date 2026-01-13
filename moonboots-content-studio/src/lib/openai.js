// OpenAI API helper for AI-generated images
// Docs: https://platform.openai.com/docs/api-reference/images

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

// Platform dimensions for optimal social media images
// DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
const platformSizes = {
  instagram: '1024x1792', // Vertical for Instagram 4:5
  x: '1792x1024',         // Horizontal for X 16:9
  linkedin: '1792x1024',  // Horizontal for LinkedIn
};

/**
 * Generate an AI image based on post content
 * @param {Object} options
 * @param {string} options.apiKey - OpenAI API key
 * @param {string} options.content - Post content to base the image on
 * @param {string} options.platform - Target platform (instagram, x, linkedin)
 * @param {string} options.pillar - Content pillar for context
 * @returns {Promise<string>} URL of the generated image
 */
export async function generateAIImage({ apiKey, content, platform = 'instagram', pillar = '' }) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Create a prompt that generates a professional, on-brand image
  const brandContext = `MoonBoots Consultancy is a premium business advisory brand.
Style: Modern, professional, minimalist, sophisticated.
Colors: Deep blues, slate grays, subtle gradients, clean whites.
Avoid: Text overlays, faces, specific logos, cluttered designs.`;

  const pillarContext = pillar ? `\nContent theme: ${pillar}` : '';

  const imagePrompt = `Create a visually striking, professional social media image that captures the essence of this concept:

"${content.substring(0, 300)}"
${pillarContext}

${brandContext}

The image should be abstract or conceptual, suitable for a ${platform} post. Use sophisticated visual metaphors.
Make it feel premium and thoughtful, not generic or stock-photo-like.
Style: Clean, modern, minimal with subtle depth and texture.`;

  const size = platformSizes[platform] || platformSizes.instagram;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: size,
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to generate image');
  }

  const data = await response.json();

  if (!data.data || !data.data[0]?.url) {
    throw new Error('No image URL in response');
  }

  return data.data[0].url;
}

/**
 * Fetch an image from URL and convert to data URL for preview/upload
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} Data URL of the image
 */
export async function imageUrlToDataUrl(imageUrl) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generate AI image and return as data URL (for local preview and Publer upload)
 * @param {Object} options - Same as generateAIImage
 * @returns {Promise<string>} Data URL of the generated image
 */
export async function generateAIImageAsDataUrl({ apiKey, content, platform, pillar }) {
  const imageUrl = await generateAIImage({ apiKey, content, platform, pillar });
  return imageUrlToDataUrl(imageUrl);
}
