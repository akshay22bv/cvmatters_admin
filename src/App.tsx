import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  adminCreateAdmin,
  adminCreateBlog,
  adminDeleteAdmin,
  adminDeleteBlog,
  adminDeleteResume,
  adminDeleteUser,
  adminGetBlog,
  adminListAdmins,
  adminListBlog,
  adminListOrders,
  adminListResumes,
  adminListUsers,
  adminStats,
  adminGetSiteSettings,
  adminUpdateAdmin,
  adminUpdateBlog,
  adminUpdateResume,
  adminUpdateSiteSettings,
  loadMe,
  signIn,
  signOut,
  type Account,
  type AdminAdminRow,
  type AdminBlogPost,
  type AdminOrderRow,
  type AdminResumeRow,
  type AdminStats,
  type AdminUserRow,
  ApiError,
} from "./api";
import { AdminPager } from "./AdminPager";
import { useConfirm } from "./ConfirmProvider";
import { blogEditPath, isBlogEditorPath, PAGE_PATH, pathToPage, type AdminPage } from "./paths";
import { RichEditor } from "./RichEditor";
import { readToken } from "./session";

const emptyBlogForm = {
  title: "",
  slug: "",
  excerpt: "",
  keyword: "",
  coverImage: "/blog/online-resume.svg",
  body: "",
  published: true,
};

const APP_ORIGIN = typeof __CV_APP_ORIGIN__ === "string" ? __CV_APP_ORIGIN__ : "http://127.0.0.1:3000";

const TABS: { id: AdminPage; label: string; icon: ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z" />
      </svg>
    ),
  },
  {
    id: "orders",
    label: "Orders",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "users",
    label: "Users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "resumes",
    label: "CVs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
        <path d="M14 3.5V8h4.5M8.5 12h7M8.5 15.5h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "blog",
    label: "Blog",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 5.5h14v13H5z" />
        <path d="M8 9h8M8 12.5h8M8 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Site",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.8v2.2M12 18.8v2.4M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.8 12h2.2M18.8 12h2.4M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "admins",
    label: "Admins",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3.5 4.5 7v4.5c0 4.2 3.1 7.9 7.5 9 4.4-1.1 7.5-4.8 7.5-9V7L12 3.5Z" />
        <path d="M9.5 12.2 11.2 14l3.5-3.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function statusClass(status: string) {
  if (status === "paid") return "adm-status is-paid";
  if (status === "failed") return "adm-status is-failed";
  return "adm-status is-pending";
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function normalizeEmailMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = pathToPage(location.pathname);
  const blogEditor = isBlogEditorPath(location.pathname);
  const [user, setUser] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [resumes, setResumes] = useState<AdminResumeRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [admins, setAdmins] = useState<AdminAdminRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [resumeTotal, setResumeTotal] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [blogTotal, setBlogTotal] = useState(0);
  const [adminForm, setAdminForm] = useState({ email: "", name: "", password: "" });
  const [adminModal, setAdminModal] = useState<null | { mode: "add" } | { mode: "edit"; row: AdminAdminRow }>(null);
  const [adminFormError, setAdminFormError] = useState("");
  const [siteForm, setSiteForm] = useState({ operatorName: "", supportEmail: "", supportPhone: "" });
  const [siteUpdatedAt, setSiteUpdatedAt] = useState<string | null>(null);
  const [siteSaved, setSiteSaved] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [q, setQ] = useState("");
  const [publicFilter, setPublicFilter] = useState<"" | "true" | "false">("");
  const [orderStatus, setOrderStatus] = useState<"" | "paid" | "pending" | "failed">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [blogForm, setBlogForm] = useState(emptyBlogForm);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [blogReady, setBlogReady] = useState(true);
  const confirm = useConfirm();

  useEffect(() => {
    if (!readToken()) {
      setReady(true);
      return;
    }
    loadMe()
      .then((me) => {
        setUser(me.user);
        setIsAdmin(!!me.isAdmin);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const loadOverview = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setStats(await adminStats());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load stats.");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminListUsers({ q, page: page + 1, limit });
      setUsers(result.users);
      setUserTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load users.");
    } finally {
      setBusy(false);
    }
  }, [limit, page, q]);

  const loadResumes = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminListResumes({
        q,
        page: page + 1,
        limit,
        public: publicFilter || undefined,
      });
      setResumes(result.resumes);
      setResumeTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load resumes.");
    } finally {
      setBusy(false);
    }
  }, [limit, page, publicFilter, q]);

  const loadOrders = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminListOrders({
        q,
        page: page + 1,
        limit,
        status: orderStatus || undefined,
      });
      setOrders(result.orders);
      setOrderTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load orders.");
    } finally {
      setBusy(false);
    }
  }, [limit, orderStatus, page, q]);

  const loadBlog = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminListBlog({ q, page: page + 1, limit });
      setPosts(result.posts);
      setBlogTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load blog posts.");
    } finally {
      setBusy(false);
    }
  }, [limit, page, q]);

  const loadAdmins = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminListAdmins();
      setAdmins(result.admins);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load admins.");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadSiteSettings = useCallback(async () => {
    setBusy(true);
    setError("");
    setSiteSaved("");
    try {
      const result = await adminGetSiteSettings();
      const { operatorName, supportEmail, supportPhone, updatedAt } = result.settings;
      setSiteForm({ operatorName, supportEmail, supportPhone: supportPhone || "" });
      setSiteUpdatedAt(updatedAt || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load site settings.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    setQ("");
    setPublicFilter("");
    setOrderStatus("");
    setError("");
  }, [tab]);

  useEffect(() => {
    setPage(0);
  }, [q, publicFilter, orderStatus, limit]);

  useEffect(() => {
    if (!isAdmin || blogEditor) return;
    if (tab === "overview") void loadOverview();
    else if (tab === "users") void loadUsers();
    else if (tab === "orders") void loadOrders();
    else if (tab === "blog") void loadBlog();
    else if (tab === "admins") void loadAdmins();
    else if (tab === "settings") void loadSiteSettings();
    else void loadResumes();
  }, [blogEditor, isAdmin, loadAdmins, loadBlog, loadOrders, loadOverview, loadResumes, loadSiteSettings, loadUsers, page, tab]);

  const saveSiteSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSiteSaved("");
    try {
      const result = await adminUpdateSiteSettings({
        operatorName: siteForm.operatorName.trim(),
        supportEmail: siteForm.supportEmail.trim(),
        supportPhone: siteForm.supportPhone.trim(),
      });
      const { operatorName, supportEmail, supportPhone, updatedAt } = result.settings;
      setSiteForm({ operatorName, supportEmail, supportPhone: supportPhone || "" });
      setSiteUpdatedAt(updatedAt || null);
      setSiteSaved("Saved. Footer, contact, and legal pages pick this up within about a minute.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save site settings.");
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      const result = await signIn(email.trim(), password);
      setUser(result.user);
      setIsAdmin(!!result.isAdmin);
      if (!result.isAdmin) setLoginError("That account isn't an admin. Ask an existing admin to add you.");
    } catch (reason) {
      setLoginError(reason instanceof ApiError ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await signOut();
    setUser(null);
    setIsAdmin(false);
    setStats(null);
    setUsers([]);
    setResumes([]);
    setOrders([]);
    setNavOpen(false);
  };

  const removeUser = async (row: AdminUserRow) => {
    const ok = await confirm({
      title: "Delete account",
      message: `Delete account for ${row.email}? All their CVs and billing data will go too.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await adminDeleteUser(row.id);
      await loadUsers();
      if (tab === "overview") await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't delete that user.");
    } finally {
      setBusy(false);
    }
  };

  const togglePublic = async (row: AdminResumeRow) => {
    setBusy(true);
    setError("");
    try {
      await adminUpdateResume(row.id, { isPublic: !row.isPublic });
      await loadResumes();
      if (tab === "overview") await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't update that CV.");
    } finally {
      setBusy(false);
    }
  };

  const removeResume = async (row: AdminResumeRow) => {
    const title = row.fullName || row.slug || row.id;
    const ok = await confirm({
      title: "Delete CV",
      message: `Delete CV "${title}"?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await adminDeleteResume(row.id);
      await loadResumes();
      if (tab === "overview") await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't delete that CV.");
    } finally {
      setBusy(false);
    }
  };

  const closeBlogForm = () => {
    setEditingPostId(null);
    setBlogForm(emptyBlogForm);
    navigate(PAGE_PATH.blog);
  };

  const openNewBlog = () => {
    setEditingPostId(null);
    setBlogForm(emptyBlogForm);
    setBlogReady(true);
    navigate("/blog/new");
  };

  const openEditBlog = (post: AdminBlogPost) => {
    navigate(blogEditPath(post.id));
  };

  useEffect(() => {
    if (!isAdmin || !blogEditor) return;
    const path = location.pathname.replace(/\/+$/, "");
    if (path === "/blog/new") {
      setEditingPostId(null);
      setBlogForm(emptyBlogForm);
      setBlogReady(true);
      return;
    }
    const match = path.match(/^\/blog\/([^/]+)\/edit$/);
    const id = match?.[1] ? decodeURIComponent(match[1]) : "";
    if (!id) return;
    let stale = false;
    setBlogReady(false);
    setError("");
    adminGetBlog(id)
      .then((result) => {
        if (stale) return;
        const post = result.post;
        setEditingPostId(post.id);
        setBlogForm({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          keyword: post.keyword,
          coverImage: post.coverImage || "/blog/online-resume.svg",
          body: post.body || "",
          published: post.published,
        });
        setBlogReady(true);
      })
      .catch((reason) => {
        if (stale) return;
        setError(reason instanceof Error ? reason.message : "Couldn't load that post.");
        setBlogReady(true);
      });
    return () => {
      stale = true;
    };
  }, [blogEditor, isAdmin, location.pathname]);

  const saveBlog = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!blogForm.body.trim()) {
      setError("Body is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editingPostId) {
        await adminUpdateBlog(editingPostId, blogForm);
      } else {
        await adminCreateBlog(blogForm);
      }
      navigate(PAGE_PATH.blog);
      setEditingPostId(null);
      setBlogForm(emptyBlogForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save that post.");
    } finally {
      setBusy(false);
    }
  };

  const removeBlog = async (post: AdminBlogPost) => {
    const ok = await confirm({
      title: "Delete blog post",
      message: `Delete “${post.title}”? This removes /blog/${post.slug}.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await adminDeleteBlog(post.id);
      if (editingPostId === post.id) closeBlogForm();
      await loadBlog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't delete that post.");
    } finally {
      setBusy(false);
    }
  };

  const listTotal =
    tab === "users" ? userTotal : tab === "orders" ? orderTotal : tab === "blog" ? blogTotal : resumeTotal;

  const tabLabel = TABS.find((item) => item.id === tab)?.label || "Overview";

  const pager = !blogEditor && tab !== "overview" && tab !== "admins" ? (
    <AdminPager
      page={page}
      limit={limit}
      total={listTotal}
      busy={busy}
      onPageChange={setPage}
      onLimitChange={(next) => {
        setLimit(next);
        setPage(0);
      }}
    />
  ) : null;

  const openAddAdmin = () => {
    setAdminForm({ email: "", name: "", password: "" });
    setAdminFormError("");
    setShowAdminPassword(false);
    setAdminModal({ mode: "add" });
  };

  const openEditAdmin = (row: AdminAdminRow) => {
    setAdminForm({ email: row.email, name: row.name || "", password: "" });
    setAdminFormError("");
    setShowAdminPassword(false);
    setAdminModal({ mode: "edit", row });
  };

  const closeAdminModal = () => {
    setAdminModal(null);
    setAdminFormError("");
    setShowAdminPassword(false);
  };

  const saveAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminModal) return;
    setBusy(true);
    setAdminFormError("");
    setError("");
    try {
      if (adminModal.mode === "add") {
        await adminCreateAdmin({
          email: adminForm.email.trim(),
          name: adminForm.name.trim() || undefined,
          password: adminForm.password || undefined,
        });
      } else {
        await adminUpdateAdmin(adminModal.row.id, {
          name: adminForm.name.trim(),
          password: adminForm.password || undefined,
        });
      }
      closeAdminModal();
      await loadAdmins();
    } catch (reason) {
      setAdminFormError(reason instanceof Error ? reason.message : "Couldn't save that admin.");
    } finally {
      setBusy(false);
    }
  };

  const removeAdminRow = async (row: AdminAdminRow) => {
    const ok = await confirm({
      title: "Remove admin",
      message: `Remove admin access for ${row.email}?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await adminDeleteAdmin(row.id);
      await loadAdmins();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't remove that admin.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="adm-gate-page">
        <p className="adm-note">Checking access…</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="adm-gate-page">
        <div className="adm-gate">
          <div className="adm-brand">
            <span className="adm-brand-mark">CV</span>
            CV Matters Admin
          </div>
          <h1>Sign in</h1>
          <form className="adm-login" onSubmit={onLogin}>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <span className="adm-password-field">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="adm-password-toggle"
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowLoginPassword((value) => !value)}
                >
                  {showLoginPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7-0.5 1.2-1.2 2.3-2.1 3.3M6.1 6.1C4.3 7.3 2.9 9 2 12c1.7 3.9 6 7 11 7 1.4 0 2.7-.2 4-.7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </button>
              </span>
            </label>
            {loginError ? <p className="adm-error">{loginError}</p> : null}
            <button type="submit" className="adm-btn is-primary" disabled={busy}>
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={navOpen ? "adm-shell is-nav-open" : "adm-shell"}>
      {navOpen ? <button type="button" className="adm-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} /> : null}

      <aside className="adm-side" aria-label="Admin navigation">
        <a className="adm-brand" href={APP_ORIGIN}>
          <span className="adm-brand-mark">CV</span>
          CV Matters
        </a>
        <nav className="adm-side-nav">
          <p className="adm-side-label">Menu</p>
          {TABS.map((item) => (
            <NavLink
              key={item.id}
              to={PAGE_PATH[item.id]}
              end={item.id === "overview"}
              className={({ isActive }) => (isActive || (item.id === "blog" && tab === "blog") ? "adm-side-link is-on" : "adm-side-link")}
              onClick={() => setNavOpen(false)}
            >
              <span className="adm-side-ico" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="adm-side-foot">
          <a className="adm-btn" href={APP_ORIGIN} style={{ width: "100%" }}>
            Open app
          </a>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-top-left">
            <button type="button" className="adm-menu-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <div className="adm-crumb">
              <span>Admin</span>
              <span>/</span>
              {blogEditor ? (
                <>
                  <Link to={PAGE_PATH.blog}>Blog</Link>
                  <span>/</span>
                  <strong>{editingPostId ? "Edit" : "New"}</strong>
                </>
              ) : (
                <strong>{tabLabel}</strong>
              )}
            </div>
          </div>
          <div className="adm-top-right">
            <span className="adm-signed">{user.email}</span>
            <span className="adm-avatar" aria-hidden="true">
              {initials(user.name || user.email)}
            </span>
            <button type="button" className="adm-btn is-ghost" onClick={() => void onLogout()}>
              Sign out
            </button>
          </div>
        </header>

        <main className="adm-content" key={location.pathname}>
          <div className="adm-pagehead">
            <div>
              <h1>{blogEditor ? (editingPostId ? "Edit post" : "New post") : tabLabel}</h1>
              <p>
                {blogEditor
                  ? "Write the post on this page, then save. Public URL uses the slug below."
                  : tab === "overview"
                    ? "Live counts for users, payments, and hosted CVs."
                    : tab === "orders"
                      ? "All Cashfree and demo checkout attempts."
                      : tab === "users"
                        ? "Accounts, plans, and CV counts."
                        : tab === "blog"
                          ? "Write SEO posts. Public URLs look like /blog/your-slug."
                          : tab === "settings"
                            ? "Grievance officer name, support email, and optional phone on the public site."
                            : tab === "admins"
                              ? "Grant or revoke admin access for team emails."
                              : "Hosted resumes and public pages."}
              </p>
            </div>
            {tab === "overview" && !blogEditor ? (
              <button type="button" className="adm-btn" disabled={busy} onClick={() => void loadOverview()}>
                Refresh
              </button>
            ) : null}
            {tab === "blog" && !blogEditor ? (
              <button type="button" className="adm-btn is-primary" disabled={busy} onClick={openNewBlog}>
                New post
              </button>
            ) : null}
            {tab === "admins" && !blogEditor ? (
              <button type="button" className="adm-btn is-primary" disabled={busy} onClick={openAddAdmin}>
                Add admin
              </button>
            ) : null}
            {blogEditor ? (
              <button type="button" className="adm-btn" onClick={closeBlogForm}>
                Back to posts
              </button>
            ) : null}
          </div>

          {error ? <p className="adm-error">{error}</p> : null}

          {blogEditor ? (
            !blogReady ? (
              <p className="adm-note">Loading post…</p>
            ) : (
              <section className="adm-panel adm-blog-page">
                <form className="adm-blog-form" onSubmit={(event) => void saveBlog(event)}>
                  <div className="adm-blog-form-grid">
                    <label className="adm-blog-span-2">
                      Title
                      <input
                        required
                        autoFocus
                        value={blogForm.title}
                        onChange={(event) => setBlogForm((current) => ({ ...current, title: event.target.value }))}
                      />
                    </label>
                    <label>
                      Slug
                      <input
                        value={blogForm.slug}
                        placeholder="auto from title if empty"
                        onChange={(event) => setBlogForm((current) => ({ ...current, slug: event.target.value }))}
                      />
                      <span className="adm-field-hint">URL: /blog/{blogForm.slug || "your-slug"}</span>
                    </label>
                    <label>
                      Primary keyword
                      <input
                        value={blogForm.keyword}
                        onChange={(event) => setBlogForm((current) => ({ ...current, keyword: event.target.value }))}
                      />
                    </label>
                    <label className="adm-blog-span-2">
                      Cover image URL
                      <input
                        value={blogForm.coverImage}
                        onChange={(event) => setBlogForm((current) => ({ ...current, coverImage: event.target.value }))}
                      />
                    </label>
                    <label className="adm-blog-span-2">
                      Excerpt
                      <textarea
                        rows={3}
                        value={blogForm.excerpt}
                        onChange={(event) => setBlogForm((current) => ({ ...current, excerpt: event.target.value }))}
                      />
                    </label>
                    <div className="adm-blog-span-2">
                      <RichEditor
                        label="Body"
                        value={blogForm.body}
                        placeholder="Write the post…"
                        minHeight={320}
                        onChange={(body) => setBlogForm((current) => ({ ...current, body }))}
                      />
                    </div>
                  </div>
                  <div className="adm-blog-form-foot">
                    <label className="adm-check">
                      <input
                        type="checkbox"
                        checked={blogForm.published}
                        onChange={(event) => setBlogForm((current) => ({ ...current, published: event.target.checked }))}
                      />
                      Published
                    </label>
                    <div className="adm-blog-form-acts">
                      <button type="button" className="adm-btn" onClick={closeBlogForm}>
                        Cancel
                      </button>
                      <button type="submit" className="adm-btn is-primary" disabled={busy}>
                        {editingPostId ? "Save changes" : "Publish post"}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )
          ) : null}

          {!blogEditor && tab === "overview" && stats ? (
            <ul className="adm-stats">
              <li className="adm-stat">
                <span>Users</span>
                <strong>{stats.users}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="3.2" />
                    <path d="M5 19c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" strokeLinecap="round" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat is-sky">
                <span>Active subs</span>
                <strong>{stats.active_subs}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.7L12 3Z" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat">
                <span>Paid orders</span>
                <strong>{stats.paid_orders}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="6" width="17" height="12" rx="2" />
                    <path d="M3.5 10h17" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat is-violet">
                <span>Paid revenue</span>
                <strong className="adm-stat-money">{stats.paid_revenue_label || "₹0"}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 4v16M8 8.5c1-.9 2-.9 4-.9s3 .5 3 2-1.2 2-4 2.4-4 .8-4 2.5 1.8 2.5 4.2 2.5 3.5-.6 4-1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat is-amber">
                <span>Pending</span>
                <strong>{stats.pending_orders}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4.5l2.5 1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat is-rose">
                <span>Failed</span>
                <strong>{stats.failed_orders}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" strokeLinecap="round" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat is-sky">
                <span>CVs</span>
                <strong>{stats.resumes}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
                  </svg>
                </span>
              </li>
              <li className="adm-stat">
                <span>Public CVs</span>
                <strong>{stats.public_resumes}</strong>
                <span className="adm-stat-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                  </svg>
                </span>
              </li>
            </ul>
          ) : null}

          {!blogEditor && tab === "blog" ? (
            <section className="adm-panel">
              <div className="adm-panel-head">
                <h2>
                  {blogTotal} post{blogTotal === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="adm-toolbar">
                <input
                  type="search"
                  className="adm-search"
                  placeholder="Search title, slug, or keyword"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
                <button type="button" className="adm-btn" disabled={busy} onClick={() => void loadBlog()}>
                  Refresh
                </button>
              </div>

              <div className="adm-table-wrap">
                <table className="adm-table is-blog">
                  <thead>
                    <tr>
                      <th className="adm-col-title">Title</th>
                      <th className="adm-col-slug">Slug</th>
                      <th className="adm-col-keyword">Keyword</th>
                      <th className="adm-col-status">Status</th>
                      <th className="adm-col-updated">Updated</th>
                      <th className="adm-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td className="adm-blog-title">{post.title}</td>
                        <td className="adm-blog-slug">
                          <a className="adm-link" href={`${APP_ORIGIN}/blog/${post.slug}`} target="_blank" rel="noreferrer">
                            /blog/{post.slug}
                          </a>
                        </td>
                        <td className="adm-blog-keyword">{post.keyword || "—"}</td>
                        <td>
                          <span className={post.published ? "adm-status is-paid" : "adm-status is-pending"}>
                            {post.published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="adm-nowrap">{fmtDate(post.updatedAt)}</td>
                        <td className="adm-actions">
                          <button type="button" className="adm-link" onClick={() => openEditBlog(post)}>
                            Edit
                          </button>
                          <button type="button" className="adm-link danger" onClick={() => void removeBlog(post)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!posts.length && !busy ? <p className="adm-empty">No posts yet. Click “New post”.</p> : null}
              </div>
              {pager}
            </section>
          ) : null}

          {!blogEditor && tab === "settings" ? (
            <section className="adm-panel">
              <div className="adm-panel-head">
                <h2>Public contact &amp; grievance</h2>
                <button type="button" className="adm-btn" disabled={busy} onClick={() => void loadSiteSettings()}>
                  Refresh
                </button>
              </div>
              <p className="adm-note">
                Shown in the site footer, contact page, and terms (Grievance Officer). Leave phone blank to hide it.
                {siteUpdatedAt ? ` Last updated ${fmtDate(siteUpdatedAt)}.` : ""}
              </p>
              {siteSaved ? <p className="adm-note is-success">{siteSaved}</p> : null}
              <form className="adm-site-form" onSubmit={(event) => void saveSiteSettings(event)}>
                <label>
                  Grievance officer / operator name
                  <input
                    required
                    value={siteForm.operatorName}
                    onChange={(event) => setSiteForm((current) => ({ ...current, operatorName: event.target.value }))}
                    placeholder="Full legal name"
                  />
                </label>
                <label>
                  Support email
                  <input
                    required
                    type="email"
                    value={siteForm.supportEmail}
                    onChange={(event) => setSiteForm((current) => ({ ...current, supportEmail: event.target.value }))}
                    placeholder="support@example.com"
                  />
                </label>
                <label>
                  Support phone <span className="adm-field-hint">(optional)</span>
                  <input
                    type="tel"
                    value={siteForm.supportPhone}
                    onChange={(event) => setSiteForm((current) => ({ ...current, supportPhone: event.target.value }))}
                    placeholder="Leave empty to hide on site"
                  />
                </label>
                <div className="adm-blog-form-acts">
                  <button type="submit" className="adm-btn is-primary" disabled={busy}>
                    Save site settings
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {!blogEditor && tab === "admins" ? (
            <section className="adm-panel">
              <div className="adm-panel-head">
                <h2>
                  {admins.length} admin{admins.length === 1 ? "" : "s"}
                </h2>
                <div className="adm-panel-acts">
                  <button type="button" className="adm-btn" disabled={busy} onClick={() => void loadAdmins()}>
                    Refresh
                  </button>
                  <button type="button" className="adm-btn is-primary" disabled={busy} onClick={openAddAdmin}>
                    Add admin
                  </button>
                </div>
              </div>

              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Account</th>
                      <th>Added</th>
                      <th className="adm-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name || "—"}</td>
                        <td>
                          <div>{row.email}</div>
                          {row.fromEnv || normalizeEmailMatch(row.email, user.email) ? (
                            <small className="adm-sub">
                              {[row.fromEnv ? "env bootstrap" : null, normalizeEmailMatch(row.email, user.email) ? "you" : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          ) : null}
                        </td>
                        <td>{row.hasAccount ? "Signed up" : "Invite only"}</td>
                        <td className="adm-nowrap">{fmtDate(row.createdAt)}</td>
                        <td className="adm-actions">
                          <button type="button" className="adm-link" disabled={busy} onClick={() => openEditAdmin(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="adm-link danger"
                            disabled={busy || normalizeEmailMatch(row.email, user.email) || row.fromEnv}
                            onClick={() => void removeAdminRow(row)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!admins.length && !busy ? <p className="adm-empty">No admins yet. Click “Add admin”.</p> : null}
              </div>
            </section>
          ) : null}

          {adminModal ? (
            <div className="adm-confirm" role="dialog" aria-modal="true" aria-labelledby="adm-admin-modal-title">
              <button type="button" className="adm-confirm-scrim" aria-label="Close" onClick={closeAdminModal} />
              <form className="adm-confirm-panel adm-admin-modal" onSubmit={(event) => void saveAdmin(event)}>
                <h2 id="adm-admin-modal-title">{adminModal.mode === "add" ? "Add admin" : "Edit admin"}</h2>
                <p>
                  {adminModal.mode === "add"
                    ? "Grant admin access. Add a password only if this email does not have an account yet."
                    : "Update the display name or set a new password for this admin account."}
                </p>

                <div className="adm-admin-modal-fields">
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      autoFocus={adminModal.mode === "add"}
                      autoComplete="off"
                      placeholder="name@company.com"
                      value={adminForm.email}
                      disabled={adminModal.mode === "edit"}
                      onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </label>
                  <label>
                    Name
                    <input
                      type="text"
                      autoFocus={adminModal.mode === "edit"}
                      placeholder="Display name"
                      value={adminForm.name}
                      onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Password
                    <span className="adm-password-field">
                      <input
                        type={showAdminPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder={adminModal.mode === "edit" ? "Leave blank to keep current" : "Min. 8 characters if new"}
                        value={adminForm.password}
                        onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))}
                      />
                      <button
                        type="button"
                        className="adm-password-toggle"
                        aria-label={showAdminPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowAdminPassword((value) => !value)}
                      >
                        {showAdminPassword ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7-0.5 1.2-1.2 2.3-2.1 3.3M6.1 6.1C4.3 7.3 2.9 9 2 12c1.7 3.9 6 7 11 7 1.4 0 2.7-.2 4-.7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                          </svg>
                        )}
                      </button>
                    </span>
                  </label>
                </div>

                {adminFormError ? <p className="adm-error">{adminFormError}</p> : null}

                <div className="adm-confirm-actions">
                  <button type="button" className="adm-btn" onClick={closeAdminModal}>
                    Cancel
                  </button>
                  <button type="submit" className="adm-btn is-primary" disabled={busy}>
                    {adminModal.mode === "add" ? "Add admin" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {!blogEditor && tab !== "overview" && tab !== "blog" && tab !== "admins" ? (
            <section className="adm-panel">
              <div className="adm-panel-head">
                <h2>
                  {tab === "orders"
                    ? `${orderTotal} order${orderTotal === 1 ? "" : "s"}`
                    : tab === "users"
                      ? `${userTotal} user${userTotal === 1 ? "" : "s"}`
                      : `${resumeTotal} CV${resumeTotal === 1 ? "" : "s"}`}
                </h2>
              </div>
              <div className="adm-toolbar">
                <input
                  type="search"
                  className="adm-search"
                  placeholder={
                    tab === "users"
                      ? "Search name or email"
                      : tab === "orders"
                        ? "Search email, plan, order id, or Cashfree ref"
                        : "Search name, slug, email, or id"
                  }
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
                {tab === "resumes" ? (
                  <select
                    className="adm-select"
                    value={publicFilter}
                    onChange={(event) => setPublicFilter(event.target.value as "" | "true" | "false")}
                    aria-label="Public filter"
                  >
                    <option value="">All CVs</option>
                    <option value="true">Public only</option>
                    <option value="false">Private only</option>
                  </select>
                ) : null}
                {tab === "orders" ? (
                  <select
                    className="adm-select"
                    value={orderStatus}
                    onChange={(event) => setOrderStatus(event.target.value as "" | "paid" | "pending" | "failed")}
                    aria-label="Order status"
                  >
                    <option value="">All statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                ) : null}
                <button
                  type="button"
                  className="adm-btn"
                  disabled={busy}
                  onClick={() => (tab === "users" ? loadUsers() : tab === "orders" ? loadOrders() : loadResumes())}
                >
                  Refresh
                </button>
              </div>

              {tab === "orders" ? (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Customer</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Provider</th>
                        <th>Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div>{fmtDate(row.createdAt)}</div>
                            {row.paidAt ? <small className="adm-sub">Paid {fmtDate(row.paidAt)}</small> : null}
                          </td>
                          <td>
                            <div>{row.userName || "—"}</div>
                            <small className="adm-sub">{row.userEmail || row.userId.slice(0, 8)}</small>
                          </td>
                          <td className="adm-capitalize">{row.plan}</td>
                          <td>{row.amountLabel}</td>
                          <td>
                            <span className={statusClass(row.status)}>{row.status}</span>
                          </td>
                          <td>{row.provider}</td>
                          <td>
                            <code className="adm-code">{row.providerRef || "—"}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!orders.length && !busy ? <p className="adm-empty">No orders match.</p> : null}
                </div>
              ) : null}

              {tab === "users" ? (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>CVs</th>
                        <th>Joined</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name || "—"}</td>
                          <td>{row.email}</td>
                          <td>
                            {row.plan ? (
                              <>
                                <span className="adm-status is-paid adm-capitalize">{row.plan}</span>
                                {row.planExpiresAt ? <small className="adm-sub">Until {fmtDate(row.planExpiresAt)}</small> : null}
                              </>
                            ) : (
                              <span className="adm-status is-pending">Free</span>
                            )}
                          </td>
                          <td>{row.resume_count}</td>
                          <td>{fmtDate(row.created_at)}</td>
                          <td>
                            <button type="button" className="adm-link danger" disabled={busy} onClick={() => void removeUser(row)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!users.length && !busy ? <p className="adm-empty">No users match.</p> : null}
                </div>
              ) : null}

              {tab === "resumes" ? (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Owner</th>
                        <th>Public</th>
                        <th>Slug</th>
                        <th>Updated</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {resumes.map((row) => (
                        <tr key={row.id}>
                          <td>{row.fullName || "Untitled"}</td>
                          <td>{row.userEmail || `${row.ownerKey.slice(0, 8)}…`}</td>
                          <td>
                            <button type="button" className="adm-pill" disabled={busy} onClick={() => void togglePublic(row)}>
                              {row.isPublic ? "Public" : "Private"}
                            </button>
                          </td>
                          <td>
                            {row.slug ? (
                              <a className="adm-link" href={`${APP_ORIGIN}/${row.slug}`} target="_blank" rel="noreferrer">
                                /{row.slug}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{fmtDate(row.updatedAt)}</td>
                          <td>
                            <button type="button" className="adm-link danger" disabled={busy} onClick={() => void removeResume(row)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!resumes.length && !busy ? <p className="adm-empty">No CVs match.</p> : null}
                </div>
              ) : null}

              {pager}
            </section>
          ) : null}

          {!blogEditor && busy ? <p className="adm-note">Loading…</p> : null}
        </main>
      </div>
    </div>
  );
}
