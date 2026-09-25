import { http } from "./api.js";

export async function getDashboard() {
  return (await http.get("/admin/dashboard")).data;
}

export async function getAdminUsers(params = {}) {
  const data = (await http.get("/admin/users", { params })).data;
  return data?.items ?? [];
}

export async function createAdminUser(payload) {
  return (await http.post("/admin/users", payload)).data;
}

export async function getAdminAnnouncements() {
  const data = (await http.get("/admin/announcements")).data;
  return data?.items ?? [];
}

export async function createAdminAnnouncement(payload) {
  return (await http.post("/admin/announcements", payload)).data;
}

export async function deleteAdminAnnouncement(id) {
  return (await http.del(`/admin/announcements/${id}`)).data;
}

export async function updateAdminUser(id, payload) {
  return (await http.patch(`/admin/users/${id}`, payload)).data;
}

export async function deleteAdminUser(id) {
  return (await http.del(`/admin/users/${id}`)).data;
}

export async function getAdminChats() {
  const data = (await http.get("/admin/chats")).data;
  return data?.items ?? [];
}

export async function getAdminGroups() {
  const data = (await http.get("/admin/groups")).data;
  return data?.items ?? [];
}
export async function createAdminGroup(payload) {
  return (await http.post("/admin/groups", payload)).data;
}
export async function updateAdminGroup(id, payload) {
  return (await http.patch(`/admin/groups/${id}`, payload)).data;
}
export async function deleteAdminGroup(id) {
  return (await http.del(`/admin/groups/${id}`)).data;
}
export async function getAdminSubjects() {
  const data = (await http.get("/admin/subjects")).data;
  return data?.items ?? [];
}
export async function getCurriculum(track, grade) {
  const data = (await http.get("/admin/curriculum", { params: { track, grade } })).data;
  return data?.items ?? [];
}
export async function getStudentStudyStats(id) {
  return (await http.get(`/admin/users/${id}/study-stats`)).data;
}
export async function changeOwnPassword(payload) {
  return (await http.post("/auth/change-password", payload)).data;
}

export async function getProfileChangeRequests(params = {}) {
  const data = (await http.get("/admin/profile-change-requests", { params }))
    .data;
  return data?.items ?? [];
}

export async function reviewProfileChangeRequest(id, action) {
  return (await http.post(`/admin/profile-change-requests/${id}/${action}`, {}))
    .data;
}
