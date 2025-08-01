package main

import (
	"log"
	"os"

	"protchain/internal/config"
	"protchain/internal/database"
	"protchain/internal/handlers"
	"protchain/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/rs/cors"
)

func main() {
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

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://*.protchain.bio", "https://protchain.bio"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})
	router.Use(func(ctx *gin.Context) {
		c.HandlerFunc(ctx.Writer, ctx.Request)
		ctx.Next()
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
			orgTeams := teams.Group("/organizations/:orgId/teams")
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
		port = "8080"
	}

	log.Printf("Starting ProtChain API server on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
