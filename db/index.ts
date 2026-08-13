/* ------------------------------------------------------------------ */
/*  Database client — server-only singleton. POSTGRES everywhere:      */
/*                                                                     */
/*    DATABASE_URL=postgres://…  → Neon serverless (HTTP driver) —     */
/*                                 Vercel production & previews        */
/*    no DATABASE_URL            → PGlite (WASM Postgres) persisted    */
/*                                 at db/pgdata — local dev, sandbox,  */
/*                                 CI. Same schema, same SQL dialect.  */
/*                                                                     */
/*  The old SQLite self-initialization/drift-convergence machinery is  */
/*  gone with SQLite itself: schema management is real drizzle-kit     */
/*  migrations (`npm run db:push`), never a runtime side effect. A     */
/*  missing schema fails loudly with the command to run.               */
/*                                                                     */
/*  ASYNC-COMPAT LAYER (the migration seam): better-sqlite3 was        */
/*  synchronous and 1,300+ call sites use `.all()` / `.get()` /        */
/*  `.run()`. Postgres drivers are async. Drizzle's builders already   */
/*  extend QueryPromise (they're thenable), so we add three tiny       */
/*  methods to that ONE base class:                                    */
/*      .all()  → the builder itself (await → rows)                    */
/*      .get()  → first row or undefined                               */
/*      .run()  → the builder itself (await → executes)                */
/*  Call sites keep their exact shape and simply gain `await`.         */
/* ------------------------------------------------------------------ */

import path from "path";
import { QueryPromise } from "drizzle-orm";
import * as schema from "./schema";

/* ---------------------- async-compat prototype --------------------- */
/* Drizzle wires its builders with applyMixins() — QueryPromise methods
   are COPIED onto each builder prototype, not inherited — so patching
   QueryPromise.prototype alone never reaches PgSelectBase & friends.
   Worse, bundlers can load BOTH the ESM and CJS copies of drizzle-orm
   (dual-package hazard), so patching statically-imported classes can
   hit the wrong copy. The only airtight approach: build one dummy
   builder of each kind FROM THE LIVE db INSTANCE and patch the class
   prototypes those instances actually use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function patchProto(proto: any) {
  if (!proto || proto.all) return;
  proto.all = function () {
    return this; // thenable — `await q.all()` resolves to the row array
  };
  proto.get = async function () {
    const rows = await this;
    return Array.isArray(rows) ? rows[0] : rows;
  };
  proto.run = function () {
    return this; // thenable — `await q.run()` executes the statement
  };
}

function patchBuilders(d: any) {
  // constructing builders runs NO SQL — execution happens only on await
  patchProto(Object.getPrototypeOf(d.select().from(schema.kvState)));
  patchProto(Object.getPrototypeOf(d.insert(schema.kvState).values({ key: "__patch__", value: "" })));
  patchProto(Object.getPrototypeOf(d.update(schema.kvState).set({ value: "" })));
  patchProto(Object.getPrototypeOf(d.delete(schema.kvState)));
  patchProto((QueryPromise as any).prototype); // anything that truly extends it
}

declare module "drizzle-orm" {
  interface QueryPromise<T> {
    /** async-compat: resolves to the full result (row array) */
    all(): Promise<T>;
    /** async-compat: resolves to the first row or undefined */
    get(): Promise<T extends (infer U)[] ? U | undefined : T>;
    /** async-compat: executes the statement */
    run(): Promise<T>;
  }
}

/* --------------------------- driver choice ------------------------- */

type AnyDb = import("drizzle-orm/pglite").PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __mavynDb?: AnyDb };

function create(): AnyDb {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    // Neon serverless over HTTP — no pools to leak in serverless functions.
    // (Cast: neon-http and pglite expose the same query-builder surface;
    // the app uses no driver-specific APIs and no transactions.)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { neon } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { drizzle } = require("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as AnyDb;
  }
  // Local/sandbox: PGlite persisted on disk — real Postgres semantics,
  // zero external services. Created lazily; queries await readiness.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PGlite } = require("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drizzle } = require("drizzle-orm/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), "db", "pgdata");
  return drizzle(new PGlite(dataDir), { schema }) as AnyDb;
}

export const db = globalForDb.__mavynDb ?? (globalForDb.__mavynDb = create());
patchBuilders(db);

export * as tables from "./schema";
