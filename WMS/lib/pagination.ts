export type PaginationQuery = {
  page: number;
  pageSize: number;
  skip: number;
};

export function parsePagination(searchParams: URLSearchParams, defaults?: { page?: number; pageSize?: number; maxPageSize?: number }): PaginationQuery {
  const defaultPage = defaults?.page ?? 1;
  const defaultPageSize = defaults?.pageSize ?? 20;
  const maxPageSize = defaults?.maxPageSize ?? 200;

  const pageRaw = Number(searchParams.get("page") ?? defaultPage);
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? defaultPageSize);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : defaultPage;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), maxPageSize) : defaultPageSize;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

export function parseSort(searchParams: URLSearchParams, allowed: readonly string[], fallback: string) {
  const sortBy = searchParams.get("sortBy");
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  return {
    sortBy: sortBy && allowed.includes(sortBy) ? sortBy : fallback,
    order
  } as const;
}
