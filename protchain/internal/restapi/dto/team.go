package dto

import "time"

// CreateTeamRequest defines the request body for creating a new team.
type CreateTeamRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// UpdateTeamRequest defines the request body for updating a team.
type UpdateTeamRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// TeamResponse defines the standard API response for a team.
type TeamResponse struct {
	ID            int       `json:"id"`
	OrganizationID int       `json:"organization_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// AddTeamMemberRequest defines the request body for adding a member to a team.
type AddTeamMemberRequest struct {
	UserID int    `json:"user_id" binding:"required"`
	Role   string `json:"role"    binding:"required"`
}

// TeamMemberResponse defines the API response for a team member.
type TeamMemberResponse struct {
	ID        int    `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
}

// InviteUserToTeamRequest defines the request body for inviting a user to a team.
type InviteUserToTeamRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role"  binding:"required"`
}

// RespondToInvitationRequest defines the request body for accepting or declining an invitation.
type RespondToInvitationRequest struct {
	Token string `json:"token" binding:"required"`
}
