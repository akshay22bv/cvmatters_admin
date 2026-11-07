import { useCallback, useEffect, useState } from "react";
import {
  adminDeleteResume,
  adminDeleteUser,
  adminListResumes,
  adminListUsers,
  adminStats,
  adminUpdateResume,
  loadMe,
  signIn,
  signOut,
  type Account,
  type AdminResumeRow,
  type AdminStats,
  type AdminUserRow,
  ApiError,
} from "./api";
import { readToken } from "./session";

type Tab = "overview" | "users" | "resumes";

const APP_ORIGIN = typeof __CV_APP_ORIGIN__ === "string" ? __CV_APP_ORIGIN__ : "http://127.0.0.1:3000";

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function App() {
  const [user, setUser] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [resumes, setResumes] = useState<AdminResumeRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [resumeTotal, setResumeTotal] = useState(0);
  const [q, setQ] = useState("");
  const [publicFilter, setPublicFilter] = useState<"" | "true" | "false">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
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

  useEffect(() => {
    setPage(0);
  }, [tab, q, publicFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "overview") void loadOverview();
    else if (tab === "users") void loadUsers();
    else void loadResumes();
  }, [isAdmin, loadOverview, loadResumes, loadUsers, tab]);

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
  };

  const removeUser = async (row: AdminUserRow) => {
    if (!window.confirm(`Delete account for ${row.email}? All their CVs and billing data will go too.`)) return;
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
    if (!window.confirm(`Delete CV "${title}"?`)) return;
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

  const totalPages = tab === "users" ? Math.ceil(userTotal / limit) : Math.ceil(resumeTotal / limit);

  if (!ready) {
    return (
      <div className="adm">
        <p className="adm-note">Checking access…</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="adm">
        <div className="adm-gate">
          <p className="adm-kicker">CV Matters</p>
          <h1>Admin console</h1>
          <p>Sign in with an email listed in <code>ADMIN_EMAILS</code> on the CV Matters API.</p>
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
    <div className="adm">
      <div className="adm-top">
        <a className="adm-back" href={APP_ORIGIN}>
          ← CV Matters app
        </a>
        <div className="adm-top-right">
          <span className="adm-signed">{user.email}</span>
          <button type="button" className="adm-btn" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </div>

      <header className="adm-head">
        <p className="adm-kicker">Operations</p>
        <h1>Admin panel</h1>
        <p className="adm-lead">Users, hosted CVs, and live counts from your database.</p>
      </header>

      <nav className="adm-tabs" aria-label="Admin sections">
        {(["overview", "users", "resumes"] as Tab[]).map((id) => (
          <button key={id} type="button" className={tab === id ? "is-on" : undefined} onClick={() => setTab(id)}>
            {id === "overview" ? "Overview" : id === "users" ? "Users" : "CVs"}
          </button>
        ))}
      </nav>

      {error ? <p className="adm-error">{error}</p> : null}

      {tab === "overview" && stats ? (
        <ul className="adm-stats">
          <li>
            <span>Users</span>
            <strong>{stats.users}</strong>
          </li>
          <li>
            <span>CVs</span>
            <strong>{stats.resumes}</strong>
          </li>
          <li>
            <span>Public CVs</span>
            <strong>{stats.public_resumes}</strong>
          </li>
          <li>
            <span>Active subs</span>
            <strong>{stats.active_subs}</strong>
          </li>
          <li>
            <span>Paid orders</span>
            <strong>{stats.paid_orders}</strong>
          </li>
          <li>
            <span>Ratings</span>
            <strong>{stats.ratings}</strong>
          </li>
          <li>
            <span>Sessions</span>
            <strong>{stats.sessions}</strong>
          </li>
        </ul>
      ) : null}

      {tab !== "overview" ? (
        <div className="adm-toolbar">
          <input
            type="search"
            className="adm-search"
            placeholder={tab === "users" ? "Search name or email" : "Search name, slug, email, or id"}
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
          <button type="button" className="adm-btn" disabled={busy} onClick={() => (tab === "users" ? loadUsers() : loadResumes())}>
            Refresh
          </button>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
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
                      <a href={`${APP_ORIGIN}/${row.slug}`} target="_blank" rel="noreferrer">
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

      {tab !== "overview" && totalPages > 1 ? (
        <div className="adm-pager">
          <button type="button" className="adm-btn" disabled={busy || page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button type="button" className="adm-btn" disabled={busy || page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      ) : null}

      {busy ? <p className="adm-note">Loading…</p> : null}
    </div>
  );
}
