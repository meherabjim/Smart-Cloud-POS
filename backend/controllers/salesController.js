const db = require("../config/db");

// ================================
// Get All Sales (store-wise + phone search)
// ================================
exports.getSales = async (req, res) => {
    try {
        const { phone, store_id } = req.query;

        let sql = `SELECT * FROM sales WHERE 1=1`;
        let params = [];

        if (store_id) {
            sql += ` AND store_id = ?`;
            params.push(store_id);
        }

        if (phone) {
            sql += ` AND customer_phone LIKE ?`;
            params.push(`%${phone}%`);
        }

        sql += ` ORDER BY id DESC`;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================================
// Get Single Sale Details
// ================================
exports.getSaleDetails = async (req, res) => {
    try {
        const saleId = parseInt(req.params.id);

        const [sales] = await db.query(
            "SELECT * FROM sales WHERE id = ?",
            [saleId]
        );

        if (sales.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found"
            });
        }

        const [items] = await db.query(
            `
            SELECT
                si.id,
                si.sale_id,
                si.product_id,
                si.quantity,
                si.price,
                p.name
            FROM sale_items si
            LEFT JOIN products p
                ON p.id = si.product_id
            WHERE si.sale_id = ?
            `,
            [saleId]
        );

        res.status(200).json({
            success: true,
            sale: sales[0],
            items: items
        });

    } catch (error) {
        console.error("Get Sale Details Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================================
// Checkout Sale (store-wise, connection-leak fixed)
// ================================
exports.checkout = async (req, res) => {

    const {
        items,
        store_id,
        customer_phone,
        total_amount,
        discount,
        tax,
        payable_amount,
        payment_method
    } = req.body;

    // ✅ connection newar AGE-i validate kora — leak prevent korte
    if (!items || items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
    }
    if (!store_id) {
        return res.status(400).json({ message: "store_id is required" });
    }

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        // ==========================
        // Save Main Sale (store_id shoho)
        // ==========================

        const [saleResult] = await connection.query(
            `
            INSERT INTO sales
            (
                store_id,
                customer_phone,
                total_amount,
                discount,
                tax,
                payable_amount,
                payment_method
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                store_id,
                customer_phone || null,
                total_amount,
                discount || 0,
                tax || 0,
                payable_amount,
                payment_method
            ]
        );

        const saleId = saleResult.insertId;

        // ==========================
        // Save Items + Stock Update
        // ==========================

        for (const item of items) {

            const [productRows] = await connection.query(
                `SELECT stock, store_id FROM products WHERE id=?`,
                [item.id]
            );

            if (productRows.length === 0) {
                throw new Error(`${item.name} not found`);
            }

            // ✅ Product অন্য store-এর হলে checkout আটকে দেওয়া হচ্ছে —
            // এটা ছাড়া ভুল store-এর product কার্টে ঢুকে গেলেও sale এবং
            // inventory_history আলাদা store-এ record হয়ে data mismatch হতো।
            if (Number(productRows[0].store_id) !== Number(store_id)) {
                throw new Error(
                    `${item.name} does not belong to store #${store_id} (it belongs to store #${productRows[0].store_id})`
                );
            }

            const currentStock = Number(productRows[0].stock);

            if (currentStock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.name}`);
            }

            // Insert Sale Items
            await connection.query(
                `
                INSERT INTO sale_items
                (sale_id, product_id, quantity, price)
                VALUES (?, ?, ?, ?)
                `,
                [saleId, item.id, item.quantity, item.selling_price]
            );

            // Stock Minus
            await connection.query(
                `UPDATE products SET stock = stock - ? WHERE id=?`,
                [item.quantity, item.id]
            );

            // Inventory History
            await connection.query(
                `
                INSERT INTO inventory_history
                (store_id, product_id, type, qty)
                VALUES (?, ?, ?, ?)
                `,
                [productRows[0].store_id, item.id, "OUT", item.quantity]
            );
        }

        // ==========================
        // Commit
        // ==========================

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Sale Completed Successfully",
            sale_id: saleId,
            total_amount,
            discount,
            tax,
            payable_amount,
            payment_method
        });

    } catch (error) {

        await connection.rollback();
        console.log("CHECKOUT ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {

        connection.release();

    }
};