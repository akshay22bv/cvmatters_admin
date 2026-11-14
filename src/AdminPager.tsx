const PAGE_SIZES = [10, 20, 50] as const;

export function AdminPager({
  page,
  limit,
  total,
  busy = false,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / limit));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const from = total === 0 ? 0 : safePage * limit + 1;
  const to = Math.min(total, (safePage + 1) * limit);

  return (
    <div className="adm-pager">
      <div className="adm-pager-meta">
        <span>
          {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
        </span>
        <label className="adm-pager-size">
          Rows
          <select
            className="adm-select"
            value={limit}
            disabled={busy}
            aria-label="Rows per page"
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="adm-pager-acts">
        <button type="button" className="adm-btn" disabled={busy || safePage === 0} onClick={() => onPageChange(safePage - 1)}>
          Previous
        </button>
        <span className="adm-pager-page">
          Page {safePage + 1} of {totalPages}
        </span>
        <button
          type="button"
          className="adm-btn"
          disabled={busy || safePage >= totalPages - 1}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
