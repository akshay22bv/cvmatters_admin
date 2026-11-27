export type AdminPage = "overview" | "orders" | "users" | "resumes" | "blog" | "settings" | "admins";

export const PAGE_PATH: Record<AdminPage, string> = {
  overview: "/",
  orders: "/orders",
  users: "/users",
  resumes: "/cvs",
  blog: "/blog",
  settings: "/settings",
  admins: "/admins",
};

export function pathToPage(pathname: string): AdminPage {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/orders") return "orders";
  if (path === "/users") return "users";
  if (path === "/cvs" || path === "/resumes") return "resumes";
  if (path === "/blog" || path.startsWith("/blog/")) return "blog";
  if (path === "/settings") return "settings";
  if (path === "/admins") return "admins";
  return "overview";
}

export function isBlogEditorPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/blog/new" || /^\/blog\/[^/]+\/edit$/.test(path);
}

export function blogEditPath(id: string) {
  return `/blog/${encodeURIComponent(id)}/edit`;
}
