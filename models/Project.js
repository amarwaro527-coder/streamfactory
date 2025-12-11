const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

class Project {
    /**
     * Create a new project
     */
    static create(projectData) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            const {
                user_id,
                name,
                type = 'audio_video',
                audio_preset,
                audio_config,
                audio_duration,
                video_source_ids,
                video_loop_type,
                metadata
            } = projectData;

            const sql = `
        INSERT INTO projects (
          user_id, name, type, status,
          audio_preset, audio_config, audio_duration,
          video_source_ids, video_loop_type,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const params = [
                user_id,
                name,
                type,
                'draft',
                audio_preset,
                audio_config ? JSON.stringify(audio_config) : null,
                audio_duration,
                video_source_ids ? JSON.stringify(video_source_ids) : null,
                video_loop_type,
                metadata ? JSON.stringify(metadata) : null
            ];

            db.run(sql, params, function (err) {
                db.close();

                if (err) {
                    return reject(err);
                }

                resolve({ id: this.lastID, ...projectData });
            });
        });
    }

    /**
     * Find project by ID
     */
    static findById(projectId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
                db.close();

                if (err) {
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                // Parse JSON fields
                if (row.audio_config) {
                    row.audio_config = JSON.parse(row.audio_config);
                }
                if (row.video_source_ids) {
                    row.video_source_ids = JSON.parse(row.video_source_ids);
                }
                if (row.metadata) {
                    row.metadata = JSON.parse(row.metadata);
                }

                resolve(row);
            });
        });
    }

    /**
     * Find all projects by user
     */
    static findByUserId(userId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all(
                'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    db.close();

                    if (err) {
                        return reject(err);
                    }

                    // Parse JSON fields
                    const projects = rows.map(row => {
                        if (row.audio_config) row.audio_config = JSON.parse(row.audio_config);
                        if (row.video_source_ids) row.video_source_ids = JSON.parse(row.video_source_ids);
                        if (row.metadata) row.metadata = JSON.parse(row.metadata);
                        return row;
                    });

                    resolve(projects);
                }
            );
        });
    }

    /**
     * Update project
     */
    static update(projectId, updates) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            const fields = [];
            const params = [];

            // Build dynamic SQL
            for (const [key, value] of Object.entries(updates)) {
                if (['audio_config', 'video_source_ids', 'metadata'].includes(key) && typeof value === 'object') {
                    fields.push(`${key} = ?`);
                    params.push(JSON.stringify(value));
                } else {
                    fields.push(`${key} = ?`);
                    params.push(value);
                }
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            params.push(projectId);

            const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;

            db.run(sql, params, function (err) {
                db.close();

                if (err) {
                    return reject(err);
                }

                resolve({ id: projectId, changes: this.changes });
            });
        });
    }

    /**
     * Delete project
     */
    static delete(projectId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.run('DELETE FROM projects WHERE id = ?', [projectId], function (err) {
                db.close();

                if (err) {
                    return reject(err);
                }

                resolve({ deleted: this.changes > 0 });
            });
        });
    }

    /**
     * Get all projects (admin)
     */
    static findAll() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
                db.close();

                if (err) {
                    return reject(err);
                }

                const projects = rows.map(row => {
                    if (row.audio_config) row.audio_config = JSON.parse(row.audio_config);
                    if (row.video_source_ids) row.video_source_ids = JSON.parse(row.video_source_ids);
                    if (row.metadata) row.metadata = JSON.parse(row.metadata);
                    return row;
                });

                resolve(projects);
            });
        });
    }
}

module.exports = Project;
