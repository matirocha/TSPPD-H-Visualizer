import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

function solutionsApiPlugin(): Plugin {
  return {
    name: "solutions-api-plugin",
    configureServer(server) {
        const outputsDir = fs.existsSync(path.resolve(__dirname, "..", "..", "Outputs"))
          ? path.resolve(__dirname, "..", "..", "Outputs")
          : path.resolve(__dirname, "..", "Outputs");

        if (req.url === "/api/solutions" && req.method === "GET") {
          try {
            if (!fs.existsSync(outputsDir)) {
              fs.mkdirSync(outputsDir, { recursive: true });
            }
            const files = fs.readdirSync(outputsDir).filter((f) => f.endsWith(".txt") || f.endsWith(".json"));
            const solutionsList = files.map((file) => {
              const filePath = path.join(outputsDir, file);
              const stat = fs.statSync(filePath);
              let meta: any = { filename: file, mtime: stat.mtimeMs };
              try {
                const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                meta = {
                  ...meta,
                  instance: content.instance || file.replace(/\.[^/.]+$/, ""),
                  numCustomers: content.numCustomers || 0,
                  instanceId: content.instanceId || 0,
                  h: content.h || 0.1,
                  capacity: content.capacity || 0,
                  objectiveValue: content.objectiveValue || 0,
                  totalDistance: content.totalDistance || 0,
                  handlingCost: content.handlingCost || 0,
                  tourLength: content.tour ? content.tour.length : 0,
                };
              } catch (e) {
                meta.error = "Invalid JSON";
              }
              return meta;
            });

            // Sort by instanceId or filename
            solutionsList.sort((a, b) => (a.instanceId || 0) - (b.instanceId || 0) || a.filename.localeCompare(b.filename));

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, solutions: solutionsList }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }

        if (req.url?.startsWith("/api/solutions/") && req.method === "GET") {
          const filename = decodeURIComponent(req.url.replace("/api/solutions/", ""));
          const filePath = path.join(outputsDir, filename);

          if (fs.existsSync(filePath)) {
            try {
              const fileContent = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(fileContent);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, data: parsed }));
              return;
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: "Error parsing solution JSON: " + err.message }));
              return;
            }
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: "Archivo no encontrado" }));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), solutionsApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
