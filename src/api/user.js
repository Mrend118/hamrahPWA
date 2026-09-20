import { ENDPOINTS, http } from "./api.js";

export async function getProfile() {
  const { data } = await http.get(ENDPOINTS.profile);
  return data;
}

export async function getStudyStats() {
  const { data } = await http.get(ENDPOINTS.studyStats);
  return data;
}

export async function getSubjects() {
  const { data } = await http.get(ENDPOINTS.subjects);
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function getSubjectStats(params) {
  const { data } = await http.get(ENDPOINTS.subjectStats, { params });
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function createProfileChangeRequest(fullName) {
  return (await http.post("/profile-change-requests", { fullName })).data;
}

export async function getMyProfileChangeRequests() {
  const data = (await http.get("/profile-change-requests/me")).data;
  return data?.items ?? [];
}
