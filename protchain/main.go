package main

import (
	"log"

	"github.com/joho/godotenv"
	"os"

	"protchain/internal/config"
	"protchain/internal/database"
	"protchain/internal/handlers"
	"protchain/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.RunMigrations(db); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.Default()

	// Setup CORS middleware
	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		
		// Allow specific origins
		allowedOrigins := []string{
			"http://localhost:3000",
			"https://protchain.bio",
			"https://protchain.co",
			"https://prot-chain-monorepo-gqv.onrender.com",
		}
		
		// Check if origin is allowed
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}
		
		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Source, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		
		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	})

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "protchain-api"})
	})

	// API routes
	api := router.Group("/api/v1")
	
	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg.JWTSecret)
	workflowHandler := handlers.NewWorkflowHandler(db)
	teamHandler := handlers.NewTeamHandler(db)
	userHandler := handlers.NewUserHandler(db)

	// Auth routes (no middleware)
	auth := api.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
	}

	// Protected routes
	protected := api.Group("/")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		// User routes
		protected.GET("/users/me", userHandler.GetProfile)
		protected.PUT("/users/me", userHandler.UpdateProfile)
		protected.GET("/users/stats", userHandler.GetStats)

		// Workflow routes
		workflows := protected.Group("/workflows")
		{
			workflows.GET("", workflowHandler.ListWorkflows)
			workflows.POST("", workflowHandler.CreateWorkflow)
			workflows.GET("/:id", workflowHandler.GetWorkflow)
			workflows.PUT("/:id", workflowHandler.UpdateWorkflow)
			workflows.DELETE("/:id", workflowHandler.DeleteWorkflow)
			workflows.PUT("/:id/blockchain", workflowHandler.UpdateWorkflowBlockchainInfo)
			workflows.GET("/:id/pdb", workflowHandler.GetWorkflowPDB)
			
			// New workflow processing endpoints
			workflows.GET("/:id/status", workflowHandler.GetWorkflowStatus)
			workflows.GET("/:id/results", workflowHandler.GetWorkflowResults)
			workflows.POST("/:id/register", workflowHandler.RegisterWorkflow)
			workflows.GET("/:id/binding-sites", workflowHandler.GetWorkflowBindingSites)
			workflows.POST("/:id/binding-site-analysis", workflowHandler.StartBindingSiteAnalysis)
			workflows.POST("/:id/structure", workflowHandler.ProcessStructure)
			workflows.GET("/templates", workflowHandler.GetWorkflowTemplates)
		}

		// Bioinformatics processing routes
		screening := protected.Group("/screening")
		{
			screening.POST("/virtual-screening", workflowHandler.VirtualScreening)
		}

		binding := protected.Group("/binding")
		{
			binding.POST("/direct-binding-analysis", workflowHandler.DirectBindingAnalysis)
		}

		// Team management routes
		teams := protected.Group("/teams")
		{
			// Organizations
			orgs := teams.Group("/organizations")
			{
				orgs.GET("", teamHandler.ListOrganizations)
				orgs.POST("", teamHandler.CreateOrganization)
				orgs.GET("/:id", teamHandler.GetOrganization)
				orgs.PUT("/:id", teamHandler.UpdateOrganization)
				orgs.DELETE("/:id", teamHandler.DeleteOrganization)
				orgs.POST("/:id/invite", teamHandler.InviteToOrganization)
				orgs.GET("/:id/members", teamHandler.ListOrganizationMembers)
				orgs.DELETE("/:id/members/:userId", teamHandler.RemoveOrganizationMember)
			}

			// Teams within organizations
			orgTeams := teams.Group("/organizations/:id/teams")
			{
				orgTeams.GET("", teamHandler.ListTeams)
				orgTeams.POST("", teamHandler.CreateTeam)
				orgTeams.GET("/:teamId", teamHandler.GetTeam)
				orgTeams.PUT("/:teamId", teamHandler.UpdateTeam)
				orgTeams.DELETE("/:teamId", teamHandler.DeleteTeam)
				orgTeams.POST("/:teamId/members", teamHandler.AddTeamMember)
				orgTeams.DELETE("/:teamId/members/:userId", teamHandler.RemoveTeamMember)
			}

			// Invitations
			invitations := teams.Group("/invitations")
			{
				invitations.GET("", teamHandler.ListInvitations)
				invitations.POST("/:token/accept", teamHandler.AcceptInvitation)
				invitations.POST("/:token/decline", teamHandler.DeclineInvitation)
			}

			// Workflow sharing
			workflows := teams.Group("/workflows")
			{
				workflows.POST("/:id/share", teamHandler.ShareWorkflow)
				workflows.GET("/:id/permissions", teamHandler.GetWorkflowPermissions)
				workflows.PUT("/:id/permissions", teamHandler.UpdateWorkflowPermissions)
			}
		}
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"  // Default to 8082 to match frontend expectations
	}

	log.Printf("Starting ProtChain API server on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
