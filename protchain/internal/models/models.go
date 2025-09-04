package models

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID           int       `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	FirstName    string    `json:"first_name" db:"first_name"`
	LastName     string    `json:"last_name" db:"last_name"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Workflow represents a workflow in the system
type Workflow struct {
	ID                    int        `json:"id" db:"id"`
	UserID               int        `json:"user_id" db:"user_id"`
	Name                 string     `json:"name" db:"name"`
	Description          *string    `json:"description" db:"description"`
	Status               string     `json:"status" db:"status"`
	Results              *string    `json:"results" db:"results"`
	BlockchainTxHash     *string    `json:"blockchain_tx_hash" db:"blockchain_tx_hash"`
	IPFSHash             *string    `json:"ipfs_hash" db:"ipfs_hash"`
	BlockchainCommittedAt *time.Time `json:"blockchain_committed_at" db:"blockchain_committed_at"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
	TeamID               *int       `json:"team_id" db:"team_id"`
}

// Organization represents an organization
type Organization struct {
	ID          int       `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Domain      string    `json:"domain" db:"domain"`
	Plan        string    `json:"plan" db:"plan"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// OrganizationMember represents a member of an organization
type OrganizationMember struct {
	ID             int       `json:"id" db:"id"`
	OrganizationID int       `json:"organization_id" db:"organization_id"`
	UserID         int       `json:"user_id" db:"user_id"`
	Role           string    `json:"role" db:"role"`
	JoinedAt       time.Time `json:"joined_at" db:"joined_at"`
	User           *User     `json:"user,omitempty"`
}

// Team represents a team within an organization
type Team struct {
	ID             int       `json:"id" db:"id"`
	OrganizationID int       `json:"organization_id" db:"organization_id"`
	Name           string    `json:"name" db:"name"`
	Description    string    `json:"description" db:"description"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// TeamMember represents a member of a team
type TeamMember struct {
	ID       int       `json:"id" db:"id"`
	TeamID   int       `json:"team_id" db:"team_id"`
	UserID   int       `json:"user_id" db:"user_id"`
	Role     string    `json:"role" db:"role"`
	JoinedAt time.Time `json:"joined_at" db:"joined_at"`
	User     *User     `json:"user,omitempty"`
}

// Invitation represents an invitation to join an organization or team
type Invitation struct {
	ID             int        `json:"id" db:"id"`
	OrganizationID *int       `json:"organization_id" db:"organization_id"`
	TeamID         *int       `json:"team_id" db:"team_id"`
	Email          string     `json:"email" db:"email"`
	Role           string     `json:"role" db:"role"`
	Token          string     `json:"token" db:"token"`
	InvitedBy      int        `json:"invited_by" db:"invited_by"`
	Status         string     `json:"status" db:"status"`
	ExpiresAt      time.Time  `json:"expires_at" db:"expires_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	InvitedByUser  *User      `json:"invited_by_user,omitempty"`
	Organization   *Organization `json:"organization,omitempty"`
	Team           *Team      `json:"team,omitempty"`
}

// WorkflowPermission represents permissions for a workflow
type WorkflowPermission struct {
	ID              int       `json:"id" db:"id"`
	WorkflowID      int       `json:"workflow_id" db:"workflow_id"`
	OrganizationID  *int      `json:"organization_id" db:"organization_id"`
	TeamID          *int      `json:"team_id" db:"team_id"`
	UserID          *int      `json:"user_id" db:"user_id"`
	PermissionLevel string    `json:"permission_level" db:"permission_level"`
	GrantedBy       int       `json:"granted_by" db:"granted_by"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

// ActivityLog represents an activity log entry
type ActivityLog struct {
	ID             int       `json:"id" db:"id"`
	UserID         int       `json:"user_id" db:"user_id"`
	OrganizationID *int      `json:"organization_id" db:"organization_id"`
	TeamID         *int      `json:"team_id" db:"team_id"`
	Action         string    `json:"action" db:"action"`
	Details        string    `json:"details" db:"details"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	User           *User     `json:"user,omitempty"`
}
