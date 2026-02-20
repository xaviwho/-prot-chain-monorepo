package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// parsePagination extracts page and per_page from query params.
// Defaults: page=1, perPage=20. Max perPage=100.
func parsePagination(c *gin.Context) (page, perPage, offset int) {
	page = 1
	perPage = 20

	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if pp := c.Query("per_page"); pp != "" {
		if v, err := strconv.Atoi(pp); err == nil && v > 0 && v <= 100 {
			perPage = v
		}
	}

	offset = (page - 1) * perPage
	return
}

func totalPages(total, perPage int) int {
	if perPage <= 0 {
		return 0
	}
	return (total + perPage - 1) / perPage
}
