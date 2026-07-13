import React from "react";

function Receipt({ sale, onClose }) {

    if (!sale) return null;

    return (

        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999
            }}
        >

            <div
                id="receipt-print"
                style={{
                    width: "320px",
                    background: "#fff",
                    padding: "15px",
                    fontFamily: "monospace",
                    fontSize: "14px"
                }}
            >

                <div style={{ textAlign: "center" }}>

                    <h2 style={{ margin: 0 }}>
                        My POS Store
                    </h2>

                    <p style={{ margin: "5px 0" }}>
                        Dhaka, Bangladesh
                    </p>

                    <hr />

                </div>
                                <div>

                    <p>
                        <strong>Invoice :</strong> #{sale.sale_id}
                    </p>

                    <p>
                        <strong>Date :</strong> {sale.date}
                    </p>

                   <p>
    <strong>Phone :</strong> {sale.customer_phone || "N/A"}
</p>

                    <hr />

                    <table
                        style={{
                            width: "100%",
                            fontSize: "13px"
                        }}
                    >

                        <thead>

                            <tr>

                                <th align="left">
                                    Item
                                </th>

                                <th>
                                    Qty
                                </th>

                                <th align="right">
                                    Total
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            {sale.items.map((item, index) => (

                                <tr key={index}>

                                    <td>
                                        {item.name}
                                    </td>

                                    <td align="center">
                                        {item.quantity}
                                    </td>

                                    <td align="right">
                                        à§³{(
                                            item.quantity *
                                            item.selling_price
                                        ).toFixed(2)}
                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                    <hr />
                                        <div
                        style={{
                            marginTop: "10px"
                        }}
                    >

                        <p>
                            <strong>Subtotal :</strong>
                            <span style={{ float: "right" }}>
                                à§³{sale.subtotal.toFixed(2)}
                            </span>
                        </p>

                        <p>
    <strong>
        Discount ({sale.discountPercent || 0}%):
    </strong>

    <span style={{ float: "right" }}>
        -à§³{sale.discount.toFixed(2)}
    </span>
</p>

                       <p>
    <strong>
        Tax ({sale.taxPercent || 0}%):
    </strong>

    <span style={{ float: "right" }}>
        +à§³{sale.tax.toFixed(2)}
    </span>
</p>

                        <hr />

                        <h3>

                            Total

                            <span style={{ float: "right" }}>
                                à§³{sale.total.toFixed(2)}
                            </span>

                        </h3>

                        <p>
                            Received
                            <span style={{ float: "right" }}>
                                à§³{sale.received.toFixed(2)}
                            </span>
                        </p>

                        <p>
                            Change
                            <span style={{ float: "right" }}>
                                à§³{sale.change.toFixed(2)}
                            </span>
                        </p>

                        <hr />

                        <div
                            style={{
                                textAlign: "center"
                            }}
                        >

                            <p>
                                â¤ï¸ Thank You â¤ï¸
                            </p>

                            <p>
                                Please Visit Again
                            </p>

                        </div>

                        <button
                            onClick={() => window.print()}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginTop: "10px",
                                background: "#16a34a",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer"
                            }}
                        >
                            ðŸ–¨ Print Receipt
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginTop: "10px",
                                background: "#dc2626",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer"
                            }}
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default Receipt;

