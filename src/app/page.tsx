"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import ProductCard from "@/app/components/ProductCard";

export default function Home() {
    const [products, setProducts] = useState<any[]>([]);

    // Filtres
    const [search, setSearch] = useState("");  // recherche texte => query
    const [brand, setBrand] = useState("all"); // "all", "makito", "toptex", "payper"
    const [color, setColor] = useState("");    // couleur

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // Récupération des produits
    const fetchProducts = async () => {
        try {
            // Construire l'URL avec tous les filtres
            const url = `/api/fetchProducts?brand=${encodeURIComponent(brand)}&color=${encodeURIComponent(color)}&query=${encodeURIComponent(search)}&page=${page}&limit=${limit}`;

            const res = await axios.get(url);
            setProducts(res.data);
        } catch (error) {
            console.error("Erreur lors de la récupération des produits:", error);
        }
    };

    // Debounce sur la recherche / brand / color => reset page
    useEffect(() => {
        setPage(1);
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, brand, color]);

    // Quand page ou limit changent, on fetch direct
    useEffect(() => {
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit]);

    // Navigation
    const handleNextPage = () => setPage((prev) => prev + 1);
    const handlePrevPage = () => setPage((prev) => Math.max(1, prev - 1));

    // Effacer la recherche
    const clearSearch = () => setSearch("");

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
            <header className="bg-[#ffa024] text-white py-8 shadow-lg">
                <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                    {/* Logo + Titre */}
                    <div className="flex items-center space-x-4">
                        <img
                            src="/idefixelogo.webp"
                            alt="Logo de l'entreprise"
                            className="h-10 object-contain"
                        />
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide">
                            Catalogue
                        </h1>
                    </div>

                    {/* Choix de la limite */}
                    <div className="flex items-center space-x-2">
                        <label htmlFor="limitSelect" className="text-sm font-medium">
                            Afficher :
                        </label>
                        <select
                            id="limitSelect"
                            className="bg-white text-[#ffa024] font-semibold py-2 px-3 rounded shadow focus:outline-none focus:ring-2 focus:ring-[#ffa024] transition"
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                        >
                            <option value={10}>10 / page</option>
                            <option value={20}>20 / page</option>
                            <option value={50}>50 / page</option>
                        </select>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Section filtres */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Champ de recherche */}
                    <div className="flex items-center">
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 p-3 border border-gray-300 rounded-l shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ffa024] transition"
                        />
                        {search && (
                            <button
                                onClick={clearSearch}
                                className="bg-gray-200 px-4 py-2 rounded-r shadow hover:bg-gray-300 transition text-sm"
                            >
                                Effacer
                            </button>
                        )}
                    </div>

                    {/* Sélecteur de marque */}
                    <div className="flex items-center">
                        <label htmlFor="brandSelect" className="text-sm font-medium w-24">
                            Marque :
                        </label>
                        <select
                            id="brandSelect"
                            className="flex-1 bg-white text-gray-700 font-semibold py-2 px-3 rounded shadow focus:outline-none focus:ring-2 focus:ring-[#ffa024] transition"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                        >
                            <option value="all">Toutes</option>
                            <option value="makito">Makito</option>
                            <option value="toptex">TopTex</option>
                            <option value="payper">Payper</option>
                        </select>
                    </div>

                    {/* Champ couleur (Makito / Payper)
                    <div className="flex items-center space-x-2">
                        <label htmlFor="colorInput" className="text-sm font-medium w-24">
                            Couleur :
                        </label>
                        <input
                            id="colorInput"
                            type="text"
                            placeholder="ex: Rouge"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="flex-1 p-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ffa024] transition"
                        />
                    </div>*/}
                </div>

                {/* Affichage des produits */}
                {products.length === 0 ? (
                    <p className="text-center text-gray-600">Aucun produit trouvé.</p>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {products.map((p, idx) => (
                            <li key={`${p.reference}-${idx}`}>
                                <ProductCard product={p} />
                            </li>
                        ))}
                    </ul>
                )}

                {/* Pagination */}
                <div className="mt-8 flex justify-center space-x-4">
                    <button
                        onClick={handlePrevPage}
                        disabled={page <= 1}
                        className="bg-white border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-100 disabled:opacity-50 transition"
                    >
                        Page précédente
                    </button>
                    <button
                        onClick={handleNextPage}
                        className="bg-white border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-100 transition"
                    >
                        Page suivante
                    </button>
                </div>
            </div>
        </main>
    );
}
