package config

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Environment  string
	DatabaseURL  string
	JWTSecret    string
	Port         string
	CORSOrigins  []string
	BioapiURL    string
	IPFSEndpoint string
	BlockchainRPC string

	// DB connection pool
	DBMaxOpenConns       int
	DBMaxIdleConns       int
	DBConnMaxLifetimeSec int

	// HTTP server timeouts (seconds)
	HTTPReadTimeout  int
	HTTPWriteTimeout int
	HTTPIdleTimeout  int

	// Rate limiting
	RateLimitRPS   float64
	RateLimitBurst int
}

func Load() *Config {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Println("WARNING: JWT_SECRET not set. Generating a random secret for this session. Set JWT_SECRET in production.")
		bytes := make([]byte, 32)
		rand.Read(bytes)
		jwtSecret = hex.EncodeToString(bytes)
	}

	cfg := &Config{
		Environment:   getEnv("ENVIRONMENT", "development"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/protchain?sslmode=disable"),
		JWTSecret:     jwtSecret,
		Port:          getEnv("PORT", "8082"),
		CORSOrigins: []string{
			getEnv("FRONTEND_URL", "http://localhost:3000"),
			"https://protchain.bio",
			"https://protchain.co",
			"https://prot-chain-monorepo-gqv.onrender.com",
		},
		BioapiURL:     getEnv("BIOAPI_URL", "http://localhost:8000"),
		IPFSEndpoint:  getEnv("IPFS_ENDPOINT", "http://localhost:5001"),
		BlockchainRPC: getEnv("BLOCKCHAIN_RPC", "https://purechainnode.com:8547"),

		DBMaxOpenConns:       getEnvInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:       getEnvInt("DB_MAX_IDLE_CONNS", 5),
		DBConnMaxLifetimeSec: getEnvInt("DB_CONN_MAX_LIFETIME_SEC", 300),

		HTTPReadTimeout:  getEnvInt("HTTP_READ_TIMEOUT_SEC", 15),
		HTTPWriteTimeout: getEnvInt("HTTP_WRITE_TIMEOUT_SEC", 15),
		HTTPIdleTimeout:  getEnvInt("HTTP_IDLE_TIMEOUT_SEC", 60),

		RateLimitRPS:   float64(getEnvInt("RATE_LIMIT_RPS", 100)),
		RateLimitBurst: getEnvInt("RATE_LIMIT_BURST", 200),
	}

	// Append extra CORS origins from environment
	if extra := os.Getenv("CORS_EXTRA_ORIGINS"); extra != "" {
		for _, origin := range strings.Split(extra, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				cfg.CORSOrigins = append(cfg.CORSOrigins, origin)
			}
		}
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
