const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

class AudioStem {
    /**
     * Get all audio stems
     */
    static getAll() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT * FROM audio_stems ORDER BY category, name', (err, rows) => {
                db.close();
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    /**
     * Get stems by category
     */
    static getByCategory(category) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT * FROM audio_stems WHERE category = ? ORDER BY name', [category], (err, rows) => {
                db.close();
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    /**
     * Get all categories
     */
    static getCategories() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT DISTINCT category FROM audio_stems ORDER BY category', (err, rows) => {
                db.close();
                if (err) return reject(err);
                resolve(rows.map(r => r.category));
            });
        });
    }

    /**
     * Get stem by ID
     */
    static getById(id) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.get('SELECT * FROM audio_stems WHERE id = ?', [id], (err, row) => {
                db.close();
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    /**
     * Create new audio stem
     */
    static create(data) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            const { name, category, file_path, duration, default_volume = 0.7 } = data;

            const sql = `
        INSERT INTO audio_stems (name, category, file_path, duration, default_volume)
        VALUES (?, ?, ?, ?, ?)
      `;

            db.run(sql, [name, category, file_path, duration, default_volume], function (err) {
                db.close();
                if (err) return reject(err);
                resolve({ id: this.lastID, ...data });
            });
        });
    }

    /**
     * Update audio stem
     */
    static update(id, data) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            const fields = [];
            const params = [];

            for (const [key, value] of Object.entries(data)) {
                fields.push(`${key} = ?`);
                params.push(value);
            }

            params.push(id);

            const sql = `UPDATE audio_stems SET ${fields.join(', ')} WHERE id = ?`;

            db.run(sql, params, function (err) {
                db.close();
                if (err) return reject(err);
                resolve({ id, changes: this.changes });
            });
        });
    }

    /**
     * Delete audio stem
     */
    static delete(id) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.run('DELETE FROM audio_stems WHERE id = ?', [id], function (err) {
                db.close();
                if (err) return reject(err);
                resolve({ deleted: this.changes > 0 });
            });
        });
    }
}

class AudioPreset {
    /**
     * Get all presets
     */
    static getAll() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT * FROM audio_presets ORDER BY created_at DESC', (err, rows) => {
                db.close();
                if (err) return reject(err);

                const presets = rows.map(row => ({
                    ...row,
                    stem_configs: JSON.parse(row.stem_configs)
                }));

                resolve(presets);
            });
        });
    }

    /**
     * Get preset by ID
     */
    static getById(id) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.get('SELECT * FROM audio_presets WHERE id = ?', [id], (err, row) => {
                db.close();
                if (err) return reject(err);

                if (row) {
                    row.stem_configs = JSON.parse(row.stem_configs);
                }

                resolve(row);
            });
        });
    }

    /**
     * Create new preset
     */
    static create(data) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            const { name, description, stem_configs } = data;

            const sql = `
        INSERT INTO audio_presets (name, description, stem_configs)
        VALUES (?, ?, ?)
      `;

            db.run(sql, [name, description, JSON.stringify(stem_configs)], function (err) {
                db.close();
                if (err) return reject(err);
                resolve({ id: this.lastID, ...data });
            });
        });
    }

    /**
     * Update preset
     */
    static update(id, data) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            const fields = [];
            const params = [];

            for (const [key, value] of Object.entries(data)) {
                if (key === 'stem_configs') {
                    fields.push(`${key} = ?`);
                    params.push(JSON.stringify(value));
                } else {
                    fields.push(`${key} = ?`);
                    params.push(value);
                }
            }

            params.push(id);

            const sql = `UPDATE audio_presets SET ${fields.join(', ')} WHERE id = ?`;

            db.run(sql, params, function (err) {
                db.close();
                if (err) return reject(err);
                resolve({ id, changes: this.changes });
            });
        });
    }

    /**
     * Delete preset
     */
    static delete(id) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.run('DELETE FROM audio_presets WHERE id = ?', [id], function (err) {
                db.close();
                if (err) return reject(err);
                resolve({ deleted: this.changes > 0 });
            });
        });
    }
}

module.exports = {
    AudioStem,
    AudioPreset
};
