import fs from "fs";
// import path from "path";
import { Compiler } from "../src/compiler";
fs.readdirSync("tests")
  .filter((p) => fs.lstatSync("tests/" + p).isDirectory())
  .filter(p => !p.startsWith('__snapshots__'))
  .forEach((p) => {
    // console.log({ p });
    it(`passes ${p} snapshot test`, () => {
      const src = fs.readFileSync("tests/" + p + "/src.react", "utf8");
      const output = Compiler({ code: src });
      expect(output).toMatchSnapshot();
    });
  });
