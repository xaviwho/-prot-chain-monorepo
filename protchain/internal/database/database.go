package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func Initialize(databaseURL string) (*sql.DB, error) {
	fmt.Printf("Initializing database with URL: %s", databaseURL)
	db, err := sql.Open("postgres", databaseURL)
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
			id SERIAL PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			first_name TEXT,
			last_name TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,

		// Organizations table
		`CREATE TABLE IF NOT EXISTS organizations (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			domain TEXT,
			plan TEXT DEFAULT 'free',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,

		// Teams table
		`CREATE TABLE IF NOT EXISTS teams (
			id SERIAL PRIMARY KEY,
			organization_id INTEGER NOT NULL REFERENCES organizations(id),
			name TEXT NOT NULL,
			description TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,

		// Workflows table with blockchain fields
		`CREATE TABLE IF NOT EXISTS workflows (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			team_id INTEGER,
			name TEXT NOT NULL,
			description TEXT,
			status TEXT DEFAULT 'draft',
			results TEXT,
			blockchain_tx_hash TEXT,
			ipfs_hash TEXT,
			blockchain_committed_at TIMESTAMP WITH TIME ZONE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,

		// Organization members table
		`CREATE TABLE IF NOT EXISTS organization_members (
			id SERIAL PRIMARY KEY,
			organization_id INTEGER NOT NULL REFERENCES organizations(id),
			user_id INTEGER NOT NULL REFERENCES users(id),
			role TEXT DEFAULT 'member',
			joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(organization_id, user_id)
		)`,

		// Team members table
		`CREATE TABLE IF NOT EXISTS team_members (
			id SERIAL PRIMARY KEY,
			team_id INTEGER NOT NULL REFERENCES teams(id),
			user_id INTEGER NOT NULL REFERENCES users(id),
			role TEXT DEFAULT 'member',
			joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(team_id, user_id)
		)`,

		// Invitations table
		`CREATE TABLE IF NOT EXISTS invitations (
			id SERIAL PRIMARY KEY,
			organization_id INTEGER REFERENCES organizations(id),
			team_id INTEGER REFERENCES teams(id),
			email TEXT NOT NULL,
			role TEXT DEFAULT 'member',
			token TEXT UNIQUE NOT NULL,
			invited_by INTEGER NOT NULL REFERENCES users(id),
			status TEXT DEFAULT 'pending',
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,

		// Workflow permissions table
		`CREATE TABLE IF NOT EXISTS workflow_permissions (
			id SERIAL PRIMARY KEY,
			workflow_id INTEGER NOT NULL REFERENCES workflows(id),
			organization_id INTEGER REFERENCES organizations(id),
			team_id INTEGER REFERENCES teams(id),
			user_id INTEGER REFERENCES users(id),
			permission_level TEXT DEFAULT 'view',
			granted_by INTEGER NOT NULL REFERENCES users(id)
		)`,

		// Activity log table
		`CREATE TABLE IF NOT EXISTS activity_log (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			organization_id INTEGER REFERENCES organizations(id),
			team_id INTEGER REFERENCES teams(id),
			action TEXT NOT NULL,
			details TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

		// Add team id to workflows if it does not already exist
		`ALTER TABLE workflows ADD COLUMN IF NOT EXISTS team_id INTEGER`,
	}

	for i, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("failed to run migration %d: %w", i+1, err)
		}
	}

	log.Println("Database migrations completed successfully")
	return nil
}
