/** Moves between pages of the skills layer or the roster, when a project is too big for one. */
export function Pager({ page, pages, what, onPage }: { page: number; pages: number; what: string; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="pager" role="group" aria-label={`${what} pages`}>
      <button aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      <span aria-live="polite">
        {what} · page {page + 1} of {pages}
      </span>
      <button aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  );
}
