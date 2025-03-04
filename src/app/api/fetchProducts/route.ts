import { NextResponse } from "next/server";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Paramètres
    const query = searchParams.get("query") || "";       // recherche texte
    const brand = searchParams.get("brand") || "all";    // "all", "makito", "toptex", "payper"
    const color = searchParams.get("color") || "";       // couleur
    const pageParam = searchParams.get("page") || "1";
    const limitParam = searchParams.get("limit") || "20";

    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
        // On va concaténer nos résultats ici
        let combined: any[] = [];

        // ------------------------------------------------------------------
        // 1) MAKITO
        // ------------------------------------------------------------------
        if (brand === "all" || brand === "makito") {
            let whereClauses: string[] = [];
            let params: any[] = [];

            // Filtre texte
            if (query) {
                params.push(`%${query}%`);
                whereClauses.push(`nom ILIKE $${params.length}`);
            }

            // Filtre couleur (text[] => couleurs && '{Rouge}'::text[])
            if (color) {
                params.push(`{${color}}`);
                whereClauses.push(`couleurs && $${params.length}::text[]`);
            }

            let whereSQL = "";
            if (whereClauses.length > 0) {
                whereSQL = "WHERE " + whereClauses.join(" AND ");
            }

            // Ajout limit/offset
            params.push(limit, offset);

            const makitoSQL = `
                SELECT
                    'makito' AS source,
                    nom,
                    NULL AS lien,
                    image,
                    reference,
                    couleurs,
                    NULL AS marque,
                    NULL AS categorie,
                    NULL AS nb_couleurs,
                    NULL AS prix
                FROM produits
                         ${whereSQL}
                ORDER BY nom
                    LIMIT $${params.length - 1}
                OFFSET $${params.length}
            `;

            const resMakito = await client.query(makitoSQL, params);
            combined.push(...resMakito.rows);
        }

        // ------------------------------------------------------------------
        // 2) TOPTEX
        // ------------------------------------------------------------------
        if (brand === "all" || brand === "toptex") {
            // TopTex n'a pas de couleur, on ignore color
            let whereClauses: string[] = [];
            let params: any[] = [];

            // Filtre texte
            if (query) {
                params.push(`%${query}%`);
                whereClauses.push(`nom ILIKE $${params.length}`);
            }

            let whereSQL = "";
            if (whereClauses.length > 0) {
                whereSQL = "WHERE " + whereClauses.join(" AND ");
            }

            params.push(limit, offset);

            const toptexSQL = `
                SELECT
                    'toptex' AS source,
                    nom,
                    image,
                    reference,
                    NULL AS lien,
                    NULL AS couleurs,
                    marque,
                    categorie,
                    nb_couleurs,
                    prix
                FROM produits_toptex
                         ${whereSQL}
                ORDER BY nom
                    LIMIT $${params.length - 1}
                OFFSET $${params.length}
            `;

            const resToptex = await client.query(toptexSQL, params);
            combined.push(...resToptex.rows);
        }

        // ------------------------------------------------------------------
        // 3) PAYPER
        // ------------------------------------------------------------------
        if (brand === "all" || brand === "payper") {
            let whereClauses: string[] = [];
            let params: any[] = [];

            // Filtre texte => nom ILIKE ou categorie ILIKE
            if (query) {
                params.push(`%${query}%`);
                whereClauses.push(`(nom ILIKE $${params.length} OR categorie ILIKE $${params.length})`);
            }

            // Filtre couleur => "couleurs ILIKE '%color%'"
            if (color) {
                params.push(`%${color}%`);
                whereClauses.push(`couleurs ILIKE $${params.length}`);
            }

            let whereSQL = "";
            if (whereClauses.length > 0) {
                whereSQL = "WHERE " + whereClauses.join(" AND ");
            }

            params.push(limit, offset);

            const payperSQL = `
                SELECT
                    'payper' AS source,
                    nom,
                    lien,
                    image,
                    reference,
                    couleurs,
                    categorie,
                    marque
                FROM produits_payper
                         ${whereSQL}
                ORDER BY nom
                    LIMIT $${params.length - 1}
                OFFSET $${params.length}
            `;

            const resPayper = await client.query(payperSQL, params);
            combined.push(...resPayper.rows);
        }

        // On retourne la liste globale
        return NextResponse.json(combined);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
