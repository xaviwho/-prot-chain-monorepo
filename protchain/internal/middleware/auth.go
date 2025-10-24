package middleware

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("AuthMiddleware: Processing request to %s %s", c.Request.Method, c.Request.URL.Path)
		secretPreview := jwtSecret
		if len(jwtSecret) > 10 {
			secretPreview = jwtSecret[:10] + "..."
		}
		log.Printf("AuthMiddleware: Using JWT secret: %s", secretPreview)
		
		authHeader := c.GetHeader("Authorization")
		log.Printf("AuthMiddleware: Authorization header: %s", authHeader)
		
		if authHeader == "" {
			log.Printf("AuthMiddleware: No Authorization header found")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			log.Printf("AuthMiddleware: Invalid Bearer token format")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
			c.Abort()
			return
		}
		
		tokenPreview := tokenString
		if len(tokenString) > 20 {
			tokenPreview = tokenString[:20] + "..."
		}
		log.Printf("AuthMiddleware: Token string: %s", tokenPreview)

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			log.Printf("AuthMiddleware: Invalid token: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			log.Printf("AuthMiddleware: Valid token received. Claims: %+v", claims)
			userID := int(claims["user_id"].(float64))
			email := claims["email"].(string)
			log.Printf("AuthMiddleware: Extracted user_id: %d, email: %s", userID, email)
			c.Set("user_id", userID)
			c.Set("email", email)
		} else {
			log.Printf("AuthMiddleware: Invalid token claims type: %T", token.Claims)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		c.Next()
	}
}
