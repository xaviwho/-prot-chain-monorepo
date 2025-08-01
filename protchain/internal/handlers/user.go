package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"protchain/internal/dto"
	"protchain/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	db *sql.DB
}

func NewUserHandler(db *sql.DB) *UserHandler {
	return &UserHandler{db: db}
}

func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.User
	err := h.db.QueryRow(`
		SELECT id, email, first_name, last_name, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{
			Success: false,
			Error:   "User not found",
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Database error",
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Data: dto.UserResponse{
			ID:        user.ID,
			Email:     user.Email,
			FirstName: user.FirstName,
			LastName:  user.LastName,
		},
	})
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Password  string `json:"password,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// If password is provided, hash it
	var passwordHash *string
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
				Success: false,
				Error:   "Failed to hash password",
			})
			return
		}
		passwordHashStr := string(hashedPassword)
		passwordHash = &passwordHashStr
	}

	// Update user profile
	if passwordHash != nil {
		_, err := h.db.Exec(`
			UPDATE users 
			SET first_name = ?, last_name = ?, email = ?, password_hash = ?, updated_at = ?
			WHERE id = ?
		`, req.FirstName, req.LastName, req.Email, *passwordHash, time.Now(), userID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
				Success: false,
				Error:   "Failed to update profile",
			})
			return
		}
	} else {
		_, err := h.db.Exec(`
			UPDATE users 
			SET first_name = ?, last_name = ?, email = ?, updated_at = ?
			WHERE id = ?
		`, req.FirstName, req.LastName, req.Email, time.Now(), userID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
				Success: false,
				Error:   "Failed to update profile",
			})
			return
		}
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Message: "Profile updated successfully",
	})
}

func (h *UserHandler) GetStats(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var stats dto.UserStatsResponse

	// Get total workflows
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM workflows WHERE user_id = ?
	`, userID).Scan(&stats.TotalWorkflows)
	if err != nil {
		stats.TotalWorkflows = 0
	}

	// Get completed workflows
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM workflows WHERE user_id = ? AND status = 'completed'
	`, userID).Scan(&stats.CompletedWorkflows)
	if err != nil {
		stats.CompletedWorkflows = 0
	}

	// Get organization count
	err = h.db.QueryRow(`
		SELECT COUNT(DISTINCT organization_id) FROM organization_members WHERE user_id = ?
	`, userID).Scan(&stats.OrganizationCount)
	if err != nil {
		stats.OrganizationCount = 0
	}

	// Get team count
	err = h.db.QueryRow(`
		SELECT COUNT(DISTINCT team_id) FROM team_members WHERE user_id = ?
	`, userID).Scan(&stats.TeamCount)
	if err != nil {
		stats.TeamCount = 0
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Data:    stats,
	})
}
