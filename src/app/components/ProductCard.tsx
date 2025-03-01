// @ts-ignore
import { Product } from "puppeteer";

export default function ProductCard({ product }: { product: Product }) {
    return (
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition flex flex-col p-4">
            {/* Label indiquant la source */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                {product.source === "makito" ? "Makito" : "TopTex"}
            </p>

            {/* Image */}
            {product.image && (
                <img
                    src={product.image}
                    alt={product.nom}
                    className="h-48 w-full object-cover rounded mb-3"
                />
            )}

            {/* Titre et référence */}
            <h2 className="text-lg font-semibold text-gray-800">{product.nom}</h2>
            <p className="text-sm text-gray-500 mb-2">Ref: {product.reference}</p>

            {/* Affichage spécifique pour Makito : Couleurs */}
            {product.source === "makito" && product.couleurs?.length > 0 && (
                <p className="text-sm text-gray-500 mb-2">
                    Couleurs : {product.couleurs.join(", ")}
                </p>
            )}

            {/* Affichage spécifique pour TopTex */}
            {product.source === "toptex" && (
                <div className="text-sm text-gray-600 space-y-1 mb-2">
                    <p>Marque : {product.marque}</p>
                    <p>Prix : {product.prix}</p>
                    <p>Nb couleurs : {product.nb_couleurs ?? 0}</p>
                </div>
            )}
        </div>
    );
}
