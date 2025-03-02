/***********************************************************
 * scraperPayper.ts
 * -------------------------------------
 * npm install puppeteer pg dotenv
 * tsc scraperPayper.ts && node scraperPayper.js
 ***********************************************************/
import puppeteer, { Page } from "puppeteer";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

/**
 * Définition du type de produit
 *  - On inclut "lien" et "marque" pour correspondre à la table
 */
interface Product {
    reference: string;
    nom: string;
    lien: string;
    image: string;
    couleurs: string;
    categorie: string;
    marque: string; // On laissera vide pour Payper
}

/**
 * Configuration PostgreSQL via .env
 */
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});

/**
 * Petite fonction d’attente
 */
function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Mapping catégories anglaises -> françaises
 */
const categoryMapping: Record<string, string> = {
    "polo-shirts": "Polos",
    "t-shirts": "T-shirts",
    "shirts": "Chemises",
    "sweatshirts": "Sweatshirts",
    "pullovers": "Pullovers",
    "polar-jackets": "Polaires",
    "4-season": "4 saisons",
    "work-coats": "Blouses",
    "vests": "Gilets",
    "jackets": "Vestes",
    "soft-shells": "Softshell",
    "padded-soft-shells": "Softshell matelassé",
    "bermuda-shorts": "Bermudas",
    "denim": "Jeans",
    "trousers": "Pantalons",
    "sweat-trousers": "Jogging",
    "overall-and-bib": "Salopettes",
    "thermal-shirts": "T-shirts thermiques",
    "anti-rain": "Anti-pluie",
    "thermal-pants": "Pantalons thermiques",
    "swimwear": "Maillots",
    "accessories": "Accessoires",
    "merchandising": "Merchandising",
    "neckwarmer": "Tour de cou",
    "high-visibility": "Haute visibilité",
    "tech-nik": "Tech-nik",
    "multipro": "Multipro",
    "industry": "Industrie",
    "corporate": "Entreprise",
};

/**
 * Récupère les produits sur UNE page Payper
 *  - Extrait la catégorie (h1)
 *  - Parcourt .catalogoItem
 *  - Retourne un tableau Product
 */
async function scrapeOnePayperPage(page: Page, url: string): Promise<Product[]> {
    console.log(`🔎 Navigation vers : ${url}`);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Récupérer la catégorie depuis le h1 (ex: "Polos", "T-Shirts", etc.)
    let categoryName = "";
    try {
        await page.waitForSelector(".catalogo-title h1", { timeout: 5000 });
        categoryName = await page.$eval(".catalogo-title h1", el => el.textContent?.trim() || "");
    } catch (err) {
        console.log("⚠️ Impossible de récupérer la catégorie (h1).", err);
    }

    // Attendre l'apparition des produits
    await page.waitForSelector(".catalogoItem", { timeout: 5000 });

    // Extraction
    const products: Product[] = await page.evaluate((cat) => {
        const items = document.querySelectorAll(".catalogoItem");

        return Array.from(items).map(div => {
            // Lien
            const aTag = div.querySelector("a");
            const lien = aTag ? aTag.getAttribute("href") || "" : "";

            // Nom
            const labelDiv = div.querySelector(".catalogoItemLabel");
            const nom = labelDiv ? labelDiv.textContent?.trim() || "" : "";

            // Image
            const imgTag = div.querySelector(".catalogoItemImg img");
            const image = imgTag ? imgTag.getAttribute("src") || "" : "";

            // Couleurs (ex. "14 couleurs")
            const colorsSpan = div.querySelector(".catalogoItemColors .label-danger");
            const couleurs = colorsSpan ? colorsSpan.textContent?.trim() || "" : "";

            // Référence (dernier segment de l'URL)
            let reference = "";
            if (lien) {
                const parts = lien.split("/");
                reference = parts[parts.length - 1];
            }

            // marque sera vide pour Payper
            return {
                reference,
                nom,
                lien,
                image,
                couleurs,
                categorie: cat,
                marque: "",
            };
        });
    }, categoryName);

    console.log(`  ➕ ${products.length} produits trouvés sur la page [${categoryName}].`);
    return products;
}

/**
 * Scrape TOUTES les pages d’une "catégorie" Payper
 *  - Contrairement à TopTex, Payper n'a pas de pagination
 *  - On fait juste un "scrapeOnePayperPage" unique
 */
async function scrapePayperCategory(page: Page, url: string): Promise<Product[]> {
    const products = await scrapeOnePayperPage(page, url);
    return products;
}

/**
 * MAIN
 *  - Lance Puppeteer
 *  - Scrape plusieurs catégories (URLs)
 *  - Insère en base de données
 */
(async () => {
    // Liste des catégories (URL + name)
    const payperCategories = [
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/t-shirts-polo-shirts-shirts/polo-shirts", name: "polo-shirts" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/t-shirts-polo-shirts-shirts/t-shirts", name: "t-shirts" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/t-shirts-polo-shirts-shirts/shirts", name: "shirts" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/sweatshirts-pullovers/sweatshirts", name: "sweatshirts" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/sweatshirts-pullovers/pullovers", name: "pullovers" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/sweatshirts-pullovers/polar-jackets", name: "polar-jackets" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/jackets/4-season", name: "4-season" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/jackets/work-coats", name: "work-coats" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/jackets/vests", name: "vests" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/jackets/jackets", name: "jackets" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/jackets/soft-shells", name: "soft-shells" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/jackets/padded-soft-shells", name: "padded-soft-shells" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/trousers/bermuda-shorts", name: "bermuda-shorts" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/trousers/denim", name: "denim" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/trousers/trousers", name: "trousers" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/trousers/sweat-trousers", name: "sweat-trousers" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/overalls-and-sets/overall-and-bib", name: "overall-and-bib" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/baselayers/thermal-shirts", name: "thermal-shirts" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/overalls-and-sets/anti-rain", name: "anti-rain" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/baselayers/thermal-pants", name: "thermal-pants" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/swimwear/swimwear", name: "swimwear" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/other/accessories", name: "accessories" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/other/merchandising", name: "merchandising" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/other/neckwarmer", name: "neckwarmer" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/topics/high-visibility", name: "high-visibility" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/topics/tech-nik", name: "tech-nik" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/topics/multipro", name: "multipro" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/topics/industry", name: "industry" },
        { url: "https://www.payperwear.com/cat/it-fr/casual-workwear/topics/corporate", name: "corporate" },
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

    // On scrape chaque catégorie Payper
    for (const cat of payperCategories) {
        console.log(`\n==== Scraping catégorie : ${cat.name} ====\n`);
        const catProducts = await scrapePayperCategory(page, cat.url);

        // Conversion anglais -> français si possible
        const frenchCat = categoryMapping[cat.name] || cat.name;
        // ex. "shirts" => "Chemises", "polo-shirts" => "Polos"

        catProducts.forEach(p => {
            // On écrase la catégorie avec la version française
            p.categorie = frenchCat;
        });

        allProducts.push(...catProducts);
    }

    // Fermeture du navigateur
    await browser.close();

    console.log(`\n🌐 TOTAL global tous produits Payper : ${allProducts.length}`);

    // Insertion dans PostgreSQL
    const client = await pool.connect();
    try {
        // Vider la table avant insertion
        console.log("♻️  TRUNCATE TABLE produits_payper...");
        await client.query("TRUNCATE TABLE produits_payper RESTART IDENTITY");

        // Insert
        for (const prod of allProducts) {
            const query = `
                INSERT INTO produits_payper (categorie, nom, lien, image, reference, couleurs, marque)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (reference) DO NOTHING
        RETURNING *;
            `;
            const values = [
                prod.categorie,  // catégorie en français
                prod.nom,
                prod.lien,
                prod.image,
                prod.reference,
                prod.couleurs,
                prod.marque, // vide pour Payper
            ];

            const res = await client.query(query, values);
            if (res.rows.length > 0) {
                console.log(`✅ Inséré : ${res.rows[0].nom}`);
            }
        }

        console.log("✅ Insertion terminée (Payper).");
    } catch (err: any) {
        console.error("❌ Erreur lors de l'insertion :", err.message);
    } finally {
        client.release();
    }

    console.log("Fin du script Payper.");
})();
