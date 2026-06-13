/**
 * Wrapper (compat): exporta a implementação canônica do SqliteLocalStore.
 *
 * Motivo: existiam duas implementações com o mesmo nome em pastas diferentes,
 * o que causava imports ambíguos e erro de build.
 *
 * A implementação oficial fica em: src/lib/repository/sqlite-local-store.ts
 */
export * from './repository/sqlite-local-store';
