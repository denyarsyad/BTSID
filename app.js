const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

const db = mysql.createConnection({
  host: "host.docker.internal",
  user: "root",
  password: "",
  database: "BTSID",
});

// db.connect((err) => {
//   if (err) {
//     console.error("Gagal koneksi ke MySQL:", err.message);
//     return;
//   }
//   console.log("Berhasil terhubung ke database MySQL.");
// });

//Nomor 1
app.get("/api/product", (req, res) => {
  db.query("SELECT * FROM products", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const formattedRows = rows.map((row) => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : [],
    }));
    res.json(formattedRows);
  });
});

//Nomor 2
app.post("/api/auth", async (req, res) => {
  const { username, password, password_confirmation } = req.body;

  if (!username || !password || !password_confirmation) {
    return res.status(400).json({ message: "Semua kolom harus diisi full!" });
  }

  if (password !== password_confirmation) {
    return res
      .status(400)
      .json({ message: "Password password tidak cocok ya, coba lage!!!!" });
  }

  try {
    db.query(
      "SELECT * FROM users WHERE username = ?",
      [username],
      async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        if (rows.length > 0) {
          return res.status(400).json({ message: "Username sudah digunakan!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        db.query(
          "INSERT INTO users (username, password) VALUES (?, ?)",
          [username, hashedPassword],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.status(201).json({
              message: "User berhasil didaftarkan!",
              data: {
                id: result.insertId,
                username: username,
              },
            });
          },
        );
      },
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Nomor 3
let productCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60000;

app.get("/api/products", (req, res) => {
  const { search, category, limit, page } = req.query;
  const isFiltered = search || category || limit || page;
  if (
    !isFiltered &&
    productCache &&
    Date.now() - cacheTimestamp < CACHE_DURATION
  ) {
    console.log("test1");
    return res.json(productCache);
  }

  let sql = "SELECT * FROM products WHERE 1=1";
  let sqlParams = [];

  if (search) {
    sql += " AND title LIKE ?";
    sqlParams.push(`%${search}%`);
  }

  if (category) {
    sql += " AND category = ?";
    sqlParams.push(category);
  }

  let limitValue = parseInt(limit) || 10;
  let pageValue = parseInt(page) || 1;

  let offsetValue = (pageValue - 1) * limitValue;

  sql += " LIMIT ? OFFSET ?";
  sqlParams.push(limitValue, offsetValue);

  db.query(sql, sqlParams, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const formattedRows = rows.map((row) => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : [],
    }));

    if (!isFiltered) {
      productCache = formattedRows;
      cacheTimestamp = Date.now();
      console.log("testt");
    }
    res.json(formattedRows);
  });
});

//nNomor 4
app.get("/api/product/:id", (req, res) => {
  const productId = req.params.id;

  db.query("SELECT * FROM products WHERE id = ?", [productId], (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: "error",
        message: "Oops ada kesalahan di server yak!",
        error: err.message,
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        status: "Gagal",
        message: `Produk dengan ID ${productId} tidak ditemukan.`,
      });
    }
    const row = rows[0];
    row.images = row.images ? JSON.parse(row.images) : [];
    res.json(row);
  });
});

//nomor 5
const checkAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const secret = "Bearer Kunci_Rahasia_INput";

  if (!authHeader || authHeader !== secret) {
    return res.status(401).json({
      status: "error",
      message: "Akses ditolak!",
    });
  }
  next();
};

app.post("/api/product", checkAuth, (req, res) => {
  const { title, price, description, category, images } = req.body;

  //validasinya
  if (!title || !price || !category || !images) {
    return res.status(400).json({
      status: "Gagal",
      message: "Kolom title, price, category, dan images wajib diisi.",
    });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({
      status: "Gagal",
      message: "Kolom images harus minimal berisi 1 gambar.",
    });
  }

  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const query = `INSERT INTO products 
    (title, price, description, category, images, created_at, created_by, created_by_id, updated_at, updated_by, updated_by_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const stringifiedImages = JSON.stringify(images);
  const values = [
    title,
    price,
    description || "",
    category,
    stringifiedImages,
    now,
    "Jhon Doe",
    "1",
    now,
    "Jhon Doe",
    "1",
  ];

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      id: result.insertId,
      title,
      price: parseFloat(price),
      description: description || "",
      category,
      images,
      created_at: now,
      created_by: "Jhon Doe",
      created_by_id: "1",
      updated_at: now,
      updated_by: "Jhon Doe",
      updated_by_id: "1",
    });
  });
});

//nomor 6
app.put("/api/product/:id", (req, res) => {
  const productId = req.params.id;
  const { title, price, description, category, images } = req.body;

  db.query("SELECT * FROM products WHERE id = ?", [productId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (rows.length === 0) {
      return res.status(404).json({
        status: "Gagal",
        message: `ID ${productId} tidak ditemukan.`,
      });
    }

    const currentProduct = rows[0];
    const updatedTitle = title || currentProduct.title;
    const updatedPrice = price || currentProduct.price;
    const updatedDescription =
      description !== undefined ? description : currentProduct.description;
    const updatedCategory = category || currentProduct.category;

    let updatedImages = currentProduct.images;
    if (images) {
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          status: "Gagal",
          message: "Image harus 1 gambar.",
        });
      }
      updatedImages = JSON.stringify(images);
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const queryUpdate = `UPDATE products SET 
            title = ?, price = ?, description = ?, category = ?, images = ?, 
            updated_at = ?, updated_by = ?, updated_by_id = ? 
            WHERE id = ?`;

    const values = [
      updatedTitle,
      updatedPrice,
      updatedDescription,
      updatedCategory,
      updatedImages,
      now,
      "Jhon Doe",
      "1",
      productId,
    ];

    db.query(queryUpdate, values, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        status: "Sukses",
        message: "Berhasil Updte.",
        data: {
          id: parseInt(productId),
          title: updatedTitle,
          price: parseFloat(updatedPrice),
          description: updatedDescription,
          category: updatedCategory,
          images: JSON.parse(updatedImages),
          updated_at: now,
          updated_by: "Jhon Doe",
          updated_by_id: "1",
        },
      });
    });
  });
});

//nomor 7
app.delete("/api/product/:id", (req, res) => {
  const productId = req.params.id;

  db.query("SELECT * FROM products WHERE id = ?", [productId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) {
      return res.status(404).json({
        status: "Gagal",
        message: `ID ${productId} tidak ditemukan.`,
      });
    }
    db.query(
      "DELETE FROM products WHERE id = ?",
      [productId],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          status: "Sukses",
          message: `Berhasil deleted`,
        });
      },
    );
  });
});

//RETSU GOOWWW
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
