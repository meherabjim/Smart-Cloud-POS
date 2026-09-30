// One store's products. The product the customer came from is shown first.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { money, normName, StockChip } from "./customerUi";

function StoreView({ api, storeId, highlight, onBack }) {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const hiRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setError("");
    api
      .get(`/api/customers/stores/${storeId}/products`)
      .then((res) => {
        if (!alive) return;
        setStore(res.data.store);
        setProducts(res.data.products || []);
      })
      .catch((err) => alive && setError(err.response?.data?.message || "Store load হয়নি।"));
    return () => { alive = false; };
  }, [api, storeId]);

  const list = useMemo(() => {
    const f = normName(filter);
    const h = normName(highlight);
    return products
      .filter((p) => !f || normName(p.name).includes(f) || normName(p.category).includes(f))
      .sort((a, b) => (normName(b.name) === h) - (normName(a.name) === h));
  }, [products, filter, highlight]);

  useEffect(() => {
    if (hiRef.current) hiRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [list]);

  return (
    <section className="customer-section">
      <div className="customer-section-head">
        <div>
          <button type="button" className="cp-link-btn" onClick={onBack}>← Back</button>
          <h2>{store ? store.name : "Store"}</h2>
          <p>{store?.location || ""}{store ? ` · ${store.in_stock_products} products in stock` : ""}</p>
        </div>
        <input
          className="cp-search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="এই store-এ খুঁজুন..."
        />
      </div>

      {error && <div className="customer-empty-state">{error}</div>}
      {!error && !list.length && <div className="customer-empty-state">কোনো product পাওয়া যায়নি।</div>}

      <div className="customer-product-grid">
        {list.map((p) => {
          const isHi = highlight && normName(p.name) === normName(highlight);
          return (
            <article
              key={p.product_id}
              ref={isHi ? hiRef : null}
              className={`customer-product-card ${isHi ? "cp-highlight" : ""}`}
            >
              <div className="customer-product-card-top">
                <span>{p.category}</span>
                {p.discount_percent > 0 && <strong>{p.discount_percent}% OFF</strong>}
              </div>
              <h3>{p.name}</h3>
              <div className="customer-product-price">
                <strong>{money(p.final_price)}</strong>
                {p.discount_percent > 0 && <del>{money(p.price)}</del>}
              </div>
              <StockChip status={p.stock_status} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default StoreView;