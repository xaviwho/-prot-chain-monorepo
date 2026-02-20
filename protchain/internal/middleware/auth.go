package middleware

import (
	"log"
	"net/http"
	"strings"

	"protchain/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Success: false, Error: "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Success: false, Error: "Bearer token required"})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Success: false, Error: "Invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Success: false, Error: "Invalid token claims"})
			c.Abort()
			return
		}

		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			log.Printf("AuthMiddleware: user_id claim is not a number")
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Success: false, Error: "Invalid token: missing user_id"})
			c.Abort()
			return
		}

		email, ok := claims["email"].(string)
		if !ok {
			log.Printf("AuthMiddleware: email claim is not a string")
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Success: false, Error: "Invalid token: missing email"})
			c.Abort()
			return
		}

		c.Set("user_id", int(userIDFloat))
		c.Set("email", email)
		c.Next()
	}
}
