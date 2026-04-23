import { Context, Effect, Layer } from "effect"
import { Bus } from "@/bus"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { Database, eq, like, and, or, sql } from "@/storage"
import { IndexerNodeTable, IndexerNoteTable } from "./schema.sql"
import { Glob } from "@opencode-ai/shared/util/glob"
import path from "path"
import { stat } from "@/util/filesystem"
import { ulid } from "ulid"
import { Log } from "@/util"
import { InstanceState } from "@/effect"
import { Flag } from "@/flag/flag"

import { Config } from "@/config"

const log = Log.create({ service: "indexer" })

export interface Interface {
  readonly init: () => Effect.Effect<void>
  readonly getMap: (dirPath: string, depth: number) => Effect.Effect<any>
  readonly addNote: (filePath: string, content: string, tags?: string[]) => Effect.Effect<void>
  readonly searchNotes: (query: string, tags?: string[]) => Effect.Effect<any[]>
  readonly listNotes: (filePath: string) => Effect.Effect<any[]>
  readonly updateNote: (id: string, content: string, tags?: string[]) => Effect.Effect<void>
  readonly deleteNote: (id: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Indexer") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service

    const indexFile = (relPath: string) =>
      Effect.promise(async () => {
        try {
          const fullPath = path.join(Instance.directory, relPath)
          const s = stat(fullPath)
          if (!s) return

          const type = s.isDirectory() ? "dir" : s.isSymbolicLink() ? "symlink" : "file"
          const normalizedPath = relPath.replace(/\\/g, "/")
          const parent_path = (normalizedPath === "." || normalizedPath === "") ? null : path.dirname(normalizedPath).replace(/\\/g, "/")
          const workspace = Instance.project.id

          Database.use((db: any) =>
            db
              .insert(IndexerNodeTable)
              .values({
                id: `${workspace}:${normalizedPath}`,
                workspace,
                path: normalizedPath,
                parent_path: parent_path === "." ? null : parent_path,
                type,
                size: Number(s.size),
              })
              .onConflictDoUpdate({
                target: IndexerNodeTable.id,
                set: {
                  type,
                  size: Number(s.size),
                  time_updated: Date.now(),
                },
              })
              .run()
          )
        } catch (e) {
          log.error("indexFile failed", { relPath, e })
        }
      })


    const removeFile = (relPath: string) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        Database.use((db: any) => db.delete(IndexerNodeTable).where(and(eq(IndexerNodeTable.workspace, workspace), eq(IndexerNodeTable.path, relPath.replace(/\\/g, "/")))).run())
      })

    const configService = yield* Config.Service

    const state = yield* InstanceState.make(
      Effect.fn("Indexer.state")(function* () {
        const flag = yield* Flag.OPENCODE_EXPERIMENTAL_DISABLE_INDEXER
        const cfg = yield* configService.get()
        if (flag || cfg.experimental?.disable_indexer) return

        log.info("initializing indexer", { directory: Instance.directory })

        // Initial scan
        const scan = Effect.fn("Indexer.initialScan")(function* () {
          try {
            const workspace = Instance.project.id
            const existingCount = yield* Effect.sync(() => Database.use((db: any) => db.select({ count: sql<number>`count(*)` }).from(IndexerNodeTable).where(eq(IndexerNodeTable.workspace, workspace)).get()))
            if (existingCount && existingCount.count > 0) {
              log.info("workspace already indexed, skipping initial scan", { workspace, count: existingCount.count })
              return
            }

            const files = yield* Effect.promise(() =>
              Glob.scan("**/*", {
                cwd: Instance.directory,
                include: "all",
                dot: true,
              }),
            )

            // Ignore common node_modules, git, and build outputs manually
            const ignoreRegex = /(?:^|[\\/])(?:\.git|node_modules|\.next|dist|build|out|\.idea|\.vscode)(?:[\\/]|$)/
            const filtered = files.filter((f) => !ignoreRegex.test(f))

            log.info("initial scan complete", { count: filtered.length, total: files.length })

            // Index all files in batches
            for (let i = 0; i < filtered.length; i += 100) {
              const batch = filtered.slice(i, i + 100)
              yield* Effect.all(batch.map(indexFile), { concurrency: 10 })
            }

            // Also index root
            yield* indexFile(".")
          } catch (e) {
            log.error("Initial scan failed", { error: e })
          }
        })


        yield* scan().pipe(Effect.forkScoped)

        // Subscribe to file changes
        const off = yield* bus.subscribeCallback(FileWatcher.Event.Updated, (payload) => {
          const relPath = path.relative(Instance.directory, payload.properties.file)
          if (relPath.startsWith("..") || path.isAbsolute(relPath)) return
          if (/(?:^|[\\/])(?:\.git|node_modules|\.next|dist|build|out|\.idea|\.vscode)(?:[\\/]|$)/.test(relPath)) return

          if (payload.properties.event === "unlink") {
            Effect.runFork(removeFile(relPath))
          } else {
            Effect.runFork(indexFile(relPath))
          }
        })
        yield* Effect.addFinalizer(() => Effect.sync(off))
      }),
    )

    const getMap = (dirPath: string, depth: number) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        const relDir = path.relative(Instance.directory, path.resolve(Instance.directory, dirPath))
        const normalizedDir = (relDir === "." || relDir === "") ? null : relDir.replace(/\\/g, "/")

        return Database.use((db: any) => {
          const nodes = db
            .select()
            .from(IndexerNodeTable)
            .where(
              and(
                eq(IndexerNodeTable.workspace, workspace),
                normalizedDir === null
                  ? sql`parent_path IS NULL OR parent_path NOT LIKE '%/%'`
                  : or(eq(IndexerNodeTable.path, normalizedDir), like(IndexerNodeTable.parent_path, `${normalizedDir}%`))
              )
            )
            .all()

          // Helper to build tree
          const buildTree = (currentPath: string | null, currentDepth: number): any[] => {
            if (currentDepth > depth) return []
            return nodes
              .filter((n: any) => n.parent_path === currentPath)
              .map((n: any) => ({
                ...n,
                children: n.type === "dir" ? buildTree(n.path, currentDepth + 1) : undefined,
              }))
          }

          return buildTree(normalizedDir, 0)
        })
      })

    const addNote = (filePath: string, content: string, tags: string[] = []) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        const relPath = path.relative(Instance.directory, path.resolve(Instance.directory, filePath))
        Database.use((db: any) =>
          db
            .insert(IndexerNoteTable)
            .values({
              id: ulid(),
              workspace,
              file_path: relPath.replace(/\\/g, "/"),
              content,
              tags,
            })
            .run(),
        )
      })

    const searchNotes = (query: string, tags?: string[]) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        return Database.use((db: any) => {
          const conds: any[] = [eq(IndexerNoteTable.workspace, workspace), like(IndexerNoteTable.content, `%${query}%`)]
          if (tags && tags.length > 0) {
            conds.push(sql`${IndexerNoteTable.tags} LIKE ${`%"${tags[0]}"%`}`)
          }
          return db.select().from(IndexerNoteTable).where(and(...conds)).all()
        })
      })

    const listNotes = (filePath: string) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        const relPath = path.relative(Instance.directory, path.resolve(Instance.directory, filePath))
        return Database.use((db: any) =>
          db.select().from(IndexerNoteTable).where(and(eq(IndexerNoteTable.workspace, workspace), eq(IndexerNoteTable.file_path, relPath.replace(/\\/g, "/")))).all(),
        )
      })

    const updateNote = (id: string, content: string, tags?: string[]) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        Database.use((db: any) => {
          const values: any = { content, time_updated: Date.now() }
          if (tags !== undefined) values.tags = tags
          db.update(IndexerNoteTable)
            .set(values)
            .where(and(eq(IndexerNoteTable.workspace, workspace), eq(IndexerNoteTable.id, id)))
            .run()
        })
      })

    const deleteNote = (id: string) =>
      Effect.sync(() => {
        const workspace = Instance.project.id
        Database.use((db: any) =>
          db.delete(IndexerNoteTable)
            .where(and(eq(IndexerNoteTable.workspace, workspace), eq(IndexerNoteTable.id, id)))
            .run(),
        )
      })

    return Service.of({
      init: Effect.fn("Indexer.init")(function* () {
        yield* Effect.catch(InstanceState.get(state), (e) => Effect.logError("Indexer init error", e))
      }),
      getMap,
      addNote,
      searchNotes,
      listNotes,
      updateNote,
      deleteNote,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Bus.defaultLayer), Layer.provide(Config.defaultLayer))

export * as Indexer from "./indexer"


