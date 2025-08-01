package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

func Initialize(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Database connected successfully: %s", databaseURL)
	return db, nil
}

func RunMigrations(db *sql.DB) error {
	migrations := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			first_name TEXT,
			last_name TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Workflows table with blockchain fields
		`CREATE TABLE IF NOT EXISTS workflows (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			status TEXT DEFAULT 'draft',
			results TEXT,
			blockchain_tx_hash TEXT,
			ipfs_hash TEXT,
			blockchain_committed_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users (id)
		)`,

		// Organizations table
		`CREATE TABLE IF NOT EXISTS organizations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			domain TEXT,
			plan TEXT DEFAULT 'free',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Organization members table
		`CREATE TABLE IF NOT EXISTS organization_members (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			organization_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			role TEXT DEFAULT 'member',
			joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (organization_id) REFERENCES organizations (id),
			FOREIGN KEY (user_id) REFERENCES users (id),
			UNIQUE(organization_id, user_id)
		)`,

		// Teams table
		`CREATE TABLE IF NOT EXISTS teams (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			organization_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (organization_id) REFERENCES organizations (id)
		)`,

		// Team members table
		`CREATE TABLE IF NOT EXISTS team_members (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			team_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			role TEXT DEFAULT 'member',
			joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (team_id) REFERENCES teams (id),
			FOREIGN KEY (user_id) REFERENCES users (id),
			UNIQUE(team_id, user_id)
		)`,

		// Invitations table
		`CREATE TABLE IF NOT EXISTS invitations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			organization_id INTEGER,
			team_id INTEGER,
			email TEXT NOT NULL,
			role TEXT DEFAULT 'member',
			token TEXT UNIQUE NOT NULL,
			invited_by INTEGER NOT NULL,
			status TEXT DEFAULT 'pending',
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (organization_id) REFERENCES organizations (id),
			FOREIGN KEY (team_id) REFERENCES teams (id),
			FOREIGN KEY (invited_by) REFERENCES users (id)
		)`,

		// Workflow permissions table
		`CREATE TABLE IF NOT EXISTS workflow_permissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			workflow_id INTEGER NOT NULL,
			organization_id INTEGER,
			team_id INTEGER,
			user_id INTEGER,
			permission_level TEXT DEFAULT 'view',
			granted_by INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (workflow_id) REFERENCES workflows (id),
			FOREIGN KEY (organization_id) REFERENCES organizations (id),
			FOREIGN KEY (team_id) REFERENCES teams (id),
			FOREIGN KEY (user_id) REFERENCES users (id),
			FOREIGN KEY (granted_by) REFERENCES users (id)
		)`,

		// Activity log table
		`CREATE TABLE IF NOT EXISTS activity_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			organization_id INTEGER,
			team_id INTEGER,
			action TEXT NOT NULL,
			details TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users (id),
			FOREIGN KEY (organization_id) REFERENCES organizations (id),
			FOREIGN KEY (team_id) REFERENCES teams (id)
		)`,

		// Indexes for performance
		`CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members (organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members (team_id)`,
		`CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token)`,
		`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations (email)`,
		`CREATE INDEX IF NOT EXISTS idx_workflow_permissions_workflow_id ON workflow_permissions (workflow_id)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_log_org_id ON activity_log (organization_id)`,
	}

	for i, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("failed to run migration %d: %w", i+1, err)
		}
	}

	log.Println("Database migrations completed successfully")
	return nil
}
