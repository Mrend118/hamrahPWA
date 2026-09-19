/**
 * API پروفایل و آمار مطالعه
 */

import { ENDPOINTS, http } from "./api.js";

/**
 * API Name: پروفایل دانش‌آموز
 */
export async function getProfile() {
  const { data } = await http.get(ENDPOINTS.profile);
  return data;
}

/**
 * API Name: خلاصه آمار مطالعه
 */
export async function getStudyStats() {
  const { data } = await http.get(ENDPOINTS.studyStats);
  return data;
}

/**
 * API Name: فهرست درس‌ها
 */
export async function getSubjects() {
  const { data } = await http.get(ENDPOINTS.subjects);
  return Array.isArray(data) ? data : (data?.items ?? []);
}

/**
 * API Name: آمار مطالعه به تفکیک درس
 */
export async function getSubjectStats(params) {
  const { data } = await http.get(ENDPOINTS.subjectStats, { params });
  return Array.isArray(data) ? data : (data?.items ?? []);
}
