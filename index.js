import * as core from "@actions/core";
import puppeteer, { KnownDevices } from "puppeteer";
import fs from "fs";
import { execSync } from "child_process";

async function run() {
  const start = Date.now();
  try {
    const file = core.getInput("file", { required: true });
    const pageTitle = core.getInput("page-title", { required: true });
    const device = "iPhone X";
    const loginEndpoint =
      "https://xyy.huijiwiki.com/api.php?action=query&meta=tokens&type=login";
    const apiEndpoint = "https://xyy.huijiwiki.com/api.php";
    const username = core.getInput("username", { required: true });
    const password = core.getInput("password", { required: true });

    core.info(`Verwende Datei: ${file}`);
    if (!fs.existsSync(file)) {
      throw new Error(`Datei nicht gefunden: ${file}`);
    }
    const text = fs.readFileSync(file, "utf-8").trim();

    // Commit Message lesen
    let commitMessage = "";
    try {
      commitMessage = execSync("git log -1 --pretty=%B").toString().trim();
    } catch (e) {
      core.warning("Konnte Commit Message nicht ermitteln.");
    }

    const repo = process.env.GITHUB_REPOSITORY || "";
    const actor = process.env.GITHUB_ACTOR || "";
    const sha = process.env.GITHUB_SHA || "";

    const summary = `${commitMessage}(Editor: ${actor} – https://github.com/${repo}/commit/${sha})`;

    core.info("Starte Puppeteer...");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    if (KnownDevices[device]) {
      await page.emulate(KnownDevices[device]);
    } else {
      core.warning(
        `Gerät ${device} nicht gefunden. Verwende Default Viewport.`
      );
    }

    page.on("console", (msg) => core.info(`[Browser] ${msg.text()}`));

    core.info("Hole Login Token Seite...");
    await page.goto(loginEndpoint, { waitUntil: "networkidle2" });

    const result = await page.evaluate(inBrowserFunc, {
      username,
      password,
      text,
      summary,
      pageTitle,
      apiEndpoint,
    });

    await browser.close();

    if (result === true) {
      core.info("Wiki Bearbeitung erfolgreich.");
      core.setOutput("updated", "true");
    } else {
      throw new Error(`Wiki Bearbeitung fehlgeschlagen: ${result}`);
    }
  } catch (error) {
    core.setFailed(error.message || String(error));
  } finally {
    core.info(`Laufzeit: ${(Date.now() - start) / 1000}s`);
  }
}

// interface BrowserArgs {
//   username: string;
//   password: string;
//   text: string;
//   summary: string;
//   pageTitle: string;
//   apiEndpoint: string;
// }

async function inBrowserFunc(args) {
  try {
    const { username, password, text, summary, pageTitle, apiEndpoint } = args;
    console.log("Parsing login token JSON...");
    // @ts-ignore
    const preEle = document.querySelector("pre");
    if (!preEle || !preEle.innerText) {
      throw new Error(
        // @ts-ignore
        `Kein <pre> mit JSON gefunden. DOM: ${document.body.innerHTML}`
      );
    }
    const data = JSON.parse(preEle.innerText);
    const loginToken = data.query?.tokens?.logintoken;
    if (!loginToken) throw new Error("Kein Login Token gefunden.");

    console.log("Login wird ausgeführt...");
    const formData = new FormData();
    formData.append("action", "login");
    formData.append("lgname", username);
    formData.append("lgpassword", password);
    formData.append("lgtoken", loginToken);
    formData.append("format", "json");

    const loginResp = await fetch(apiEndpoint, {
      method: "POST",
      body: formData,
    });
    const loginResult = await loginResp.json();
    if (loginResult.login?.result !== "Success") {
      throw new Error("Login fehlgeschlagen: " + JSON.stringify(loginResult));
    }

    console.log("Hole CSRF Token über mw.Api...");
    // @ts-expect-error mw global im Wiki
    const api = new window.mw.Api();
    const editResult = await api.postWithToken("csrf", {
      action: "edit",
      title: pageTitle,
      text,
      bot: true,
      summary,
    });

    if (editResult?.edit?.result !== "Success") {
      throw new Error("Edit fehlgeschlagen: " + JSON.stringify(editResult));
    }
    return true;
  } catch (err) {
    console.error("Fehler im Browser:", err);
    return err.message || String(err);
  }
}

run();
