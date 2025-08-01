package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment     string
	DatabaseURL     string
	JWTSecret      string
	Port           string
	CORSOrigins    []string
	BioapiURL      string
	IPFSEndpoint   string
	BlockchainRPC  string
}

func Load() *Config {
	return &Config{
		Environment:    getEnv("ENVIRONMENT", "development"),
		DatabaseURL:    getEnv("DATABASE_URL", "./protchain.db"),
		JWTSecret:     getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		Port:          getEnv("PORT", "8080"),
		CORSOrigins:   []string{
			getEnv("FRONTEND_URL", "http://localhost:3000"),
			"https://*.protchain.bio",
			"https://protchain.bio",
		},
		BioapiURL:     getEnv("BIOAPI_URL", "http://localhost:8000"),
		IPFSEndpoint:  getEnv("IPFS_ENDPOINT", "http://localhost:5001"),
		BlockchainRPC: getEnv("BLOCKCHAIN_RPC", "https://purechainnode.com:8547"),
	}
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
