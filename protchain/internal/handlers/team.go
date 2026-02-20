package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"protchain/internal/dto"
	"protchain/internal/models"

	"github.com/gin-gonic/gin"
)

type TeamHandler struct {
	db *sql.DB
}

func NewTeamHandler(db *sql.DB) *TeamHandler {
	return &TeamHandler{db: db}
}

// Organization handlers
func (h *TeamHandler) ListOrganizations(c *gin.Context) {
	userID, _ := c.Get("user_id")
	page, perPage, offset := parsePagination(c)

	var total int
	if err := h.db.QueryRow(`
		SELECT COUNT(*) FROM organizations WHERE id IN (
			SELECT organization_id FROM organization_members WHERE user_id = $1
		)
	`, userID).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch organizations"})
		return
	}

	rows, err := h.db.Query(`
		SELECT o.id, o.name, o.description, o.domain, o.plan, o.created_at, o.updated_at,
		       COUNT(DISTINCT om.user_id) as member_count,
		       COUNT(DISTINCT t.id) as team_count
		FROM organizations o
		LEFT JOIN organization_members om ON o.id = om.organization_id
		LEFT JOIN teams t ON o.id = t.organization_id
		WHERE o.id IN (
			SELECT organization_id FROM organization_members WHERE user_id = $1
		)
		GROUP BY o.id
		ORDER BY o.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to fetch organizations",
		})
		return
	}
	defer rows.Close()

	organizations := make([]dto.OrganizationResponse, 0)
	for rows.Next() {
		var org dto.OrganizationResponse
		err := rows.Scan(&org.ID, &org.Name, &org.Description, &org.Domain, &org.Plan,
			&org.CreatedAt, &org.UpdatedAt, &org.MemberCount, &org.TeamCount)
		if err != nil {
			continue
		}
		organizations = append(organizations, org)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Success: true,
		Data:    organizations,
		Pagination: dto.PaginationMeta{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages(total, perPage),
		},
	})
}

func (h *TeamHandler) CreateOrganization(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req dto.CreateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Database transaction error",
		})
		return
	}
	defer tx.Rollback()

	var orgID int
	err = tx.QueryRow(`
		INSERT INTO organizations (name, description, domain, plan, created_at, updated_at)
		VALUES ($1, $2, $3, 'free', $4, $5)
		RETURNING id
	`, req.Name, req.Description, req.Domain, time.Now(), time.Now()).Scan(&orgID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to create organization",
		})
		return
	}

	_, err = tx.Exec(`
		INSERT INTO organization_members (organization_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, $4)
	`, orgID, userID, models.RoleAdmin, time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to add user to organization",
		})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusCreated, dto.SuccessResponse{
		Success: true,
		Data: dto.OrganizationResponse{
			ID:          orgID,
			Name:        req.Name,
			Description: req.Description,
			Domain:      req.Domain,
			Plan:        "free",
			MemberCount: 1,
			TeamCount:   0,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	})
}

func (h *TeamHandler) GetOrganization(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var memberCount int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Organization not found"})
		return
	}

	var org dto.OrganizationResponse
	err = h.db.QueryRow(`
		SELECT o.id, o.name, o.description, o.domain, o.plan, o.created_at, o.updated_at,
		       (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
		       (SELECT COUNT(*) FROM teams WHERE organization_id = o.id) as team_count
		FROM organizations o
		WHERE o.id = $1
	`, orgID).Scan(&org.ID, &org.Name, &org.Description, &org.Domain, &org.Plan,
		&org.CreatedAt, &org.UpdatedAt, &org.MemberCount, &org.TeamCount)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Organization not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch organization"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Data: org})
}

func (h *TeamHandler) UpdateOrganization(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only organization admins can update settings"})
		return
	}

	var req dto.UpdateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	_, err = h.db.Exec(`
		UPDATE organizations
		SET name = $1, description = $2, domain = $3, updated_at = $4
		WHERE id = $5
	`, req.Name, req.Description, req.Domain, time.Now(), orgID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to update organization"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Organization updated successfully"})
}

func (h *TeamHandler) DeleteOrganization(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only organization admins can delete organizations"})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Database error"})
		return
	}
	defer tx.Rollback()

	cascadeDeletes := []struct {
		query string
		desc  string
	}{
		{`DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE organization_id = $1)`, "team_members"},
		{`DELETE FROM teams WHERE organization_id = $1`, "teams"},
		{`DELETE FROM invitations WHERE organization_id = $1`, "invitations"},
		{`DELETE FROM organization_members WHERE organization_id = $1`, "organization_members"},
		{`DELETE FROM organizations WHERE id = $1`, "organizations"},
	}
	for _, d := range cascadeDeletes {
		if _, err = tx.Exec(d.query, orgID); err != nil {
			log.Printf("DeleteOrganization: failed to delete %s for org %s: %v", d.desc, orgID, err)
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: fmt.Sprintf("Failed to delete %s", d.desc)})
			return
		}
	}
	err = nil // all succeeded

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to commit deletion"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Organization deleted successfully"})
}

func (h *TeamHandler) InviteToOrganization(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only admins can invite members"})
		return
	}

	var req dto.InviteToOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	token := generateInvitationToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	orgIDInt, parseErr := parseIntParam(orgID)
	if parseErr != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Invalid organization ID"})
		return
	}
	_, err = h.db.Exec(`
		INSERT INTO invitations (organization_id, email, role, token, invited_by, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, orgIDInt, req.Email, req.Role, token, userID, models.InvitationPending, expiresAt, time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to create invitation"})
		return
	}

	c.JSON(http.StatusCreated, dto.SuccessResponse{
		Success: true,
		Data: gin.H{
			"token":      token,
			"email":      req.Email,
			"role":       req.Role,
			"expires_at": expiresAt,
		},
	})
}

func (h *TeamHandler) ListOrganizationMembers(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var memberCheck int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&memberCheck)
	if err != nil || memberCheck == 0 {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Access denied"})
		return
	}

	page, perPage, offset := parsePagination(c)

	var total int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM organization_members WHERE organization_id = $1`, orgID).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch members"})
		return
	}

	rows, err := h.db.Query(`
		SELECT om.id, om.organization_id, om.user_id, om.role, om.joined_at,
		       u.email, u.first_name, u.last_name
		FROM organization_members om
		JOIN users u ON om.user_id = u.id
		WHERE om.organization_id = $1
		ORDER BY om.joined_at ASC
		LIMIT $2 OFFSET $3
	`, orgID, perPage, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch members"})
		return
	}
	defer rows.Close()

	type MemberResponse struct {
		ID        int       `json:"id"`
		UserID    int       `json:"user_id"`
		Role      string    `json:"role"`
		JoinedAt  time.Time `json:"joined_at"`
		Email     string    `json:"email"`
		FirstName string    `json:"first_name"`
		LastName  string    `json:"last_name"`
	}

	members := make([]MemberResponse, 0)
	for rows.Next() {
		var m MemberResponse
		var orgIDScan int
		if err := rows.Scan(&m.ID, &orgIDScan, &m.UserID, &m.Role, &m.JoinedAt, &m.Email, &m.FirstName, &m.LastName); err != nil {
			continue
		}
		members = append(members, m)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Success: true,
		Data:    members,
		Pagination: dto.PaginationMeta{
			Page: page, PerPage: perPage, Total: total, TotalPages: totalPages(total, perPage),
		},
	})
}

func (h *TeamHandler) RemoveOrganizationMember(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")
	targetUserID := c.Param("userId")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only admins can remove members"})
		return
	}

	uid, ok := userID.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Invalid user session"})
		return
	}
	if strconv.Itoa(uid) == targetUserID {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Cannot remove yourself from the organization"})
		return
	}

	result, err := h.db.Exec(`
		DELETE FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to remove member"})
		return
	}

	rowsAffected, raErr := result.RowsAffected()
	if raErr != nil {
		log.Printf("RemoveOrganizationMember: RowsAffected error: %v", raErr)
	}
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Member not found"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Member removed successfully"})
}

// Team handlers
func (h *TeamHandler) ListTeams(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var memberCheck int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&memberCheck)
	if err != nil || memberCheck == 0 {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Access denied"})
		return
	}

	page, perPage, offset := parsePagination(c)

	var total int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM teams WHERE organization_id = $1`, orgID).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch teams"})
		return
	}

	rows, err := h.db.Query(`
		SELECT t.id, t.organization_id, t.name, t.description, t.created_at, t.updated_at,
		       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
		FROM teams t
		WHERE t.organization_id = $1
		ORDER BY t.created_at DESC
		LIMIT $2 OFFSET $3
	`, orgID, perPage, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch teams"})
		return
	}
	defer rows.Close()

	teams := make([]dto.TeamResponse, 0)
	for rows.Next() {
		var t dto.TeamResponse
		if err := rows.Scan(&t.ID, &t.OrganizationID, &t.Name, &t.Description, &t.CreatedAt, &t.UpdatedAt, &t.MemberCount); err != nil {
			continue
		}
		teams = append(teams, t)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Success: true,
		Data:    teams,
		Pagination: dto.PaginationMeta{
			Page: page, PerPage: perPage, Total: total, TotalPages: totalPages(total, perPage),
		},
	})
}

func (h *TeamHandler) CreateTeam(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only admins can create teams"})
		return
	}

	var req dto.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	orgIDInt, parseErr := parseIntParam(orgID)
	if parseErr != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Invalid organization ID"})
		return
	}
	var teamID int
	err = h.db.QueryRow(`
		INSERT INTO teams (organization_id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, orgIDInt, req.Name, req.Description, time.Now(), time.Now()).Scan(&teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to create team"})
		return
	}

	_, err = h.db.Exec(`
		INSERT INTO team_members (team_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, $4)
	`, teamID, userID, models.RoleOwner, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to add creator to team"})
		return
	}

	c.JSON(http.StatusCreated, dto.SuccessResponse{
		Success: true,
		Data: dto.TeamResponse{
			ID:             teamID,
			OrganizationID: orgIDInt,
			Name:           req.Name,
			Description:    req.Description,
			MemberCount:    1,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
	})
}

func (h *TeamHandler) GetTeam(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")
	teamID := c.Param("teamId")

	var memberCheck int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&memberCheck)
	if err != nil || memberCheck == 0 {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Access denied"})
		return
	}

	var team dto.TeamResponse
	err = h.db.QueryRow(`
		SELECT t.id, t.organization_id, t.name, t.description, t.created_at, t.updated_at,
		       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
		FROM teams t
		WHERE t.id = $1 AND t.organization_id = $2
	`, teamID, orgID).Scan(&team.ID, &team.OrganizationID, &team.Name, &team.Description,
		&team.CreatedAt, &team.UpdatedAt, &team.MemberCount)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Team not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch team"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Data: team})
}

func (h *TeamHandler) UpdateTeam(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")
	teamID := c.Param("teamId")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only organization admins can update teams"})
		return
	}

	var req dto.UpdateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	_, err = h.db.Exec(`
		UPDATE teams SET name = $1, description = $2, updated_at = $3
		WHERE id = $4 AND organization_id = $5
	`, req.Name, req.Description, time.Now(), teamID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to update team"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Team updated successfully"})
}

func (h *TeamHandler) DeleteTeam(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")
	teamID := c.Param("teamId")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only organization admins can delete teams"})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Database error"})
		return
	}
	defer tx.Rollback()

	if _, err = tx.Exec(`DELETE FROM team_members WHERE team_id = $1`, teamID); err != nil {
		log.Printf("DeleteTeam: failed to delete team_members for team %s: %v", teamID, err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to delete team members"})
		return
	}
	if _, err = tx.Exec(`DELETE FROM teams WHERE id = $1 AND organization_id = $2`, teamID, orgID); err != nil {
		log.Printf("DeleteTeam: failed to delete team %s: %v", teamID, err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to delete team"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to commit deletion"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Team deleted successfully"})
}

func (h *TeamHandler) AddTeamMember(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")
	teamID := c.Param("teamId")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only admins can add team members"})
		return
	}

	var req dto.AddTeamMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	var orgMemberCheck int
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, req.UserID).Scan(&orgMemberCheck)
	if err != nil || orgMemberCheck == 0 {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "User must be an organization member first"})
		return
	}

	_, err = h.db.Exec(`
		INSERT INTO team_members (team_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, $4)
	`, teamID, req.UserID, req.Role, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to add team member"})
		return
	}

	c.JSON(http.StatusCreated, dto.SuccessResponse{Success: true, Message: "Team member added successfully"})
}

func (h *TeamHandler) RemoveTeamMember(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orgID := c.Param("id")
	teamID := c.Param("teamId")
	targetUserID := c.Param("userId")

	var role string
	err := h.db.QueryRow(`
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if err != nil || role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Only admins can remove team members"})
		return
	}

	result, err := h.db.Exec(`
		DELETE FROM team_members
		WHERE team_id = $1 AND user_id = $2
	`, teamID, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to remove team member"})
		return
	}

	rowsAffected, raErr := result.RowsAffected()
	if raErr != nil {
		log.Printf("RemoveTeamMember: RowsAffected error: %v", raErr)
	}
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Team member not found"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Team member removed successfully"})
}

// Invitation handlers
func (h *TeamHandler) ListInvitations(c *gin.Context) {
	email, _ := c.Get("email")
	page, perPage, offset := parsePagination(c)

	var total int
	if err := h.db.QueryRow(`
		SELECT COUNT(*) FROM invitations WHERE email = $1 AND status = 'pending' AND expires_at > NOW()
	`, email).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch invitations"})
		return
	}

	rows, err := h.db.Query(`
		SELECT i.id, i.organization_id, i.team_id, i.email, i.role, i.status, i.expires_at, i.created_at,
		       u.id, u.email, u.first_name, u.last_name,
		       o.id, o.name
		FROM invitations i
		JOIN users u ON i.invited_by = u.id
		LEFT JOIN organizations o ON i.organization_id = o.id
		WHERE i.email = $1 AND i.status = 'pending' AND i.expires_at > NOW()
		ORDER BY i.created_at DESC
		LIMIT $2 OFFSET $3
	`, email, perPage, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch invitations"})
		return
	}
	defer rows.Close()

	type InvitationItem struct {
		ID               int       `json:"id"`
		OrganizationID   *int      `json:"organization_id"`
		TeamID           *int      `json:"team_id"`
		Email            string    `json:"email"`
		Role             string    `json:"role"`
		Status           string    `json:"status"`
		ExpiresAt        time.Time `json:"expires_at"`
		CreatedAt        time.Time `json:"created_at"`
		InvitedByID      int       `json:"invited_by_id"`
		InvitedByEmail   string    `json:"invited_by_email"`
		InvitedByFirst   string    `json:"invited_by_first_name"`
		InvitedByLast    string    `json:"invited_by_last_name"`
		OrganizationName *string   `json:"organization_name"`
	}

	invitations := make([]InvitationItem, 0)
	for rows.Next() {
		var inv InvitationItem
		var orgName sql.NullString
		var orgIDNull sql.NullInt64
		if err := rows.Scan(&inv.ID, &inv.OrganizationID, &inv.TeamID, &inv.Email, &inv.Role,
			&inv.Status, &inv.ExpiresAt, &inv.CreatedAt,
			&inv.InvitedByID, &inv.InvitedByEmail, &inv.InvitedByFirst, &inv.InvitedByLast,
			&orgIDNull, &orgName); err != nil {
			continue
		}
		if orgName.Valid {
			inv.OrganizationName = &orgName.String
		}
		invitations = append(invitations, inv)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Success: true,
		Data:    invitations,
		Pagination: dto.PaginationMeta{
			Page: page, PerPage: perPage, Total: total, TotalPages: totalPages(total, perPage),
		},
	})
}

func (h *TeamHandler) AcceptInvitation(c *gin.Context) {
	userID, _ := c.Get("user_id")
	token := c.Param("token")

	var inv struct {
		ID             int
		OrganizationID *int
		TeamID         *int
		Role           string
	}
	err := h.db.QueryRow(`
		SELECT id, organization_id, team_id, role
		FROM invitations
		WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
	`, token).Scan(&inv.ID, &inv.OrganizationID, &inv.TeamID, &inv.Role)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Invitation not found or expired"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch invitation"})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Database error"})
		return
	}
	defer tx.Rollback()

	if inv.OrganizationID != nil {
		_, err = tx.Exec(`
			INSERT INTO organization_members (organization_id, user_id, role, joined_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (organization_id, user_id) DO NOTHING
		`, *inv.OrganizationID, userID, inv.Role, time.Now())
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to join organization"})
			return
		}
	}

	if inv.TeamID != nil {
		_, err = tx.Exec(`
			INSERT INTO team_members (team_id, user_id, role, joined_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (team_id, user_id) DO NOTHING
		`, *inv.TeamID, userID, inv.Role, time.Now())
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to join team"})
			return
		}
	}

	_, err = tx.Exec(`UPDATE invitations SET status = $1 WHERE id = $2`, models.InvitationAccepted, inv.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to update invitation"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to commit"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Invitation accepted successfully"})
}

func (h *TeamHandler) DeclineInvitation(c *gin.Context) {
	token := c.Param("token")

	result, err := h.db.Exec(`
		UPDATE invitations SET status = $1
		WHERE token = $2 AND status = $3
	`, models.InvitationDeclined, token, models.InvitationPending)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to decline invitation"})
		return
	}

	rowsAffected, raErr := result.RowsAffected()
	if raErr != nil {
		log.Printf("DeclineInvitation: RowsAffected error: %v", raErr)
	}
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Invitation not found"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Invitation declined"})
}

// Workflow sharing handlers
func (h *TeamHandler) ShareWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var ownerCheck int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM workflows WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&ownerCheck)
	if err != nil || ownerCheck == 0 {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "You can only share your own workflows"})
		return
	}

	var req dto.ShareWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	_, err = h.db.Exec(`
		INSERT INTO workflow_permissions (workflow_id, organization_id, team_id, user_id, permission_level, granted_by)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, workflowID, req.OrganizationID, req.TeamID, req.UserID, req.PermissionLevel, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to share workflow"})
		return
	}

	c.JSON(http.StatusCreated, dto.SuccessResponse{Success: true, Message: "Workflow shared successfully"})
}

func (h *TeamHandler) GetWorkflowPermissions(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var ownerCheck int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM workflows WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&ownerCheck)
	if err != nil || ownerCheck == 0 {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Access denied"})
		return
	}

	rows, err := h.db.Query(`
		SELECT wp.id, wp.workflow_id, wp.organization_id, wp.team_id, wp.user_id, wp.permission_level,
		       u.id, u.email, u.first_name, u.last_name
		FROM workflow_permissions wp
		JOIN users u ON wp.granted_by = u.id
		WHERE wp.workflow_id = $1
	`, workflowID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch permissions"})
		return
	}
	defer rows.Close()

	permissions := make([]dto.WorkflowPermissionResponse, 0)
	for rows.Next() {
		var p dto.WorkflowPermissionResponse
		if err := rows.Scan(&p.ID, &p.WorkflowID, &p.OrganizationID, &p.TeamID, &p.UserID,
			&p.PermissionLevel, &p.GrantedBy.ID, &p.GrantedBy.Email,
			&p.GrantedBy.FirstName, &p.GrantedBy.LastName); err != nil {
			continue
		}
		permissions = append(permissions, p)
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Data: permissions})
}

func (h *TeamHandler) UpdateWorkflowPermissions(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var ownerCheck int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM workflows WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&ownerCheck)
	if err != nil || ownerCheck == 0 {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Success: false, Error: "Access denied"})
		return
	}

	var req struct {
		PermissionID    int    `json:"permission_id" binding:"required"`
		PermissionLevel string `json:"permission_level" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: err.Error()})
		return
	}

	_, err = h.db.Exec(`
		UPDATE workflow_permissions SET permission_level = $1
		WHERE id = $2 AND workflow_id = $3
	`, req.PermissionLevel, req.PermissionID, workflowID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to update permissions"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Permissions updated successfully"})
}

// Helper functions
func generateInvitationToken() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func parseIntParam(s string) (int, error) {
	i, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("invalid integer parameter %q: %w", s, err)
	}
	return i, nil
}
