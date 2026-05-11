import { defineConfig } from "vitest/config";
 
 export default defineConfig({
   test: {
     include: ["playground.ts"],
     reporters: [
       {
         onInit() {
           process.stdout.write("\x1Bc");
         },
         onWatcherRerun() {
           process.stdout.write("\x1Bc");
         },
         onUserConsoleLog(log) {
           process.stdout.write(log.content);
         },
         onFinished() {
           // No summary footer
         },
       },
     ],
   },
 });
