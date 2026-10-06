/** npm run demo:install | npm run demo:remove */
import { dataRoot } from "../src/lib/fsutil";
import { installDemo, removeDemo } from "../src/lib/demo";

const cmd = process.argv[2];
(async () => {
  try {
    if (cmd === "install") console.log(`Installed ${(await installDemo()).join(", ")} into ${dataRoot()}`);
    else if (cmd === "remove") {
      const removed = await removeDemo();
      console.log(removed.length ? `Removed ${removed.join(", ")}` : "No demo projects installed.");
    } else {
      console.log("Usage: tsx scripts/demo.ts install|remove");
      process.exit(2);
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
})();
