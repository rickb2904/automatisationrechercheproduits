import puppeteer, { Page } from "puppeteer";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config(); // Charger les variables d'environnement depuis .env

// Configuration de la base PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,       // "postgres" par ex.
    host: process.env.DB_HOST,       // "localhost" par ex.
    database: process.env.DB_NAME,   // "idefixeproducts" par ex.
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});

/**
 * Fonction d'auto-scroll pour charger tous les produits (infinite scroll).
 */
async function autoScroll(page: Page) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 300);
        });
    });

    // Attendre un peu après le scroll pour que tous les éléments se chargent
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Fonction de scraping d'une URL
 * - Définit un viewport
 * - Attend un éventuel spinner et sa disparition
 * - Attend .HotDeal si possible
 * - Fait un auto-scroll
 * - Prend un screenshot (try/catch)
 * - Extrait les produits avec gestion des erreurs
 */
async function scrapeUrl(page: Page, url: string, screenshotName: string) {
    console.log(`🔍 Accès à la page : ${url}`);

    // Définir un viewport pour éviter le 0 width
    await page.setViewport({ width: 1280, height: 800 });

    // Naviguer vers l'URL
    await page.goto(url, { waitUntil: "networkidle2" });

    // (1) Attendre l'apparition du spinner (si vous connaissez son sélecteur exact)
    try {
        await page.waitForSelector(".loading-spinner", { timeout: 5000 });
        console.log("⚙️  Spinner détecté, attente de sa disparition...");

        // (2) Attendre que le spinner disparaisse
        await page.waitForSelector(".loading-spinner", { hidden: true, timeout: 15000 });
        console.log("✅ Spinner disparu, on peut continuer.");
    } catch (err) {
        console.log("Le spinner n'est pas apparu ou n'a pas disparu dans les délais.");
    }

    // Attendre l'apparition de .HotDeal (si le site charge via JS)
    try {
        await page.waitForSelector(".HotDeal", { timeout: 5000 });
        console.log("✅ Sélecteur .HotDeal détecté.");
    } catch {
        console.log("⚠️ Le sélecteur .HotDeal n'est pas apparu dans les 5s. La page peut être vide ou protégée.");
    }

    // Auto-scroll pour charger davantage de produits (infinite scroll)
    console.log("🔽 Début de l'auto-scroll pour charger tous les produits...");
    await autoScroll(page);
    console.log("🔼 Fin de l'auto-scroll.");

    // Tenter un screenshot
    try {
        await page.screenshot({ path: screenshotName, fullPage: true });
        console.log(`📸 Screenshot enregistré sous "${screenshotName}".`);
    } catch (e) {
        console.log(`⚠️ Impossible de prendre un screenshot : ${e}`);
    }

    // Extraction des produits avec gestion d'erreur
    console.log("🛒 Extraction des produits...");
    let products: any[] = [];
    try {
        products = await page.evaluate(() => {
            const hotDeals = document.querySelectorAll(".HotDeal");
            return Array.from(hotDeals).map(product => {
                const nameElement = product.querySelector(".ProductName");
                const linkElement = product.querySelector(".ProductName");
                const imageElement = product.querySelector(".ImageArea img");
                const referenceElement = product.querySelector(".ProductNo");
                const colorElements = Array.from(product.querySelectorAll(".IconoColor")) as HTMLImageElement[];

                return {
                    nom: nameElement ? nameElement.textContent?.trim() || "" : "",
                    lien: linkElement ? "https://makito.es" + linkElement.getAttribute("href") : "",
                    image: imageElement ? "https://makito.es" + imageElement.getAttribute("src") : "",
                    reference: referenceElement
                        ? referenceElement.textContent?.replace("Réf: ", "") || ""
                        : "",
                    couleurs: colorElements.map(color => color.title || "")
                };
            });
        });
    } catch (error) {
        console.error("Erreur lors de l'extraction des produits :", error);
    }

    console.log(`📦 Produits extraits depuis ${url} : ${products.length}`);
    return products;
}

(async () => {
    // URLs à scraper
    const urls = [
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=49851&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ViewAction=Monitor&GUID=Store-67C1E0FF-E689-ADA0-FAF8-ACE979B3B378",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23943&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23935&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23942&ViewAction=View&Page=1&PageSize=10000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23857&ViewAction=View&Page=1&PageSize=10000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23921&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23924&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23923&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23947&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23946&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23927&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23948&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23939&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23922&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23928&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23938&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23926&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=8343132&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23940&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23925&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23945&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23930&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23944&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23937&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23931&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23933&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=300703&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23932&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=148654&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23836&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23941&ViewAction=View&Page=1&PageSize=1000",
        "https://makito.es/epages/Makito.sf/fr_FR/?ChangeAction=RealizaBusquedaAvanzada&ObjectID=23934&ViewAction=View&Page=1&PageSize=1000",
    ];

    // Lance le navigateur
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    let allProducts: any[] = [];

    // Scraper chaque URL et accumuler les produits
    for (const [i, url] of urls.entries()) {
        const screenshotName = `debug-${i}.png`;
        const products = await scrapeUrl(page, url, screenshotName);
        allProducts = allProducts.concat(products);
    }

    // Fermer le navigateur
    await browser.close();

    console.log(`🔎 Nombre total de produits extraits : ${allProducts.length}`);
    if (allProducts.length === 0) {
        console.log("❌ Aucun produit à insérer, vérifie le scraping.");
        return;
    }

    // Connexion PostgreSQL
    const client = await pool.connect();
    try {
        console.log("♻️  Suppression de l'ancien contenu de la table 'produits'...");
        await client.query("TRUNCATE TABLE produits RESTART IDENTITY");

        // Insertion de tous les produits, en ignorant les doublons
        for (const product of allProducts) {
            console.log(`💾 Insertion de ${product.nom}...`);

            const query = `
                INSERT INTO produits (nom, lien, image, reference, couleurs)
                VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (reference) DO NOTHING
        RETURNING *;
            `;
            const res = await client.query(query, [
                product.nom,
                product.lien,
                product.image,
                product.reference,
                product.couleurs,
            ]);

            // Si le produit est inséré, rows[0] existe
            if (res.rows.length > 0) {
                console.log(`✅ Produit ajouté : ${res.rows[0].nom}`);
            } else {
                // Sinon, c'est un doublon
                console.log(`⚠️ Doublon ignoré : ${product.nom}`);
            }
        }
        console.log("✅ Tous les produits ont été traités.");
    } catch (err: any) {
        console.error("❌ Erreur lors de l'insertion :", err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();
