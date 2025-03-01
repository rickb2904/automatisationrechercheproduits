// scheduler.js
const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");

// Planifier la tâche chaque dimanche à 3h du matin
cron.schedule("0 3 * * 0", () => {
    console.log("Démarrage du scraping 1...");

    // Lancer scraper.ts
    const scraper1 = spawn("npx", ["ts-node", path.join(__dirname, "scraper", "scraper.ts")], {
        stdio: "inherit",
    });

    scraper1.on("close", (code) => {
        console.log(`Scraper 1 terminé avec le code: ${code}`);
        // Après scraper1, on lance scraper2 si besoin
        console.log("Démarrage du scraping 2...");
        const scraper2 = spawn("npx", ["ts-node", path.join(__dirname, "scraper", "scraper2.ts")], {
            stdio: "inherit",
        });
        scraper2.on("close", (code2) => {
            console.log(`Scraper 2 terminé avec le code: ${code2}`);
        });
    });
});

console.log("Scheduler lancé. En attente de l'heure planifiée...");
