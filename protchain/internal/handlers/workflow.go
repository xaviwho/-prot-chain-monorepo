package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
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
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	page, perPage, offset := parsePagination(c)

	// Get total count
	var total int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM workflows WHERE user_id = $1`, userID).Scan(&total); err != nil {
		log.Printf("failed to count workflows: %s", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to fetch workflows"})
		return
	}

	rows, err := h.db.Query(`
		SELECT id, user_id, name, description, status, results, blockchain_tx_hash, ipfs_hash,
		       blockchain_committed_at, created_at, updated_at, team_id
		FROM workflows
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset)

	if err != nil {
		log.Printf("failed to list workflow information: %s", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to fetch workflows",
		})
		return
	}
	defer rows.Close()

	workflows := make([]dto.WorkflowResponse, 0)
	for rows.Next() {
		var w models.Workflow
		err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.Description, &w.Status, &w.Results,
			&w.BlockchainTxHash, &w.IPFSHash, &w.BlockchainCommittedAt,
			&w.CreatedAt, &w.UpdatedAt, &w.TeamID)
		if err != nil {
			log.Printf("failed to scan workflow: %s", err)
			continue
		}

		description := ""
		if w.Description != nil {
			description = *w.Description
		}
		results := ""
		if w.Results != nil {
			results = *w.Results
		}

		workflows = append(workflows, dto.WorkflowResponse{
			ID:                    w.ID,
			Name:                  w.Name,
			Description:           description,
			Status:                w.Status,
			Results:               results,
			BlockchainTxHash:      w.BlockchainTxHash,
			IPFSHash:              w.IPFSHash,
			BlockchainCommittedAt: w.BlockchainCommittedAt,
			CreatedAt:             w.CreatedAt,
			UpdatedAt:             w.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Success: true,
		Data:    workflows,
		Pagination: dto.PaginationMeta{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages(total, perPage),
		},
	})
}

func (h *WorkflowHandler) CreateWorkflow(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	var req dto.CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	var workflowID int
		// Get user's default team_id
	var teamID int
	err := h.db.QueryRow(`SELECT team_id FROM team_members WHERE user_id = $1 AND role = $2`, userID, models.RoleOwner).Scan(&teamID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("error selecting team id: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to find user team",
		})
		return
	}

	err = h.db.QueryRow(`
		INSERT INTO workflows (user_id, team_id, name, description, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, userID, teamID, req.Name, req.Description, models.StatusDraft, time.Now(), time.Now()).Scan(&workflowID)

	if err != nil {
		log.Printf("error creating workflow: %v", err)
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
			Status:      models.StatusDraft,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	})
}

func (h *WorkflowHandler) GetWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")
	if _, ok := parseIDParam(c, "id"); !ok {
		return
	}
	workflowID := c.Param("id")

	var w models.Workflow
	var description, results, blockchainTxHash, ipfsHash sql.NullString
	var blockchainCommittedAt sql.NullTime
	
	err := h.db.QueryRow(`
		SELECT id, name, description, status, results, blockchain_tx_hash, ipfs_hash,
		       blockchain_committed_at, created_at, updated_at
		FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&w.ID, &w.Name, &description, &w.Status, &results,
		&blockchainTxHash, &ipfsHash, &blockchainCommittedAt,
		&w.CreatedAt, &w.UpdatedAt)
	
	// Convert sql.NullString to *string
	if description.Valid {
		w.Description = &description.String
	}
	if results.Valid {
		w.Results = &results.String
	}
	if blockchainTxHash.Valid {
		w.BlockchainTxHash = &blockchainTxHash.String
	}
	if ipfsHash.Valid {
		w.IPFSHash = &ipfsHash.String
	}
	if blockchainCommittedAt.Valid {
		w.BlockchainCommittedAt = &blockchainCommittedAt.Time
	}

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

	// Handle pointer fields safely for response
	descriptionStr := ""
	if w.Description != nil {
		descriptionStr = *w.Description
	}
	resultsStr := ""
	if w.Results != nil {
		resultsStr = *w.Results
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Data: dto.WorkflowResponse{
			ID:                    w.ID,
			Name:                  w.Name,
			Description:           descriptionStr,
			Status:                w.Status,
			Results:               resultsStr,
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
	if _, ok := parseIDParam(c, "id"); !ok {
		return
	}
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
	if _, ok := parseIDParam(c, "id"); !ok {
		return
	}
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

	rowsAffected, raErr := result.RowsAffected()
	if raErr != nil {
		log.Printf("DeleteWorkflow: RowsAffected error: %v", raErr)
	}
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

func (h *WorkflowHandler) GetWorkflowPDB(c *gin.Context) {
	workflowID := c.Param("id")
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	// Check if workflow belongs to user
	var count int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&count)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Database error",
		})
		return
	}

	if count == 0 {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{
			Success: false,
			Error:   "Workflow not found",
		})
		return
	}

	// Return 404 since no PDB data is stored for this workflow yet
	// Frontend will handle fetching from RCSB based on workflow name
	c.JSON(http.StatusNotFound, dto.ErrorResponse{
		Success: false,
		Error:   "No PDB data stored for this workflow",
	})
}

// GetWorkflowStatus returns the current status of a workflow
func (h *WorkflowHandler) GetWorkflowStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var workflow models.Workflow
	var description, results sql.NullString
	
	err := h.db.QueryRow(`
		SELECT id, user_id, name, description, status, results, created_at, updated_at
		FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(
		&workflow.ID, &workflow.UserID, &workflow.Name, &description,
		&workflow.Status, &results, &workflow.CreatedAt, &workflow.UpdatedAt,
	)

	// Convert sql.NullString to *string
	if description.Valid {
		workflow.Description = &description.String
	}
	if results.Valid {
		workflow.Results = &results.String
	}

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
			Error:   "Failed to fetch workflow status",
		})
		return
	}

	// Return status information
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  workflow.Status,
		"message": fmt.Sprintf("Workflow %s is %s", workflow.Name, workflow.Status),
		"workflow": gin.H{
			"id":          workflow.ID,
			"name":        workflow.Name,
			"description": workflow.Description,
			"status":      workflow.Status,
			"updated_at":  workflow.UpdatedAt,
		},
	})
}

// GetWorkflowResults returns the results of a workflow
func (h *WorkflowHandler) GetWorkflowResults(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var workflow models.Workflow
	var description, results sql.NullString
	
	err := h.db.QueryRow(`
		SELECT id, user_id, name, description, status, results, created_at, updated_at
		FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(
		&workflow.ID, &workflow.UserID, &workflow.Name, &description,
		&workflow.Status, &results, &workflow.CreatedAt, &workflow.UpdatedAt,
	)

	// Convert sql.NullString to *string
	if description.Valid {
		workflow.Description = &description.String
	}
	if results.Valid {
		workflow.Results = &results.String
	}

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
			Error:   "Failed to fetch workflow results",
		})
		return
	}

	// Parse results JSON if available
	resultsStr := ""
	if workflow.Results != nil {
		resultsStr = *workflow.Results
	}

	if resultsStr == "" {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{
			Success: false,
			Error:   "No results available for this workflow",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"results": resultsStr,
		"workflow": gin.H{
			"id":     workflow.ID,
			"name":   workflow.Name,
			"status": workflow.Status,
		},
	})
}

// RegisterWorkflow registers a workflow for processing
func (h *WorkflowHandler) RegisterWorkflow(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var req struct {
		WorkflowID string `json:"workflow_id"`
		Path       string `json:"path"`
		WSLPath    string `json:"wsl_path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Update workflow status to registered
	_, err := h.db.Exec(`
		UPDATE workflows 
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3
	`, models.StatusRegistered, workflowID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to register workflow",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Workflow registered successfully",
		"workflow_id": workflowID,
		"status": models.StatusRegistered,
	})
}

// StartBindingSiteAnalysis starts binding site analysis for a workflow
func (h *WorkflowHandler) StartBindingSiteAnalysis(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	// Verify workflow exists and belongs to user
	var workflow models.Workflow
	err := h.db.QueryRow(`
		SELECT id, status FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&workflow.ID, &workflow.Status)

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
			Error:   "Failed to access workflow",
		})
		return
	}

	c.JSON(http.StatusNotImplemented, dto.ErrorResponse{
		Success: false,
		Error:   "Binding site analysis service not implemented. Please configure bioinformatics processing pipeline.",
	})
}

// ProcessStructure processes protein structure for a workflow
func (h *WorkflowHandler) ProcessStructure(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}
	workflowID := c.Param("id")

	var req struct {
		PDBContent string `json:"pdb_content"`
		ProteinID  string `json:"protein_id"`
		PDBId      string `json:"pdbId"`
		Stage      string `json:"stage"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Use PDBId if provided (from frontend), otherwise use ProteinID
	pdbId := req.PDBId
	if pdbId == "" {
		pdbId = req.ProteinID
	}

	if pdbId == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "PDB ID is required",
		})
		return
	}

	// Verify workflow exists and belongs to user
	var workflow models.Workflow
	err := h.db.QueryRow(`
		SELECT id, status FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(&workflow.ID, &workflow.Status)

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
			Error:   "Failed to access workflow",
		})
		return
	}

	// Call BioAPI service for structure processing
	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	// Prepare request for BioAPI - match the StructureRequest schema
	bioapiReq := map[string]interface{}{
		"pdb_id": pdbId,
		"structure_data": nil, // Optional field, can be null
	}

	reqBody, err := json.Marshal(bioapiReq)
	if err != nil {
		log.Printf("failed to marshal BioAPI request: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to prepare structure processing request",
		})
		return
	}

	// Make request to BioAPI
	endpoint := fmt.Sprintf("%s/api/v1/workflows/%s/structure", bioapiURL, workflowID)
	
	resp, err := http.Post(
		endpoint,
		"application/json",
		strings.NewReader(string(reqBody)),
	)
	if err != nil {
		log.Printf("BioAPI request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to structure processing service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// Read BioAPI response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("failed to read BioAPI response: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to read structure processing response",
		})
		return
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("BioAPI error - status: %d", resp.StatusCode)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   fmt.Sprintf("Structure processing service error (Status %d): %s", resp.StatusCode, string(body)),
		})
		return
	}

	// Parse BioAPI response
	var bioapiResponse map[string]interface{}
	if err := json.Unmarshal(body, &bioapiResponse); err != nil {
		log.Printf("failed to parse BioAPI response: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to parse structure processing response: " + err.Error(),
		})
		return
	}

	// Update workflow with results
	resultsJSON, err := json.Marshal(bioapiResponse)
	if err != nil {
		log.Printf("failed to serialize results: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to serialize results",
		})
		return
	}

	_, err = h.db.Exec(`
		UPDATE workflows 
		SET results = $1, status = $2, updated_at = NOW()
		WHERE id = $3 AND user_id = $4
	`, string(resultsJSON), models.StatusStructureProcessed, workflowID, userID)

	if err != nil {
		log.Printf("failed to update workflow with results: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to update workflow with results: " + err.Error(),
		})
		return
	}

	// Return success response with results
	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Data:    bioapiResponse,
	})
}

// GetWorkflowBindingSites returns binding sites for a workflow
func (h *WorkflowHandler) GetWorkflowBindingSites(c *gin.Context) {
	userID, _ := c.Get("user_id")
	workflowID := c.Param("id")

	var workflow models.Workflow
	var results sql.NullString
	
	err := h.db.QueryRow(`
		SELECT id, user_id, name, results
		FROM workflows 
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID).Scan(
		&workflow.ID, &workflow.UserID, &workflow.Name, &results,
	)

	// Convert sql.NullString to *string
	if results.Valid {
		workflow.Results = &results.String
	}

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
			Error:   "Failed to fetch binding sites",
		})
		return
	}

	// Parse binding sites from workflow results
	resultsStr := ""
	if workflow.Results != nil {
		resultsStr = *workflow.Results
	}

	if resultsStr == "" {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{
			Success: false,
			Error:   "No binding site analysis results available for this workflow",
		})
		return
	}

	// Return the actual results from the database
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"results": resultsStr,
		"workflow_id": workflowID,
	})
}

// GetWorkflowTemplates returns available workflow templates
func (h *WorkflowHandler) GetWorkflowTemplates(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, dto.ErrorResponse{
		Success: false,
		Error:   "Workflow templates service not implemented. Please configure template management system.",
	})
}

// VirtualScreening proxies virtual screening requests to BioAPI
func (h *WorkflowHandler) VirtualScreening(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Failed to read request body"})
		return
	}

	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	endpoint := fmt.Sprintf("%s/api/v1/screening/virtual-screening", bioapiURL)
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("BioAPI virtual screening request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to virtual screening service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to read virtual screening response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to parse virtual screening response"})
		return
	}

	c.JSON(resp.StatusCode, result)
}

// VinaDocking proxies real Vina molecular docking requests to BioAPI
func (h *WorkflowHandler) VinaDocking(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Failed to read request body"})
		return
	}

	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	endpoint := fmt.Sprintf("%s/api/v1/screening/vina-docking", bioapiURL)
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("BioAPI Vina docking request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to Vina docking service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to read Vina docking response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to parse Vina docking response"})
		return
	}

	c.JSON(resp.StatusCode, result)
}

// MolecularDynamics proxies MD simulation requests to BioAPI
func (h *WorkflowHandler) MolecularDynamics(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Failed to read request body"})
		return
	}

	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	endpoint := fmt.Sprintf("%s/api/v1/simulation/molecular-dynamics", bioapiURL)
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("BioAPI MD simulation request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to MD simulation service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to read MD simulation response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to parse MD simulation response"})
		return
	}

	c.JSON(resp.StatusCode, result)
}

// AIDruggabilityScore proxies ML druggability scoring to BioAPI
func (h *WorkflowHandler) AIDruggabilityScore(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Failed to read request body"})
		return
	}

	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	endpoint := fmt.Sprintf("%s/api/v1/structure/binding-sites/ai-score", bioapiURL)
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("BioAPI AI scoring request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to AI scoring service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to read AI scoring response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to parse AI scoring response"})
		return
	}

	c.JSON(resp.StatusCode, result)
}

// LiteratureSearch proxies literature search requests to BioAPI
func (h *WorkflowHandler) LiteratureSearch(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Failed to read request body"})
		return
	}

	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	endpoint := fmt.Sprintf("%s/api/v1/literature/search", bioapiURL)
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("BioAPI literature search request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to literature search service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to read literature search response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to parse literature search response"})
		return
	}

	c.JSON(resp.StatusCode, result)
}

// DirectBindingAnalysis proxies binding site analysis requests to BioAPI
func (h *WorkflowHandler) DirectBindingAnalysis(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Success: false, Error: "Failed to read request body"})
		return
	}

	bioapiURL := os.Getenv("BIOAPI_URL")
	if bioapiURL == "" {
		bioapiURL = "http://localhost:8000"
	}

	endpoint := fmt.Sprintf("%s/api/v1/binding/direct-binding-analysis", bioapiURL)
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("BioAPI binding analysis request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to binding analysis service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to read binding analysis response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Success: false, Error: "Failed to parse binding analysis response"})
		return
	}

	c.JSON(resp.StatusCode, result)
}
