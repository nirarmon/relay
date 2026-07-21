export interface DataTableColumn<T> {
  // `keyof T | string` collapses to plain `string` at the type level (a union with its
  // own supertype), so this gives no compile-time typo protection today — it's written
  // this way to allow future virtual/computed columns with a custom `render` and no
  // matching field on T. Callers relying on real `T` keys get no extra safety from this
  // union; a typo'd key silently falls back to an empty cell at runtime, not a build error.
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  onRowSelect?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({ rows, columns, getRowId, onRowSelect, rowClassName }: DataTableProps<T>) {
  return (
    <div className="overflow-auto rounded-md border border-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="border-b border-slate-800 px-3 py-2 text-left font-mono text-xs uppercase tracking-wide text-slate-400">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={onRowSelect ? () => onRowSelect(row) : undefined}
              className={`border-b border-slate-900 leading-relaxed hover:bg-slate-900/60 ${onRowSelect ? "cursor-pointer" : ""} ${rowClassName?.(row) ?? ""}`}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className={`px-3 py-2 ${col.className ?? ""}`}>
                  {col.render ? col.render(row) : String((row as any)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
