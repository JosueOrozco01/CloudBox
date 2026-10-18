import { request } from "./dashboardService";

export const getFileFavorites = () => request("/favorites");
export const setItemFavorite = (item, favorite) => {
  if (item.type === "carpeta") {
    throw new Error("Tu configuración actual permite marcar únicamente archivos como favoritos.");
  }
  return request(`/favorites/${item.rawId}`, { method: favorite ? "POST" : "DELETE" });
};
export const favoriteKey = item => `file-${item.rawId}`;
