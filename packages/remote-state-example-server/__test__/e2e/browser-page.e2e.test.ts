/**
 * The browser page's modules: the page's import map points to the paths the
 * host serves, and each path serves JavaScript from the installed packages.
 */

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { silentLogger } from "@malte.muth/remote-state";
import path from "path";
import request from "supertest";
import { fileURLToPath } from "url";
import {
  createExampleServer,
  type ExampleServer,
} from "../../src/host/servers.js";

const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public",
);

describe("Browser page", () => {
  let example: ExampleServer;

  beforeAll(async () => {
    example = await createExampleServer({
      logger: silentLogger,
      publicDirectory,
    });
  });
  afterAll(() => example.close());

  it("serves every module of the page's import map as JavaScript", async () => {
    const { text } = await request(example.app).get("/").expect(200);
    const importMap = text.match(
      /<script type="importmap">([\s\S]*?)<\/script>/,
    );
    const imports: Record<string, string> = JSON.parse(importMap![1]).imports;
    expect(Object.keys(imports).sort()).toEqual([
      "@malte.muth/remote-state-client",
      "immer",
      "socket.io-client",
    ]);
    for (const modulePath of Object.values(imports)) {
      const response = await request(example.app).get(modulePath).expect(200);
      expect(response.headers["content-type"]).toMatch(/javascript/);
    }
  });

  it("serves the client package's own modules", async () => {
    const response = await request(example.app)
      .get("/modules/remote-state-client/viewStore.js")
      .expect(200);
    expect(response.text).toContain("from 'immer'");
  });
});
