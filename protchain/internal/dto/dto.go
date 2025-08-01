package dto

import "time"

// Auth DTOs
type RegisterRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	User         UserResponse `json:"user"`
}

type UserResponse struct {
	ID        int    `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// Workflow DTOs
type CreateWorkflowRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type UpdateWorkflowRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Results     string `json:"results"`
}

type UpdateWorkflowBlockchainRequest struct {
	BlockchainTxHash string `json:"blockchain_tx_hash" binding:"required"`
	IPFSHash         string `json:"ipfs_hash" binding:"required"`
}

type WorkflowResponse struct {
	ID                    int        `json:"id"`
	Name                  string     `json:"name"`
	Description           string     `json:"description"`
	Status                string     `json:"status"`
	Results               string     `json:"results"`
	BlockchainTxHash      *string    `json:"blockchain_tx_hash"`
	IPFSHash              *string    `json:"ipfs_hash"`
	BlockchainCommittedAt *time.Time `json:"blockchain_committed_at"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

// Organization DTOs
type CreateOrganizationRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Domain      string `json:"domain"`
}

type UpdateOrganizationRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Domain      string `json:"domain"`
	Plan        string `json:"plan"`
}

type OrganizationResponse struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Domain       string `json:"domain"`
	Plan         string `json:"plan"`
	MemberCount  int    `json:"member_count"`
	TeamCount    int    `json:"team_count"`
	WorkflowCount int   `json:"workflow_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type InviteToOrganizationRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required"`
}

// Team DTOs
type CreateTeamRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type UpdateTeamRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type TeamResponse struct {
	ID             int    `json:"id"`
	OrganizationID int    `json:"organization_id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	MemberCount    int    `json:"member_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type AddTeamMemberRequest struct {
	UserID int    `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required"`
}

// Invitation DTOs
type InvitationResponse struct {
	ID             int        `json:"id"`
	OrganizationID *int       `json:"organization_id"`
	TeamID         *int       `json:"team_id"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	ExpiresAt      time.Time  `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
	InvitedBy      UserResponse `json:"invited_by"`
	Organization   *OrganizationResponse `json:"organization,omitempty"`
	Team           *TeamResponse `json:"team,omitempty"`
}

// Workflow sharing DTOs
type ShareWorkflowRequest struct {
	OrganizationID  *int   `json:"organization_id"`
	TeamID          *int   `json:"team_id"`
	UserID          *int   `json:"user_id"`
	PermissionLevel string `json:"permission_level" binding:"required"`
}

type WorkflowPermissionResponse struct {
	ID              int    `json:"id"`
	WorkflowID      int    `json:"workflow_id"`
	OrganizationID  *int   `json:"organization_id"`
	TeamID          *int   `json:"team_id"`
	UserID          *int   `json:"user_id"`
	PermissionLevel string `json:"permission_level"`
	GrantedBy       UserResponse `json:"granted_by"`
	CreatedAt       time.Time `json:"created_at"`
}

// Stats DTOs
type UserStatsResponse struct {
	TotalWorkflows     int `json:"total_workflows"`
	CompletedWorkflows int `json:"completed_workflows"`
	OrganizationCount  int `json:"organization_count"`
	TeamCount          int `json:"team_count"`
}

// Generic response DTOs
type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}
