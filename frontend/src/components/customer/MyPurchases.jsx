// The logged-in customer's own purchases.
import React, { useEffect, useState } from "react";
import { money } from "./customerUi";

function MyPurchases({ api }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api
      .get("/api/customers/purchases")
      .then((res) => setList(res.data.purchases || []))
      .catch((err) => setError(err.response?.data?.message || "Purchase load হয়নি।"));
  }, [api]);

  if (error) return <div className="customer-empty-state">{error}</div>;
  if (!list) return <div className="customer-loading">Loading...</div>;
  if (!list.length) return <div className="customer-empty-state">এখনো কোনো কেনাকাটা নেই।</div>;

  const now = new Date();
  const monthTotal = list
    .filter((s) => {
      const d = new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((a, s) => a + s.payable_amount, 0);

  return (
    <>
      <div className="cp-month-total">
        এই মাসে মোট খরচ: <strong>{money(monthTotal)}</strong>
      </div>

      <div className="cp-purchase-list">
        {list.map((s) => (
          <article key={s.id} className="cp-purchase" onClick={() => setOpen(open === s.id ? null : s.id)}>
            <div className="cp-purchase-top">
              <div>
                <strong>{s.store_name || "Store"}</strong>
                <small>{new Date(s.created_at).toLocaleString()} · Bill #{s.id}</small>
              </div>
              <div className="cp-purchase-amount">
                <strong>{money(s.payable_amount)}</strong>
                {s.points_earned > 0 && <small>+{s.points_earned} points</small>}
              </div>
            </div>

            {open === s.id && (
              <ul className="cp-purchase-items">
                {s.items.map((i, idx) => (
                  <li key={idx}>
                    <span>{i.name} × {i.quantity}</span>
                    <span>{money(i.price * i.quantity)}</span>
                  </li>
                ))}
                {s.points_discount > 0 && (
                  <li><span>Points discount</span><span>-{money(s.points_discount)}</span></li>
                )}
              </ul>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export default MyPurchases;