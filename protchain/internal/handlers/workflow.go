package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
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

	rows, err := h.db.Query(`
		SELECT id, user_id, name, description, status, results, blockchain_tx_hash, ipfs_hash, 
		       blockchain_committed_at, created_at, updated_at, team_id
		FROM workflows 
		WHERE user_id = $1 
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		fmt.Printf("failed to list workflow information: %s", err)
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
		fmt.Println("Handling row")
		fmt.Println("row is: ", rows)
		var w models.Workflow
		err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.Description, &w.Status, &w.Results,
			&w.BlockchainTxHash, &w.IPFSHash, &w.BlockchainCommittedAt,
			&w.CreatedAt, &w.UpdatedAt, &w.TeamID)
		if err != nil {
			fmt.Printf("failed to scan workflow information: %s", err)
			continue
		}
		fmt.Printf("Workflow is: %v", w)

		// Handle pointer fields safely
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
	fmt.Printf("Workflows are: %v", workflows)

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Success: true,
		Data:    workflows,
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
	err := h.db.QueryRow(`SELECT team_id FROM team_members WHERE user_id = $1 AND role = 'owner'`, userID).Scan(&teamID)
	if err != nil && err != sql.ErrNoRows {
		fmt.Printf("Error selecting team id : %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to find user team",
		})
		return
	}

	err = h.db.QueryRow(`
		INSERT INTO workflows (user_id, team_id, name, description, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'draft', $5, $6)
		RETURNING id
	`, userID, teamID, req.Name, req.Description, time.Now(), time.Now()).Scan(&workflowID)

	if err != nil {
		fmt.Printf("Error creating workflow : %v", err)
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
		SET status = 'registered', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2
	`, workflowID, userID)

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
		"status": "registered",
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

	fmt.Printf("ProcessStructure: Using BioAPI URL: %s\n", bioapiURL)
	fmt.Printf("ProcessStructure: Processing PDB ID: %s\n", pdbId)

	// Prepare request for BioAPI - match the StructureRequest schema
	bioapiReq := map[string]interface{}{
		"pdb_id": pdbId,
		"structure_data": nil, // Optional field, can be null
	}

	reqBody, err := json.Marshal(bioapiReq)
	if err != nil {
		fmt.Printf("ProcessStructure: Failed to marshal request: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to prepare structure processing request",
		})
		return
	}

	fmt.Printf("ProcessStructure: Request body: %s\n", string(reqBody))

	// First check if BioAPI service is running
	healthResp, err := http.Get(bioapiURL + "/health")
	if err != nil {
		fmt.Printf("ProcessStructure: BioAPI health check failed: %v\n", err)
	} else {
		healthResp.Body.Close()
		fmt.Printf("ProcessStructure: BioAPI health check status: %d\n", healthResp.StatusCode)
	}

	// Make request to BioAPI - use the correct endpoint from OpenAPI spec
	endpoint := fmt.Sprintf("%s/api/v1/workflows/%s/structure", bioapiURL, workflowID)
	fmt.Printf("ProcessStructure: Calling endpoint: %s\n", endpoint)
	
	resp, err := http.Post(
		endpoint,
		"application/json",
		strings.NewReader(string(reqBody)),
	)
	if err != nil {
		fmt.Printf("ProcessStructure: HTTP request failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to connect to structure processing service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	fmt.Printf("ProcessStructure: BioAPI response status: %d\n", resp.StatusCode)

	// Read BioAPI response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("ProcessStructure: Failed to read response body: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to read structure processing response",
		})
		return
	}

	fmt.Printf("ProcessStructure: Response body: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("ProcessStructure: BioAPI error - Status: %d, Body: %s\n", resp.StatusCode, string(body))
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   fmt.Sprintf("Structure processing service error (Status %d): %s", resp.StatusCode, string(body)),
		})
		return
	}

	// Parse BioAPI response
	var bioapiResponse map[string]interface{}
	if err := json.Unmarshal(body, &bioapiResponse); err != nil {
		fmt.Printf("ProcessStructure: Failed to parse response: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to parse structure processing response: " + err.Error(),
		})
		return
	}

	// Update workflow with results
	resultsJSON, err := json.Marshal(bioapiResponse)
	if err != nil {
		fmt.Printf("ProcessStructure: Failed to serialize results: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to serialize results",
		})
		return
	}

	fmt.Printf("ProcessStructure: Updating workflow %s with results\n", workflowID)

	_, err = h.db.Exec(`
		UPDATE workflows 
		SET results = $1, status = 'structure_processed', updated_at = NOW()
		WHERE id = $2 AND user_id = $3
	`, string(resultsJSON), workflowID, userID)

	if err != nil {
		fmt.Printf("ProcessStructure: Database update failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Success: false,
			Error:   "Failed to update workflow with results: " + err.Error(),
		})
		return
	}

	fmt.Printf("ProcessStructure: Successfully processed structure for PDB ID: %s\n", pdbId)

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

// VirtualScreening performs virtual screening for drug discovery
func (h *WorkflowHandler) VirtualScreening(c *gin.Context) {
	var req struct {
		WorkflowID       string `json:"workflow_id"`
		BindingSite      interface{} `json:"binding_site"`
		PDBContent       string `json:"pdb_content"`
		CompoundLibrary  string `json:"compound_library"`
		MaxCompounds     int    `json:"max_compounds"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Validate required fields
	if req.WorkflowID == "" || req.PDBContent == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Missing required fields: workflow_id and pdb_content are required",
		})
		return
	}

	c.JSON(http.StatusNotImplemented, dto.ErrorResponse{
		Success: false,
		Error:   "Virtual screening service not implemented. Please configure molecular docking and compound screening pipeline.",
	})
}

// DirectBindingAnalysis performs direct binding site analysis
func (h *WorkflowHandler) DirectBindingAnalysis(c *gin.Context) {
	var req struct {
		PDBID         string `json:"pdb_id"`
		StructureData string `json:"structure_data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Validate required fields
	if req.StructureData == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Missing required field: structure_data is required",
		})
		return
	}

	c.JSON(http.StatusNotImplemented, dto.ErrorResponse{
		Success: false,
		Error:   "Direct binding analysis service not implemented. Please configure geometric cavity detection and druggability analysis pipeline.",
	})
}
