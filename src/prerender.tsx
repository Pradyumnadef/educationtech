import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { readFileSync, writeFileSync } from "node:fs";
import { AuthProvider, ToastProvider } from "./lib";
import Landing from "./pages/Landing";
const html = readFileSync("dist/index.html", "utf8");
const markup = renderToString(
  <StaticRouter location="/">
    <AuthProvider>
      <ToastProvider>
        <Landing />
      </ToastProvider>
    </AuthProvider>
  </StaticRouter>,
);
writeFileSync(
  "dist/landing.html",
  html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`),
);
console.log("Public landing page prerendered for search engines.");
