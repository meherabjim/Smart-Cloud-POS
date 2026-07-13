import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Invoice.css";

function Invoice({ saleId, onClose }) {
  const [sale, setSale] = useState(null);

  useEffect(() => {
    loadInvoice();
  }, []);

  const loadInvoice = async () => {
    try {
      const res = await axios.get(`https://smart-cloud-pos.onrender.com/api/sales/${saleId}`);
      setSale(res.data);
    } catch (err) {
      alert("Invoice Load Failed");
    }
  };

  const formatMoney = (amount) => `à§³ ${Number(amount || 0).toFixed(2)}`;

  if (!sale) {
    return (
      <div className="invoice-loading-wrap">
        <div className="invoice-loading-card">
          <div className="invoice-spinner"></div>
          <h3>Loading invoice...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-page">
      <div className="invoice-card">
        <div className="invoice-top">
          <div>
            <p className="invoice-eyebrow">Sales receipt</p>
            <h1 className="invoice-brand">Cloud POS</h1>
            <p className="invoice-tagline">Fast, clean, and reliable billing</p>
          </div>

          <div className="invoice-number-box">
            <span className="invoice-number-label">Invoice</span>
            <h2>#{sale.id}</h2>
          </div>
        </div>

        <div className="invoice-meta-grid">
          <div className="invoice-meta-card">
            <span className="meta-label">Customer</span>
            <strong>{sale.customer_phone || "-"}</strong>
          </div>

          <div className="invoice-meta-card">
            <span className="meta-label">Date</span>
            <strong>{new Date(sale.created_at).toLocaleString()}</strong>
          </div>

          <div className="invoice-meta-card">
            <span className="meta-label">Payment</span>
            <strong>{sale.payment_method || "Cash"}</strong>
          </div>
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>

            <tbody>
              {sale.items?.map((item) => (
                <tr key={item.id}>
                  <td data-label="Product" className="invoice-product-name">
                    {item.name}
                  </td>
                  <td data-label="Qty" className="text-center">
                    {item.quantity}
                  </td>
                  <td data-label="Price" className="text-right">
                    {formatMoney(item.price)}
                  </td>
                  <td data-label="Subtotal" className="text-right invoice-strong">
                    {formatMoney(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-bottom">
          <div className="invoice-note-box">
            <h3>Notes</h3>
            <p>Thank you for your purchase. Please keep this invoice for your records.</p>
          </div>

          <div className="invoice-summary">
            <div className="invoice-summary-row">
              <span>Total</span>
              <strong>{formatMoney(sale.total_amount)}</strong>
            </div>

            <div className="invoice-summary-row">
              <span>Discount</span>
              <strong>{formatMoney(sale.discount)}</strong>
            </div>

            <div className="invoice-summary-row">
              <span>Tax</span>
              <strong>{formatMoney(sale.tax)}</strong>
            </div>

            <div className="invoice-summary-row payable">
              <span>Payable</span>
              <strong>{formatMoney(sale.payable_amount)}</strong>
            </div>
          </div>
        </div>

        <div className="invoice-actions no-print">
          <button className="invoice-btn print" onClick={() => window.print()}>
            Print
          </button>

          <button className="invoice-btn close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default Invoice;

