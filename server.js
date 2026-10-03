require("dotenv").config();

const express = require("express");
const multer = require("multer");
const { Client } = require("pg");

const app = express();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  try {
    const result = await client.query(`
      SELECT id, type, title, url, filename, mimetype, size, created_at
      FROM items
      ORDER BY created_at DESC
    `);

    res.render("index", {
      items: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Database error");
  }
});

app.post("/links", async (req, res) => {
  const { title, url } = req.body;

  if (!url) {
    return res.status(400).send("URL is required");
  }

  try {
    await client.query(
      `INSERT INTO items (type, title, url)
       VALUES ('link', $1, $2)`,
      [title || null, url]
    );

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not save link");
  }
});

app.post("/files", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("File is required");
  }

  try {
    await client.query(
      `INSERT INTO items
       (type, filename, mimetype, size, data)
       VALUES ('file', $1, $2, $3, $4)`,
      [
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.buffer,
      ]
    );

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not save file");
  }
});

app.get("/files/:id", async (req, res) => {
  try {
    const result = await client.query(
      `SELECT filename, mimetype, data
       FROM items
       WHERE id = $1 AND type = 'file'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("File not found");
    }

    const { filename, mimetype, data } = result.rows[0];

    res.setHeader("Content-Type", mimetype);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/"/g, "")}"`
    );

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not download file");
  }
});

app.post("/items/:id/delete", async (req, res) => {
  try {
    await client.query(
      "DELETE FROM items WHERE id = $1",
      [req.params.id]
    );

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not delete item");
  }
});
app.post("/videos", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("Video is required");
  }

  if (!req.file.mimetype.startsWith("video/")) {
    return res.status(400).send("Only video files are allowed");
  }

  try {
    await client.query(
      `INSERT INTO items
       (type, title, filename, mimetype, size, data)
       VALUES ('video', $1, $2, $3, $4, $5)`,
      [
        req.body.title || null,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.buffer,
      ]
    );

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not save video");
  }
});
app.get("/videos/:id", async (req, res) => {
  try {
    const result = await client.query(
      `SELECT filename, mimetype, data
       FROM items
       WHERE id = $1 AND type = 'video'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Video not found");
    }

    const { filename, mimetype, data } = result.rows[0];

    res.setHeader("Content-Type", mimetype);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename.replace(/"/g, "")}"`
    );

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not load video");
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});