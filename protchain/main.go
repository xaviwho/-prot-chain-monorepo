package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

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

	// Initialize database with connection pool settings
	db, err := database.Initialize(cfg.DatabaseURL, cfg.DBMaxOpenConns, cfg.DBMaxIdleConns, cfg.DBConnMaxLifetimeSec)
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

	// CORS middleware — origins driven by config
	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		allowed := false
		for _, allowedOrigin := range cfg.CORSOrigins {
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

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Rate limiting middleware
	router.Use(middleware.RateLimitMiddleware(cfg.RateLimitRPS, cfg.RateLimitBurst))

	// Health check with DB probe
	router.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := db.PingContext(ctx); err != nil {
			log.Printf("Health check failed: DB ping error: %v", err)
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":  "unhealthy",
				"service": "protchain-api",
				"error":   "database unreachable",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "protchain-api",
		})
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

			invitations := teams.Group("/invitations")
			{
				invitations.GET("", teamHandler.ListInvitations)
				invitations.POST("/:token/accept", teamHandler.AcceptInvitation)
				invitations.POST("/:token/decline", teamHandler.DeclineInvitation)
			}

			workflows := teams.Group("/workflows")
			{
				workflows.POST("/:id/share", teamHandler.ShareWorkflow)
				workflows.GET("/:id/permissions", teamHandler.GetWorkflowPermissions)
				workflows.PUT("/:id/permissions", teamHandler.UpdateWorkflowPermissions)
			}
		}
	}

	// HTTP server with timeouts
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.HTTPReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.HTTPWriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(cfg.HTTPIdleTimeout) * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Starting ProtChain API server on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited cleanly")
}
