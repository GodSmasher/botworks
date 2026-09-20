// Minimal in-memory stand-in for the supabase-js query builder. It supports
// exactly the read operations the admin panel uses — select (with column
// lists, count and head), eq, not-is-null, order, limit, single — so every
// page runs unchanged against fixture tables.

type Row = Record<string, unknown>

interface Result<T> {
  data: T
  count: number | null
  error: { message: string } | null
}

class MockQuery implements PromiseLike<Result<Row[] | Row | null>> {
  private filters: Array<(row: Row) => boolean> = []
  private sort: { column: string; ascending: boolean } | null = null
  private max: number | null = null
  private columns = '*'
  private wantCount = false
  private head = false
  private one = false

  constructor(private readonly rows: Row[] | undefined, private readonly table: string) {}

  select(columns = '*', opts: { count?: 'exact'; head?: boolean } = {}): this {
    this.columns = columns
    this.wantCount = opts.count === 'exact'
    this.head = opts.head === true
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value)
    return this
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is' && value === null) this.filters.push((row) => row[column] != null)
    else this.filters.push((row) => row[column] !== value)
    return this
  }

  order(column: string, opts: { ascending?: boolean } = {}): this {
    this.sort = { column, ascending: opts.ascending !== false }
    return this
  }

  limit(n: number): this {
    this.max = n
    return this
  }

  single(): this {
    this.one = true
    return this
  }

  private run(): Result<Row[] | Row | null> {
    if (!this.rows) {
      return { data: null, count: null, error: { message: `relation "${this.table}" does not exist` } }
    }

    let rows = this.rows.filter((row) => this.filters.every((f) => f(row)))
    const count = this.wantCount ? rows.length : null

    if (this.sort) {
      const { column, ascending } = this.sort
      rows = [...rows].sort((a, b) => {
        const av = a[column] as string | number | null
        const bv = b[column] as string | number | null
        if (av === bv) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1)
      })
    }
    if (this.max != null) rows = rows.slice(0, this.max)

    if (this.columns.trim() !== '*') {
      const keys = this.columns.split(',').map((c) => c.trim())
      rows = rows.map((row) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null])))
    }

    if (this.head) return { data: null, count, error: null }
    if (this.one) {
      return rows.length === 1
        ? { data: rows[0], count, error: null }
        : { data: null, count, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
    }
    return { data: rows, count, error: null }
  }

  then<TResult1 = Result<Row[] | Row | null>, TResult2 = never>(
    onfulfilled?: ((value: Result<Row[] | Row | null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}

export function createMockClient(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      return new MockQuery(tables[table], table)
    },
  }
}
