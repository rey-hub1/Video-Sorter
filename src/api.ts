/**
 * API Configuration for Video Sorter
 * Replace these URLs with your actual n8n Webhook endpoints.
 */

const GET_VIDEOS_URL = 'https://n8n-hl67cba8wlvx.jkt1.sumopod.my.id/webhook/get-videos';
const POST_CATEGORY_URL = 'https://n8n-hl67cba8wlvx.jkt1.sumopod.my.id/webhook/submit-category';
const GET_CATEGORIES_URL = 'https://n8n-hl67cba8wlvx.jkt1.sumopod.my.id/webhook/get-categories';
const POST_CATEGORIES_URL = 'https://n8n-hl67cba8wlvx.jkt1.sumopod.my.id/webhook/save-categories';
const DELETE_CATEGORY_URL = 'https://n8n-hl67cba8wlvx.jkt1.sumopod.my.id/webhook/delete';

export interface VideoData {
  "Nama File": string;
  "ID File": string;
  "Link Preview": string;
  kategori?: string; // Local state for UI feedback
  categoryId?: string;
}

export interface CategoryData {
  id: string;
  name: string;
  detail?: string;
}

/**
 * Helper to fetch with a timeout
 */
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Fetches all videos from the n8n webhook.
 * Falls back to local data.json if the API is unreachable (e.g., CORS or network issues).
 */
export const fetchVideos = async (): Promise<VideoData[]> => {
  try {
    console.log('Fetching videos from:', GET_VIDEOS_URL);
    const response = await fetchWithTimeout(GET_VIDEOS_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response Data:', data);

    // Robust check for array
    let videos: any[] = [];
    if (Array.isArray(data)) {
      videos = data;
    } else if (data && typeof data === 'object') {
      const possibleArray = data.data || data.videos || data.items || Object.values(data).find(Array.isArray);
      if (Array.isArray(possibleArray)) {
        videos = possibleArray;
      }
    }

    if (videos.length === 0 && !Array.isArray(data)) {
      throw new Error('API response is not an array');
    }

    // Normalize video data
    return videos.map((item: any) => {
      const actualItem = item.json || item;
      return {
        "Nama File": actualItem["Nama File"] || actualItem["nama_file"] || actualItem["filename"] || '',
        "ID File": actualItem["ID File"] || actualItem["id_file"] || actualItem["id"] || '',
        "Link Preview": actualItem["Link Preview"] || actualItem["link_preview"] || actualItem["url"] || '',
        kategori: actualItem.kategori || actualItem.Kategori || actualItem["Nama Kategori"] || actualItem["nama_kategori"] || actualItem.category || '',
        categoryId: actualItem.categoryId || actualItem.category_id || actualItem.ID_Kategori || ''
      };
    });
  } catch (error) {
    console.error('API Fetch Videos failed:', error);
    throw error; // Throw error so the UI can handle it
  }
};

/**
 * Submits the selected category for a video.
 */
export const submitCategory = async (videoId: string, category: CategoryData, user: string) => {
  try {
    const response = await fetchWithTimeout(POST_CATEGORY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId,
        kategori: category.name,
        categoryId: category.id,
        user: user
      }),
    });

    if (!response.ok) throw new Error('Failed to submit category');
    return await response.json();
  } catch (error) {
    console.error('Submit Error:', error);
    return { status: 'error', message: (error as Error).message };
  }
};

/**
 * Fetches categories from the n8n webhook.
 * Falls back to local kategori.json if the API is unreachable.
 */
export const fetchCategories = async (): Promise<CategoryData[]> => {
  try {
    console.log('Fetching categories from:', GET_CATEGORIES_URL);
    const response = await fetchWithTimeout(GET_CATEGORIES_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    console.log('Raw Categories Data from API:', rawData);

    let data: any[] = [];

    // Robust check for array
    if (Array.isArray(rawData)) {
      data = rawData;
    } else if (rawData && typeof rawData === 'object') {
      // Check for common wrappers
      const possibleArray = rawData.data || rawData.categories || rawData.items || Object.values(rawData).find(Array.isArray);
      if (Array.isArray(possibleArray)) {
        data = possibleArray;
      } else {
        // If it's a single object, wrap it in an array
        data = [rawData];
      }
    }

    if (data.length === 0) {
      console.warn('No categories found in API response');
    }

    return data.map((item: any) => {
      // If item is just a string
      if (typeof item === 'string') {
        return { id: item.toLowerCase().replace(/\s+/g, '-'), name: item };
      }

      // Handle n8n specific structure if it exists (item.json)
      // n8n often wraps the actual data in a 'json' property
      const actualItem = item.json || item;

      // Prioritize "id" and "name" as requested by the user
      const name = actualItem.name || actualItem.Name || actualItem["Nama Kategori"] || actualItem.kategori || '';
      const id = String(actualItem.id || actualItem.ID || actualItem.row_number || (name ? name.toLowerCase().replace(/\s+/g, '-') : ''));
      const detail = actualItem.detail || actualItem.Detail || actualItem.keterangan || actualItem.Keterangan || '';

      return { id, name, detail };
    }).filter(cat => cat.name !== ''); // Filter out empty categories

  } catch (error) {
    console.error('API Fetch Categories failed:', error);
    throw error; // Throw error so the UI can handle it
  }
};

/**
 * Saves the updated categories array to the n8n webhook.
 */
export const saveCategories = async (categories: CategoryData[]) => {
  try {
    const response = await fetchWithTimeout(POST_CATEGORIES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ categories }),
    });

    if (!response.ok) throw new Error('Failed to save categories');
    return await response.json();
  } catch (error) {
    console.error('Save Categories Error:', error);
    return { status: 'error', message: (error as Error).message };
  }
};

/**
 * Deletes a specific category by ID.
 */
export const deleteCategory = async (categoryId: string) => {
  try {
    const response = await fetchWithTimeout(DELETE_CATEGORY_URL, {
      method: 'POST', // or DELETE depending on n8n setup, usually POST is safer for simple webhooks
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: categoryId,
        categoryId: categoryId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error (${response.status}): ${errorText || 'Failed to delete category'}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Delete Category Error:', error);
    return { status: 'error', message: (error as Error).message };
  }
};
