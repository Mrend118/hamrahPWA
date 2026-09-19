/**
 * API اطلاعیه‌های عمومی
 */

import { ENDPOINTS, http } from './api.js';

export async function getAnnouncements(params) {
  const { data } = await http.get(ENDPOINTS.announcements, { params });
  return Array.isArray(data) ? data : (data?.items ?? []);
}
