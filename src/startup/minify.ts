import { BunFile } from "bun";
import { readdir } from "node:fs/promises";

export const minifyClientsideJS = async () => {
  console.time("Minified clientside javascript");
  const files: BunFile[] = [];
  (
    await readdir(import.meta.dir + "/../public/js", { recursive: true })
  ).forEach(async (f: string) => {
    if (!f.endsWith("min.js")) {
      files.push(Bun.file(`${import.meta.dir}/../public/js/${f}`));
    }
  });

  const transpiler = new Bun.Transpiler({
    loader: "js",
    minifyWhitespace: true,
    deadCodeElimination: false,
  });
  for (const file of files) {
    const text = await file.text();
    const result = transpiler.transformSync(text);
    Bun.write(Bun.file(file.name!.replace(/\.js/, ".min.js")), result);
  }
  console.timeEnd("Minified clientside javascript");
};

if (import.meta.main) {
  await minifyClientsideJS();
}
