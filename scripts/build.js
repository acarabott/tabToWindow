import fs from "fs-extra";
import esbuild from "esbuild";
import serve, { error, log } from "create-serve";

const safariDir = "./safari/TabToWindow/TabToWindow Extension/Resources/";
const safariScriptDir = `${safariDir}js/`;

const clean = () => fs.removeSync(safariScriptDir);

const safari = (isWatch) => {
  return esbuild
    .build({
      entryPoints: [
        "./safari/TabToWindow/ts/background.ts",
        "./safari/TabToWindow/ts/content.ts",
        "./safari/TabToWindow/ts/popup.ts",
      ],

      bundle: true,
      outdir: safariScriptDir,
      target: ["safari12"],
      sourcemap: true,
      watch: isWatch && {
        onRebuild(err) {
          serve.update();
          err ? error("× Failed") : log("✓ Updated");
        },
      },
    })
    .catch(() => process.exit(1));
};

const createDist = () => {
  fs.mkdirpSync(safariScriptDir);
};

const assets = () => {
  const assetsDir = `${safariDir}/assets/`;
  fs.removeSync(assetsDir);
  fs.copySync("./assets", assetsDir);
  fs.removeSync(`${assetsDir}.gitkeep`);
};

const preBuild = () => {
  clean();
  createDist();
  // fs.copySync("./index.html", `${safariDir}/index.html`);
  // fs.copySync("./main.css", `${safariDir}/main.css`);
  // assets();
};

const action = process.argv[2];
console.log(`running ${action}`);

switch (action) {
  case "clean":
    clean();
    break;

  case "assets":
    createDist();
    assets();
    break;

  case "build":
    preBuild();
    await safari(false);
    break;

  case "start":
    preBuild();
    await safari(true);
    serve.start({ port: 8080, root: safariDir });
    break;

  default:
    console.error("need to pass clean | assets | build | start");
    break;
}