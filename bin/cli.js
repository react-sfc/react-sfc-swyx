#!/usr/bin/env node
// 👆 Used to tell Node.js that this is a CLI tool

"use strict";

const sade = require("sade");
const prog = sade("react-sfc");
const chalk = require("chalk");
const CheapWatch = require("cheap-watch");
const { Compiler } = require("../dist/compiler");

const fs = require("fs");
const path = require("path");
const output = fs.readFileSync(path.join(__dirname, "../package.json"), "utf8");

prog
  .version(output.version)
  .command("watch")
  .describe(
    "Transpile a directory of .react files to .js and .css files (default from react to src). Ctrl+C to kill."
  )
  .example("watch")
  .option("--from, -f", "Source dir (default react)")
  .option("--to, -t", "Dist dir (default src)")
  .option("--filetype, -t", "Filetype (default js)")
  .action(async (opts) => {
    const src = opts.from || "react";
    const dst = opts.to || "src";
    const outputFiletype = opts.filetype || "js"; // pass tsx for typescript?
    console.log(
      `> watching files from ${chalk.cyan(src)} to ${chalk.cyan(dst)}`
    );

    const watch = new CheapWatch({ dir: src });
    await watch.init();

    for (const [changedFileSemiPath, stats] of watch.paths) {
      try {
        if (!stats.isDirectory()) {
          compileFile({ src, dst, semiPath: changedFileSemiPath });
          console.log("> output " + path.join(dst, changedFileSemiPath));
          // todo: check dst dir to delete files that are no longer in src?
        }
      } catch (err) {
        console.warn(
          chalk.yellow(
            `Unable to compile ${changedFileSemiPath}, please edit and save`
          )
        );
        console.error(err);
      }
    }

    watch.on("+", ({ path: _path, stats, isNew }) => {
      if (stats.isDirectory()) return;
      compileFile({ src, dst, semiPath: _path });
      const phrase = isNew ? "created" : "updated";
      console.log(`> ${phrase} ` + path.join(dst, _path));
    });
    watch.on("-", ({ path: _path, stats }) => {
      const p = path.join(dst, _path);
      fs.unlinkSync(p);
      console.log("> deleted " + p);
    });
  });

function compileFile({ src, dst, semiPath }) {
  if (!semiPath.endsWith(".react")) return;
  try {
    const changedFilePath = path.join(src, semiPath);
    const code = fs.readFileSync(changedFilePath, "utf8");
    const output = Compiler({ code });
    const pathWithNoReact = semiPath.slice(0, semiPath.length - 5) + outputFiletype;
    const destinaFilePath = path.join(dst, pathWithNoReact);
    mkdirp(destinaFilePath);
    fs.writeFileSync(destinaFilePath, output.js.code);
  } catch (err) {
    console.warn(
      chalk.yellow(`Unable to compile ${semiPath}, please edit and save`)
    );
    console.error(err);
  }
}

console.log("hi");

prog.parse(process.argv);

// stats: Stats {
//   dev: 16777220,
//   mode: 33188,
//   nlink: 1,
//   uid: 501,
//   gid: 20,
//   rdev: 0,
//   blksize: 4096,
//   ino: 14077282,
//   size: 37,
//   blocks: 8,
//   atimeMs: 1596930405579.274,
//   mtimeMs: 1596930404101.0032,
//   ctimeMs: 1596930404101.0032,
//   birthtimeMs: 1596930394717.8994,
//   atime: 2020-08-08T23:46:45.579Z,
//   mtime: 2020-08-08T23:46:44.101Z,
//   ctime: 2020-08-08T23:46:44.101Z,
//   birthtime: 2020-08-08T23:46:34.718Z
// }

function mkdirp(path) {
  path.split("/").reduce(function (prev, next) {
    if (!fs.existsSync(prev)) fs.mkdirSync(prev);
    return prev + "/" + next;
  });
}
