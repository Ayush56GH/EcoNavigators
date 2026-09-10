import { API_BASE_URL } from '@/services/api';
import type { SARAnalysisResult } from '@/types/sar';

// Normalize base URL to point to backend root
const BACKEND_ROOT = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/**
 * Uploads a SAR/satellite image to the standalone MiT-B2 + U-Net analysis endpoint.
 *
 * @param file Uploaded image file (PNG, JPG, JPEG, TIF, TIFF)
 * @param threshold Optional custom segmentation threshold (default: 0.50)
 */
export async function analyzeSARImage(
  file: File,
  threshold?: number
): Promise<SARAnalysisResult> {
  const formData = new FormData();
  formData.append('image', file);

  let url = `${BACKEND_ROOT}/api/sar/analyze`;
  if (threshold !== undefined) {
    url += `?threshold=${encodeURIComponent(threshold)}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err: any) {
    throw new Error(
      `Failed to connect to SAR analysis service (${BACKEND_ROOT}). Please verify that the backend is running.`
    );
  }

  if (!response.ok) {
    let errorDetail = `Analysis failed with HTTP status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // ignore non-JSON body
    }
    throw new Error(errorDetail);
  }

  const data: SARAnalysisResult = await response.json();
  return data;
}
