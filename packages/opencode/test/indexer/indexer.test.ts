// Set DB path to memory BEFORE imports
process.env.OPENCODE_DB = ":memory:"
process.env.OPENCODE_CLIENT = "tui"

import { describe, expect, afterEach } from "bun:test"
import { Effect, Layer } from "effect"
import { provideTmpdirInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { Indexer } from "../../src/indexer/indexer"
import { Database } from "../../src/storage"
import { Log } from "../../src/util"
import * as CrossSpawnSpawner from "../../src/effect/cross-spawn-spawner"
import { Config } from "../../src/config"
import fs from "fs/promises"
import path from "path"

void Log.init({ print: false })

const it = testEffect(Layer.mergeAll(Indexer.defaultLayer, CrossSpawnSpawner.defaultLayer, Config.defaultLayer))

describe("Indexer", () => {
  afterEach(() => {
    Database.close()
  })

  it.live("should initialize and provide a map of the directory", () =>
    provideTmpdirInstance((dir) =>
      Effect.gen(function* () {
        const indexer = yield* Indexer.Service
        
        // Create some files
        yield* Effect.promise(() => fs.writeFile(path.join(dir, "file1.txt"), "content1"))
        yield* Effect.promise(() => fs.mkdir(path.join(dir, "subdir")))
        yield* Effect.promise(() => fs.writeFile(path.join(dir, "subdir", "file2.txt"), "content2"))

        yield* indexer.init()
        
        // Wait a bit for initial scan to complete (it's forked)
        yield* Effect.promise(() => Bun.sleep(2000))

        const map = yield* indexer.getMap(".", 2)
        
        expect(map.length).toBeGreaterThan(0)
        const file1 = map.find((n: any) => n.path === "file1.txt")
        expect(file1).toBeDefined()
        expect(file1.type).toBe("file")

        const subdir = map.find((n: any) => n.path === "subdir")
        expect(subdir).toBeDefined()
        expect(subdir.type).toBe("dir")
        // In the current implementation, getMap returns children if type is dir
        expect(subdir.children).toBeDefined()
        expect(subdir.children.find((n: any) => n.path === "subdir/file2.txt")).toBeDefined()
      })
    )
  )

  it.live("should handle notes correctly", () =>
    provideTmpdirInstance((dir) =>
      Effect.gen(function* () {
        const indexer = yield* Indexer.Service
        yield* indexer.init()

        const filePath = "test.txt"
        yield* Effect.promise(() => fs.writeFile(path.join(dir, filePath), "test content"))
        
        // Wait for it to be indexed
        yield* Effect.promise(() => Bun.sleep(500))

        yield* indexer.addNote(filePath, "This is a test note", ["test", "important"])

        const notes = yield* indexer.listNotes(filePath)
        expect(notes.length).toBe(1)
        expect(notes[0].content).toBe("This is a test note")
        expect(notes[0].tags).toEqual(["test", "important"])

        const searchResult = yield* indexer.searchNotes("test note")
        expect(searchResult.length).toBe(1)
        expect(searchResult[0].file_path).toBe(filePath)

        const searchByTag = yield* indexer.searchNotes("", ["test"])
        expect(searchByTag.length).toBe(1)

        const noteId = notes[0].id
        yield* indexer.updateNote(noteId, "Updated note content", ["test", "updated"])
        const updatedNotes = yield* indexer.listNotes(filePath)
        expect(updatedNotes[0].content).toBe("Updated note content")
        expect(updatedNotes[0].tags).toEqual(["test", "updated"])

        yield* indexer.deleteNote(noteId)
        const deletedNotes = yield* indexer.listNotes(filePath)
        expect(deletedNotes.length).toBe(0)
      })
    )
  )
})
