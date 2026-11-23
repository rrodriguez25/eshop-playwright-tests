/**
 * Quotes a schema, table or column name for use in SQL. Only for names, which can't be passed
 * as query parameters; values always go in `params`.
 */
export function identifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Quotes a table name, with an optional schema: `table('orders', 'ordering')`. */
export function table(name: string, schema?: string): string {
  return schema ? `${identifier(schema)}.${identifier(name)}` : identifier(name);
}
