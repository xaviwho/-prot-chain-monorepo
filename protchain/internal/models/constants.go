package models

// Organization / team member roles.
const (
	RoleAdmin  = "admin"
	RoleMember = "member"
	RoleOwner  = "owner"
)

// Workflow statuses.
const (
	StatusDraft              = "draft"
	StatusPending            = "pending"
	StatusRegistered         = "registered"
	StatusStructureProcessed = "structure_processed"
	StatusCompleted          = "completed"
)

// Invitation statuses.
const (
	InvitationPending  = "pending"
	InvitationAccepted = "accepted"
	InvitationDeclined = "declined"
)
