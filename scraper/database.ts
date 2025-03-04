import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
});



export async function saveToDatabase(products: any[]) {
    const client = await pool.connect();
    try {
        console.log("📦 Produits à insérer dans PostgreSQL :", JSON.stringify(products, null, 2));  // Log complet

        for (const product of products) {
            const result = await client.query(
                `INSERT INTO produits (nom, lien, image, reference, couleurs)
                 VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (reference) DO UPDATE SET
                    nom = EXCLUDED.nom,
                                                    image = EXCLUDED.image,
                                                    couleurs = EXCLUDED.couleurs
                                                    RETURNING *;`,  // Retourne les données insérées
                [product.nom, product.lien, product.image, product.reference, product.couleurs]
            );

            console.log("📝 Inserté :", result.rows);  // Vérifie ce qui est vraiment inséré
        }
        console.log("✅ Produits enregistrés dans PostgreSQL !");
    } catch (err) {
        console.error("❌ Erreur lors de l’insertion :", err);
    } finally {
        client.release();
    }
}


