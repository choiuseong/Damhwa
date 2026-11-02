// [변경] 병합: 새 파일. 한글·띄어쓰기가 들어간 폴더(예: C:\Users\...\김시현 과제)에서도 내장 DB 가 켜지도록
//        PGlite 가 스스로 찾던 pglite.data / *.wasm 파일을 직접 읽어서 넘김
import { readFileSync } from "node:fs";
import path from "node:path";

export async function pgliteAssets() {
  const dist = path.dirname(require.resolve("@electric-sql/pglite"));
  const read = (name: string) => readFileSync(path.join(dist, name));
  return {
    fsBundle: new Blob([read("pglite.data")]),
    pgliteWasmModule: await WebAssembly.compile(read("pglite.wasm")),
    initdbWasmModule: await WebAssembly.compile(read("initdb.wasm")),
  };
}
