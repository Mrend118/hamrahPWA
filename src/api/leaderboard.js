import { ENDPOINTS, http } from "./api.js";

export async function getLeaderboard(params = { period: "week" }) {
  const { data } = await http.get(ENDPOINTS.leaderboard, { params });
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  return { items, me: data?.me ?? items.find((item) => item.isMe) ?? null };
}
