package handlers

import (
	"database/sql"
	"net/http"

	"time"

	"protchain/internal/dto"
	"protchain/internal/models"

	"github.com/gin-gonic/gin"
)

type WorkflowHandler struct {
	db *sql.DB
}

func NewWorkflowHandler(db *sql.DB) *WorkflowHandler {
	return &WorkflowHandler{db: db}
}

func (h *WorkflowHandler) ListWorkflows(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := h.db.Query(`
		SELECT id, name, description, status, results, blockchain_tx_hash, ipfs_hash, 
		       blockchain_committed_at, created_at, updated_at
		FROM workflows 
		WHERE user_id = $1 
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to fetch workflows",
		})
		return
	}
	defer rows.Close()

	// Initialize as non-nil to ensure JSON encodes [] instead of null when empty
	workflows := make([]dto.WorkflowResponse, 0)
	for rows.Next() {
		var w models.Workflow
		err := rows.Scan(&w.ID, &w.Name, &w.Description, &w.Status, &w.Results,
			&w.BlockchainTxHash, &w.IPFSHash, &w.BlockchainCommittedAt,
			&w.CreatedAt, &w.UpdatedAt)
		if err != nil {
			continue
		}

		workflows = append(workflows, dto.WorkflowResponse{
			ID:                    w.ID,
			Name:                  w.Name,
			Description:           w.Description,
			Status:                w.Status,
			Results:               w.Results,
			BlockchainTxHash:      w.BlockchainTxHash,
			IPFSHash:              w.IPFSHash,
			BlockchainCommittedAt: w.BlockchainCommittedAt,
			CreatedAt:             w.CreatedAt,
			UpdatedAt:             w.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Data:    workflows,
	})
}

func (h *WorkflowHandler) CreateWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req dto.CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	var workflowID int
	err := h.db.QueryRow(`
		INSERT INTO workflows (user_id, name, description, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'draft', $4, $5)
		RETURNING id
	`, userID, req.Name, req.Description, time.Now(), time.Now()).Scan(&workflowID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to create workflow",
		})
		return
	}

	now := time.Now()
	c.JSON(http.StatusCreated, dto.SuccessResponse{
		Success: true,
		Data: dto.WorkflowResponse{
			ID:          workflowID,
			Name:        req.Name,
			Description: req.Description,
			Status:      "draft",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	})
}

func (h *WorkflowHandler) GetWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var w models.Workflow
	err := h.db.QueryRow(`
		SELECT id, name, description, status, results, blockchain_tx_hash, ipfs_hash,
		       blockchain_committed_at, created_at, updated_at
		FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&w.ID, &w.Name, &w.Description, &w.Status, &w.Results,
		&w.BlockchainTxHash, &w.IPFSHash, &w.BlockchainCommittedAt,
		&w.CreatedAt, &w.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{
			Success: false,
			Error:   "Workflow not found",
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
		Data: dto.WorkflowResponse{
			ID:                    w.ID,
			Name:                  w.Name,
			Description:           w.Description,
			Status:                w.Status,
			Results:               w.Results,
			BlockchainTxHash:      w.BlockchainTxHash,
			IPFSHash:              w.IPFSHash,
			BlockchainCommittedAt: w.BlockchainCommittedAt,
			CreatedAt:             w.CreatedAt,
			UpdatedAt:             w.UpdatedAt,
		},
	})
}

func (h *WorkflowHandler) UpdateWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var req dto.UpdateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	_, err := h.db.Exec(`
		UPDATE workflows 
		SET name = $1, description = $2, status = $3, results = $4, updated_at = $5
		WHERE id = $6 AND user_id = $7
	`, req.Name, req.Description, req.Status, req.Results, time.Now(), workflowID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to update workflow",
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Message: "Workflow updated successfully",
	})
}

func (h *WorkflowHandler) UpdateWorkflowBlockchainInfo(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var req dto.UpdateWorkflowBlockchainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	now := time.Now()
	_, err := h.db.Exec(`
		UPDATE workflows 
		SET blockchain_tx_hash = $1, ipfs_hash = $2, blockchain_committed_at = $3, updated_at = $4
		WHERE id = $5 AND user_id = $6
	`, req.BlockchainTxHash, req.IPFSHash, now, now, workflowID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to update workflow blockchain info",
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Message: "Workflow blockchain info updated successfully",
	})
}

func (h *WorkflowHandler) DeleteWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to start transaction"})
		return
	}
	defer func() {
		_ = tx.Rollback()
	}()

	// Delete dependent permissions first to avoid FK constraint errors
	if _, err := tx.Exec(`DELETE FROM workflow_permissions WHERE workflow_id = $1`, workflowID); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to delete workflow permissions"})
		return
	}

	// Then delete the workflow row
	result, err := tx.Exec(`
		DELETE FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to delete workflow"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Success: false, Error: "Workflow not found"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Success: true, Message: "Workflow deleted successfully"})
}
