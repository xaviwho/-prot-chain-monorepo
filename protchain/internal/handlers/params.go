package handlers

import (
	"net/http"
	"strconv"

	"protchain/internal/dto"

	"github.com/gin-gonic/gin"
)

// parseIDParam extracts a named URL parameter, validates it is a positive
// integer, and returns it.  On failure it writes a 400 response and returns
// (0, false) so the caller can simply `return`.
func parseIDParam(c *gin.Context, name string) (int, bool) {
	raw := c.Param(name)
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Success: false,
			Error:   "Invalid " + name + " parameter: must be a positive integer",
		})
		return 0, false
	}
	return id, true
}
