// Small shared bits for the customer side.
import React from "react";

export const money = (v) => `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export const normName = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

const STOCK = {
  in: ["In stock", "cp-stock-in"],
  low: ["অল্প আছে", "cp-stock-low"],
  out: ["Out of stock", "cp-stock-out"],
};

export function StockChip({ status }) {
  const [label, cls] = STOCK[status] || STOCK.out;
  return <span className={`cp-stock ${cls}`}>{label}</span>;
}