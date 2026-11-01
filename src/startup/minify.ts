import { readdir } from "node:fs/promises";

export const minifyClientsideJS = async () => {
  console.time("Minified clientside javascript");
  const files: string[] = [];
  (
    await readdir(import.meta.dir + "/../public/js", { recursive: true })
  ).forEach(async (f: string) => {
    if (!f.endsWith("min.js")) {
      files.push(`${import.meta.dir}/../public/js/${f}`);
    }
  });
  await Bun.build({
    entrypoints: files,
    outdir: `${import.meta.dir}/../public/js`,
    naming: "[dir]/[name].min.[ext]",
    minify: {
      whitespace: true,
      syntax: true,
      keepNames: true,
      identifiers: false,
    },
    splitting: true,
  });
  console.timeEnd("Minified clientside javascript");
};

if (import.meta.main) {
  await minifyClientsideJS();
}
