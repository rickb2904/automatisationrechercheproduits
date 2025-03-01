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

    // 1) Récupération des paramètres de recherche et de pagination
    const query = searchParams.get("query") || "";
    const pageParam = searchParams.get("page") || "1";
    const limitParam = searchParams.get("limit") || "20"; // On limite par défaut à 20

    // 2) Conversion en nombres
    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
        // -- Requête Makito --
        let makitoRows = [];
        if (query) {
            const resMakito = await client.query(
                `SELECT
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
                 WHERE nom ILIKE $1
                 ORDER BY nom
                     LIMIT $2
                 OFFSET $3
                `,
                [`%${query}%`, limit, offset]
            );
            makitoRows = resMakito.rows;
        } else {
            const resMakito = await client.query(
                `SELECT
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
                 ORDER BY nom
                     LIMIT $1
                 OFFSET $2
                `,
                [limit, offset]
            );
            makitoRows = resMakito.rows;
        }

        // -- Requête TopTex --
        let toptexRows = [];
        if (query) {
            const resToptex = await client.query(
                `SELECT
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
                 WHERE nom ILIKE $1
                 ORDER BY nom
                     LIMIT $2
                 OFFSET $3
                `,
                [`%${query}%`, limit, offset]
            );
            toptexRows = resToptex.rows;
        } else {
            const resToptex = await client.query(
                `SELECT
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
                 ORDER BY nom
                     LIMIT $1
                 OFFSET $2
                `,
                [limit, offset]
            );
            toptexRows = resToptex.rows;
        }

        // -- Concaténer les deux tableaux
        const combined = [...makitoRows, ...toptexRows];

        // -- Retourner la liste
        return NextResponse.json(combined);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
