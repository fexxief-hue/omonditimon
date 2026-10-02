require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./db');

/*
=========================================================
LOS BLANCOS FC
FINAL DATABASE SETUP
=========================================================

This setup is designed to work with:
- Aiven MySQL
- Existing older Los Blancos FC databases
- Fresh databases

IMPORTANT:
We NEVER use:
ALTER TABLE ... ADD COLUMN IF NOT EXISTS

Instead:
1. Create missing tables.
2. Check every column.
3. Add only columns that are missing.
=========================================================
*/

const schemas = {

    users: {
        create: `
            CREATE TABLE IF NOT EXISTS users (
                id INT NOT NULL AUTO_INCREMENT,
                email VARCHAR(190) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(30) NOT NULL DEFAULT 'player',
                player_id INT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_users_email (email)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            email: 'VARCHAR(190) NULL',
            password_hash: 'VARCHAR(255) NULL',
            role: "VARCHAR(30) NULL DEFAULT 'player'",
            player_id: 'INT NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    },

    players: {
        create: `
            CREATE TABLE IF NOT EXISTS players (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NULL,
                full_name VARCHAR(190) NOT NULL,
                photo VARCHAR(500) NULL,
                jersey_number INT NULL,
                position VARCHAR(80) NULL,
                date_of_birth DATE NULL,
                preferred_foot VARCHAR(30) NULL,
                phone VARCHAR(50) NULL,
                bio TEXT NULL,
                team VARCHAR(150) NOT NULL DEFAULT 'Los Blancos FC',
                approval_status VARCHAR(30) NOT NULL DEFAULT 'approved',
                joined_at DATE NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            user_id: 'INT NULL',
            full_name: 'VARCHAR(190) NULL',
            photo: 'VARCHAR(500) NULL',
            jersey_number: 'INT NULL',
            position: 'VARCHAR(80) NULL',
            date_of_birth: 'DATE NULL',
            preferred_foot: 'VARCHAR(30) NULL',
            phone: 'VARCHAR(50) NULL',
            bio: 'TEXT NULL',
            team: "VARCHAR(150) NULL DEFAULT 'Los Blancos FC'",
            approval_status: "VARCHAR(30) NULL DEFAULT 'approved'",
            joined_at: 'DATE NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    },

    player_applications: {
        create: `
            CREATE TABLE IF NOT EXISTS player_applications (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NULL,
                email VARCHAR(190) NOT NULL,
                full_name VARCHAR(190) NOT NULL,
                photo VARCHAR(500) NULL,
                jersey_number INT NULL,
                position VARCHAR(80) NULL,
                date_of_birth DATE NULL,
                preferred_foot VARCHAR(30) NULL,
                phone VARCHAR(50) NULL,
                bio TEXT NULL,
                team VARCHAR(150) NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                reviewed_by INT NULL,
                reviewed_at DATETIME NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            user_id: 'INT NULL',
            email: 'VARCHAR(190) NULL',
            full_name: 'VARCHAR(190) NULL',
            photo: 'VARCHAR(500) NULL',
            jersey_number: 'INT NULL',
            position: 'VARCHAR(80) NULL',
            date_of_birth: 'DATE NULL',
            preferred_foot: 'VARCHAR(30) NULL',
            phone: 'VARCHAR(50) NULL',
            bio: 'TEXT NULL',
            team: "VARCHAR(150) NULL DEFAULT 'Los Blancos FC'",
            status: "VARCHAR(30) NULL DEFAULT 'pending'",
            reviewed_by: 'INT NULL',
            reviewed_at: 'DATETIME NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    },

    teams: {
        create: `
            CREATE TABLE IF NOT EXISTS teams (
                id INT NOT NULL AUTO_INCREMENT,
                team_name VARCHAR(190) NOT NULL,
                short_name VARCHAR(50) NULL,
                logo VARCHAR(500) NULL,
                home_city VARCHAR(120) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            team_name: 'VARCHAR(190) NULL',
            short_name: 'VARCHAR(50) NULL',
            logo: 'VARCHAR(500) NULL',
            home_city: 'VARCHAR(120) NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
        }
    },

    matches: {
        create: `
            CREATE TABLE IF NOT EXISTS matches (
                id INT NOT NULL AUTO_INCREMENT,
                opponent_id INT NULL,
                competition VARCHAR(120) NULL,
                match_date DATE NULL,
                match_time TIME NULL,
                venue VARCHAR(190) NULL,
                home_score INT NULL,
                away_score INT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
                headline VARCHAR(255) NULL,
                notes TEXT NULL,
                hero_background VARCHAR(500) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            opponent_id: 'INT NULL',
            competition: 'VARCHAR(120) NULL',
            match_date: 'DATE NULL',
            match_time: 'TIME NULL',
            venue: 'VARCHAR(190) NULL',
            home_score: 'INT NULL',
            away_score: 'INT NULL',
            status: "VARCHAR(30) NULL DEFAULT 'scheduled'",
            headline: 'VARCHAR(255) NULL',
            notes: 'TEXT NULL',
            hero_background: 'VARCHAR(500) NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    },

    match_lineups: {
        create: `
            CREATE TABLE IF NOT EXISTS match_lineups (
                id INT NOT NULL AUTO_INCREMENT,
                match_id INT NOT NULL,
                player_id INT NOT NULL,
                position VARCHAR(50) NULL,
                is_starter TINYINT(1) NOT NULL DEFAULT 1,
                shirt_number INT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_match_player (match_id, player_id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            match_id: 'INT NULL',
            player_id: 'INT NULL',
            position: 'VARCHAR(50) NULL',
            is_starter: 'TINYINT(1) NULL DEFAULT 1',
            shirt_number: 'INT NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
        }
    },

    player_match_stats: {
        create: `
            CREATE TABLE IF NOT EXISTS player_match_stats (
                id INT NOT NULL AUTO_INCREMENT,
                match_id INT NOT NULL,
                player_id INT NOT NULL,
                appearances INT NOT NULL DEFAULT 0,
                minutes INT NOT NULL DEFAULT 0,
                goals INT NOT NULL DEFAULT 0,
                assists INT NOT NULL DEFAULT 0,
                yellow_cards INT NOT NULL DEFAULT 0,
                red_cards INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_stats_match_player (match_id, player_id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            match_id: 'INT NULL',
            player_id: 'INT NULL',
            appearances: 'INT NULL DEFAULT 0',
            minutes: 'INT NULL DEFAULT 0',
            goals: 'INT NULL DEFAULT 0',
            assists: 'INT NULL DEFAULT 0',
            yellow_cards: 'INT NULL DEFAULT 0',
            red_cards: 'INT NULL DEFAULT 0',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    },

    news: {
        create: `
            CREATE TABLE IF NOT EXISTS news (
                id INT NOT NULL AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                excerpt TEXT NULL,
                body MEDIUMTEXT NULL,
                image VARCHAR(500) NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'draft',
                published_at DATETIME NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            title: 'VARCHAR(255) NULL',
            excerpt: 'TEXT NULL',
            body: 'MEDIUMTEXT NULL',
            image: 'VARCHAR(500) NULL',
            status: "VARCHAR(30) NULL DEFAULT 'draft'",
            published_at: 'DATETIME NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    },

    media: {
        create: `
            CREATE TABLE IF NOT EXISTS media (
                id INT NOT NULL AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                media_type VARCHAR(50) NOT NULL DEFAULT 'gallery',
                match_id INT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            title: 'VARCHAR(255) NULL',
            file_path: 'VARCHAR(500) NULL',
            media_type: "VARCHAR(50) NULL DEFAULT 'gallery'",
            match_id: 'INT NULL',
            is_active: 'TINYINT(1) NULL DEFAULT 0',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
        }
    },

    notifications: {
        create: `
            CREATE TABLE IF NOT EXISTS notifications (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                type VARCHAR(80) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                link VARCHAR(255) NULL,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            user_id: 'INT NULL',
            type: 'VARCHAR(80) NULL',
            title: 'VARCHAR(255) NULL',
            message: 'TEXT NULL',
            link: 'VARCHAR(255) NULL',
            is_read: 'TINYINT(1) NULL DEFAULT 0',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
        }
    },

    contributions: {
        create: `
            CREATE TABLE IF NOT EXISTS contributions (
                id INT NOT NULL AUTO_INCREMENT,
                player_id INT NULL,
                contributor_name VARCHAR(190) NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                currency_code CHAR(3) NOT NULL DEFAULT 'KES',
                contribution_date DATE NOT NULL,
                note VARCHAR(500) NULL,
                recorded_by INT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_contributions_player_date (player_id, contribution_date),
                KEY idx_contributions_date (contribution_date)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            player_id: 'INT NULL',
            contributor_name: 'VARCHAR(190) NULL',
            amount: 'DECIMAL(12,2) NULL',
            currency_code: "CHAR(3) NULL DEFAULT 'KES'",
            contribution_date: 'DATE NULL',
            note: 'VARCHAR(500) NULL',
            recorded_by: 'INT NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
        }
    },

    audit_logs: {
        create: `
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NULL,
                action VARCHAR(120) NOT NULL,
                entity_type VARCHAR(80) NULL,
                entity_id INT NULL,
                details TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            id: 'INT NULL',
            user_id: 'INT NULL',
            action: 'VARCHAR(120) NULL',
            entity_type: 'VARCHAR(80) NULL',
            entity_id: 'INT NULL',
            details: 'TEXT NULL',
            created_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'
        }
    },

    site_settings: {
        create: `
            CREATE TABLE IF NOT EXISTS site_settings (
                setting_key VARCHAR(190) NOT NULL,
                setting_value TEXT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (setting_key)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
        `,

        columns: {
            setting_key: 'VARCHAR(190) NULL',
            setting_value: 'TEXT NULL',
            updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    }
};

/* =========================================================
   CHECK COLUMN
========================================================= */

async function columnExists(
    connection,
    tableName,
    columnName
) {

    const [rows] = await connection.query(
        `
        SHOW COLUMNS
        FROM \`${tableName}\`
        LIKE ?
        `,
        [columnName]
    );

    return rows.length > 0;
}

/* =========================================================
   ADD MISSING COLUMN
========================================================= */

async function ensureColumn(
    connection,
    tableName,
    columnName,
    definition
) {

    const exists =
        await columnExists(
            connection,
            tableName,
            columnName
        );

    if (exists) {

        console.log(
            `OK: ${tableName}.${columnName}`
        );

        return;
    }

    await connection.query(
        `
        ALTER TABLE \`${tableName}\`
        ADD COLUMN \`${columnName}\` ${definition}
        `
    );

    console.log(
        `ADDED: ${tableName}.${columnName}`
    );
}

/* =========================================================
   OWNER
========================================================= */

async function setupOwner(connection) {

    const email =
        String(
            process.env.OWNER_EMAIL || ''
        )
            .trim()
            .toLowerCase();

    const password =
        String(
            process.env.OWNER_PASSWORD || ''
        ).trim();

    if (!email || !password) {

        console.log(
            'Owner credentials not configured. Skipping owner setup.'
        );

        return;
    }

    const hash =
        await bcrypt.hash(
            password,
            12
        );

    const [rows] =
        await connection.query(
            `
            SELECT id
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );

    if (!rows.length) {

        await connection.query(
            `
            INSERT INTO users
            (
                email,
                password_hash,
                role
            )
            VALUES
            (?, ?, 'owner')
            `,
            [
                email,
                hash
            ]
        );

        console.log(
            `Owner account created: ${email}`
        );

    } else {

        await connection.query(
            `
            UPDATE users
            SET
                password_hash = ?,
                role = 'owner'
            WHERE email = ?
            `,
            [
                hash,
                email
            ]
        );

        console.log(
            `Owner account refreshed: ${email}`
        );
    }
}

/* =========================================================
   DEFAULT TEAMS
========================================================= */

async function setupTeams(connection) {

    const teams = [
        [
            'Riverside FC',
            'RIV'
        ],
        [
            'Unity FC',
            'UNI'
        ]
    ];

    for (const [
        teamName,
        shortName
    ] of teams) {

        const [rows] =
            await connection.query(
                `
                SELECT id
                FROM teams
                WHERE team_name = ?
                LIMIT 1
                `,
                [teamName]
            );

        if (!rows.length) {

            await connection.query(
                `
                INSERT INTO teams
                (
                    team_name,
                    short_name
                )
                VALUES
                (?, ?)
                `,
                [
                    teamName,
                    shortName
                ]
            );

            console.log(
                `Default team created: ${teamName}`
            );
        }
    }
}

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

async function setupSettings(
    connection
) {

    const settings = [
        [
            'club_name',
            'Los Blancos FC'
        ],
        [
            'tagline',
            'Discipline • Unity • Victory'
        ],
        [
            'hero_background',
            ''
        ]
    ];

    for (const [
        key,
        value
    ] of settings) {

        const [rows] =
            await connection.query(
                `
                SELECT setting_key
                FROM site_settings
                WHERE setting_key = ?
                `,
                [key]
            );

        if (!rows.length) {

            await connection.query(
                `
                INSERT INTO site_settings
                (
                    setting_key,
                    setting_value
                )
                VALUES
                (?, ?)
                `,
                [
                    key,
                    value
                ]
            );
        }
    }
}

/* =========================================================
   MAIN SETUP
========================================================= */

async function setup() {

    const connection =
        await db.getConnection();

    try {

        /*
        -----------------------------------------------------
        CREATE TABLES
        -----------------------------------------------------
        */

        for (
            const [
                tableName,
                schema
            ] of Object.entries(
                schemas
            )
        ) {

            await connection.query(
                schema.create
            );

            console.log(
                `TABLE READY: ${tableName}`
            );
        }

        /*
        -----------------------------------------------------
        ADD MISSING COLUMNS
        -----------------------------------------------------
        */

        for (
            const [
                tableName,
                schema
            ] of Object.entries(
                schemas
            )
        ) {

            for (
                const [
                    columnName,
                    definition
                ] of Object.entries(
                    schema.columns
                )
            ) {

                await ensureColumn(
                    connection,
                    tableName,
                    columnName,
                    definition
                );
            }
        }

        /*
        -----------------------------------------------------
        OWNER
        -----------------------------------------------------
        */

        await setupOwner(
            connection
        );

        /*
        -----------------------------------------------------
        DEFAULT TEAMS
        -----------------------------------------------------
        */

        await setupTeams(
            connection
        );

        /*
        -----------------------------------------------------
        DEFAULT SETTINGS
        -----------------------------------------------------
        */

        await setupSettings(
            connection
        );

        console.log('');
        console.log(
            '=============================================='
        );
        console.log(
            ' DATABASE SETUP COMPLETED SUCCESSFULLY'
        );
        console.log(
            '=============================================='
        );
        console.log('');
        console.log(
            'Los Blancos FC database is ready.'
        );
        console.log('');

    } finally {

        connection.release();

        try {
            await db.end();
        } catch (_) {}
    }
}

/* =========================================================
   START
========================================================= */

setup().catch(error => {

    console.error('');
    console.error(
        'DATABASE SETUP FAILED'
    );
    console.error('');
    console.error(
        error.message
    );
    console.error('');

    process.exit(1);
});
