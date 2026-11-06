// Copies pdf.js's background worker into /public so the browser can load it from Nurse Mira itself.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf.worker.min.mjs");
console.log("Copied pdf.worker.min.mjs to public/vendor/");
