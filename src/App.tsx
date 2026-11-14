import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  adminDeleteResume,
  adminDeleteUser,
  adminListOrders,
  adminListResumes,
  adminListUsers,
  adminStats,
  adminUpdateResume,
  loadMe,
  signIn,
  signOut,
  type Account,
  type AdminOrderRow,
  type AdminResumeRow,
  type AdminStats,
  type AdminUserRow,
  ApiError,
} from "./api";
import { useConfirm } from "./ConfirmProvider";
import { readToken } from "./session";

type Tab = "overview" | "orders" | "users" | "resumes";

const APP_ORIGIN = typeof __CV_APP_ORIGIN__ === "string" ? __CV_APP_ORIGIN__ : "http://127.0.0.1:3000";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
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

export function App() {
  const [user, setUser] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [resumes, setResumes] = useState<AdminResumeRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [resumeTotal, setResumeTotal] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [q, setQ] = useState("");
  const [publicFilter, setPublicFilter] = useState<"" | "true" | "false">("");
  const [orderStatus, setOrderStatus] = useState<"" | "paid" | "pending" | "failed">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const confirm = useConfirm();
  const limit = 20;

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
  }, [page, q]);

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
  }, [page, publicFilter, q]);

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
  }, [orderStatus, page, q]);

  useEffect(() => {
    setPage(0);
  }, [tab, q, publicFilter, orderStatus]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "overview") void loadOverview();
    else if (tab === "users") void loadUsers();
    else if (tab === "orders") void loadOrders();
    else void loadResumes();
  }, [isAdmin, loadOrders, loadOverview, loadResumes, loadUsers, tab]);

  const onLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      const result = await signIn(email.trim(), password);
      setUser(result.user);
      setIsAdmin(!!result.isAdmin);
      if (!result.isAdmin) setLoginError("That account isn't in ADMIN_EMAILS on the API server.");
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

  const totalPages =
    tab === "users"
      ? Math.ceil(userTotal / limit)
      : tab === "orders"
        ? Math.ceil(orderTotal / limit)
        : Math.ceil(resumeTotal / limit);

  const tabLabel = TABS.find((item) => item.id === tab)?.label || "Overview";

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
          <p>
            Use an email listed in <code>ADMIN_EMAILS</code> on the API server.
          </p>
          <form className="adm-login" onSubmit={onLogin}>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "adm-side-link is-on" : "adm-side-link"}
              onClick={() => {
                setTab(item.id);
                setNavOpen(false);
              }}
            >
              <span className="adm-side-ico" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </button>
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
              <strong>{tabLabel}</strong>
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

        <main className="adm-content">
          <div className="adm-pagehead">
            <div>
              <h1>{tabLabel}</h1>
              <p>
                {tab === "overview"
                  ? "Live counts for users, payments, and hosted CVs."
                  : tab === "orders"
                    ? "All Cashfree and demo checkout attempts."
                    : tab === "users"
                      ? "Accounts, plans, and CV counts."
                      : "Hosted resumes and public pages."}
              </p>
            </div>
            {tab === "overview" ? (
              <button type="button" className="adm-btn" disabled={busy} onClick={() => void loadOverview()}>
                Refresh
              </button>
            ) : null}
          </div>

          {error ? <p className="adm-error">{error}</p> : null}

          {tab === "overview" && stats ? (
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

          {tab !== "overview" ? (
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

              {totalPages > 1 ? (
                <div className="adm-pager">
                  <span>
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="adm-pager-acts">
                    <button type="button" className="adm-btn" disabled={busy || page === 0} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </button>
                    <button
                      type="button"
                      className="adm-btn"
                      disabled={busy || page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {busy ? <p className="adm-note">Loading…</p> : null}
        </main>
      </div>
    </div>
  );
}
