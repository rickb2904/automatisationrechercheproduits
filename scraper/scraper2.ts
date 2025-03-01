/***********************************************************
 * scraperToptex.ts
 * -------------------------------------
 * npm install puppeteer pg dotenv
 * tsc scraperToptex.ts && node scraperToptex.js
 ***********************************************************/
import puppeteer, { Page } from "puppeteer";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

/**
 * Définition du type de produit
 */
interface Product {
    reference: string;
    marque: string;
    nom: string;
    image: string;
    prix: string;
    nbCouleurs: string;
    categorie: string; // On veut stocker la catégorie
}

/**
 * Configuration PostgreSQL via DATABASE_URL
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

/**
 * Petite fonction d’attente
 */
function delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Récupère les produits sur UNE page (ex: &page=2&limit=24)
 */
async function scrapeOnePage(page: Page, url: string): Promise<Product[]> {
    console.log(`🔎 Navigation vers : ${url}`);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Sélecteur repéré dans le HTML : "ul#cat_products_grid li[data-objectid]"
    const products = await page.evaluate(() => {
        const selector = "ul#cat_products_grid li[data-objectid]";
        const items = document.querySelectorAll(selector);

        return Array.from(items).map(li => {
            const refSpan = li.querySelector(".product-ref span");
            const reference = refSpan?.textContent?.trim() || "";

            const descLink = li.querySelector(".product-description a");
            let marque = "";
            let nom = "";
            if (descLink) {
                const bTag = descLink.querySelector("b");
                marque = bTag?.textContent?.trim() || "";
                const fullText = descLink.textContent?.trim() || "";
                const splitted = fullText.split(" - ");
                // ex: "Kariban - Espadrilles unisexe Made in France"
                nom = splitted.length > 1 ? splitted[1].trim() : fullText;
            }

            const img = li.querySelector(".product-image-wrapper img");
            const image = img?.getAttribute("src") || "";

            const priceSpan = li.querySelector(".product-price");
            const prix = priceSpan?.textContent?.trim() || "";

            const colorsValue = li.querySelector(".product-colors-nb-value");
            const nbCouleurs = colorsValue?.textContent?.trim() || "0";

            // On ne met pas encore la catégorie, on la rajoutera après
            return {
                reference,
                marque,
                nom,
                image,
                prix,
                nbCouleurs,
                categorie: "", // provisoirement vide
            };
        });
    });

    console.log(`  ➕ ${products.length} produits trouvés sur cette page.`);
    return products;
}

/**
 * Scrape TOUTES les pages d’une catégorie (jusqu’à maxPages ou page vide)
 * @param page        instance puppeteer
 * @param baseUrl     ex: "https://www.toptex.fr/produits/chaussures.html"
 * @param categoryName ex: "chaussures"
 */
async function scrapeCategory(page: Page, baseUrl: string, categoryName: string): Promise<Product[]> {
    const allProducts: Product[] = [];
    let pageIndex = 1;
    const maxPages = 200; // limite de sécurité

    while (true) {
        // URL typique : https://www.toptex.fr/produits/chaussures.html?page=2&limit=24
        const url = `${baseUrl}?page=${pageIndex}&limit=24`;
        const currentProducts = await scrapeOnePage(page, url);

        if (currentProducts.length === 0) {
            console.log("⚠️ Page vide => fin de la catégorie.");
            break;
        }

        // On ajoute la catégorie
        for (const p of currentProducts) {
            p.categorie = categoryName;
        }

        allProducts.push(...currentProducts);

        if (pageIndex >= maxPages) {
            console.log(`⚠️ Limite de pages atteinte : ${maxPages}`);
            break;
        }
        pageIndex++;

        // Petite pause si besoin (évite d’enchaîner trop vite)
        await delay(2000);
    }

    console.log(`✅ [${categoryName}] Total final : ${allProducts.length} produits.`);
    return allProducts;
}

/**
 * MAIN
 *  - Lance Puppeteer
 *  - Scrape plusieurs catégories
 *  - Insère en base de données
 */
(async () => {
    // Liste des catégories à scraper
    const categories = [
        {
            url: "https://www.toptex.fr/produits/vetements.html",
            name: "vetements"
        },
        {
            url: "https://www.toptex.fr/produits/casquettes-et-bonnets.html",
            name: "casquettes-et-bonnets"
        },
        {
            url: "https://www.toptex.fr/produits/bagagerie.html",
            name: "bagagerie"
        },
        {
            url: "https://www.toptex.fr/produits/linge-de-maison.html",
            name: "linge-de-maison"
        },
        {
            url: "https://www.toptex.fr/produits/chaussures.html",
            name: "chaussures"
        },
    ];

    // Lance Puppeteer
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            '--js-flags="--max-old-space-size=8192"'
        ],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    page.setDefaultNavigationTimeout(120_000);

    // Tableau global de tous les produits
    const allProducts: Product[] = [];

    // On scrape chaque catégorie
    for (const cat of categories) {
        console.log(`\n==== Scraping catégorie : ${cat.name} ====\n`);
        const catProducts = await scrapeCategory(page, cat.url, cat.name);
        allProducts.push(...catProducts);
    }

    // Fermeture du navigateur
    await browser.close();

    console.log(`\n🌐 TOTAL global tous produits : ${allProducts.length}`);

    // Insertion dans PostgreSQL
    const client = await pool.connect();
    try {
        // On peut vider la table "produits_toptex" avant
        console.log("♻️  TRUNCATE TABLE produits_toptex...");
        await client.query("TRUNCATE TABLE produits_toptex RESTART IDENTITY");

        // Insert
        for (const prod of allProducts) {
            const query = `
                INSERT INTO produits_toptex (reference, marque, nom, image, prix, nb_couleurs, categorie)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (reference) DO NOTHING
        RETURNING *;
            `;
            const values = [
                prod.reference,
                prod.marque,
                prod.nom,
                prod.image,
                prod.prix,
                prod.nbCouleurs,
                prod.categorie,
            ];

            const res = await client.query(query, values);
            if (res.rows.length > 0) {
                console.log(`✅ Inséré : ${prod.nom}`);
            }
        }

        console.log("✅ Insertion terminée.");
    } catch (err: any) {
        console.error("❌ Erreur lors de l'insertion :", err.message);
    } finally {
        client.release();
    }

    console.log("Fin du script.");
})();
