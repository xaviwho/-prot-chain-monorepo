import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import tempfile
from typing import Optional, Dict, Any

from structure_analysis import StructurePreparation
from binding_analysis import RealBindingSiteDetection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ProtChain BioAPI", version="1.0.0")

# Configure CORS from environment variable
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8082").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize analysis modules
structure_prep = StructurePreparation()
binding_detector = RealBindingSiteDetection()

# Request/Response models
class StructureRequest(BaseModel):
    pdb_id: str
    structure_data: Optional[str] = None

class BindingAnalysisRequest(BaseModel):
    pdb_id: str
    structure_data: Optional[str] = None

class AnalysisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "ProtChain BioAPI", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bioapi"}

# Structure analysis endpoints
@app.post("/api/v1/workflows/{workflow_id}/structure")
async def process_structure(workflow_id: str, request: StructureRequest):
    """Process protein structure for workflow"""
    try:
        logger.info(f"Processing structure for workflow {workflow_id} with PDB ID: {request.pdb_id}")

        results = structure_prep.prepare_structure(request.pdb_id, request.structure_data)

        if not results:
            raise HTTPException(status_code=400, detail="Failed to process structure")

        response_data = {
            "workflow_id": workflow_id,
            "pdb_id": request.pdb_id,
            "details": {
                "descriptors": results
            },
            "status": "completed",
            "method": "real_protein_analysis"
        }

        logger.info(f"Structure processing completed for {request.pdb_id}")
        return AnalysisResponse(success=True, data=response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Structure processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Structure processing failed: {str(e)}")

@app.post("/api/v1/structure/workflows/{workflow_id}/structure")
async def process_structure_direct(workflow_id: str, request: StructureRequest):
    """Direct structure processing without workflow dependency"""
    return await process_structure(workflow_id, request)

# Binding site analysis endpoints
@app.post("/api/v1/binding/direct-binding-analysis")
async def analyze_binding_sites(request: BindingAnalysisRequest):
    """Analyze binding sites using real geometric detection"""
    try:
        logger.info(f"Analyzing binding sites for PDB ID: {request.pdb_id}")

        results = binding_detector.detect_binding_sites(request.pdb_id, request.structure_data)

        if not results:
            raise HTTPException(status_code=400, detail="Failed to analyze binding sites")

        response_data = {
            "pdb_id": request.pdb_id,
            "binding_sites": results,
            "method": "real_geometric_cavity_detection",
            "status": "completed"
        }

        logger.info(f"Binding site analysis completed for {request.pdb_id}: {len(results)} sites found")
        return AnalysisResponse(success=True, data=response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Binding site analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Binding site analysis failed: {str(e)}")

@app.post("/api/v1/structure/binding-sites/detect")
async def detect_binding_sites(request: BindingAnalysisRequest):
    """Direct binding site detection endpoint"""
    try:
        logger.info(f"Binding site detection for PDB ID: {request.pdb_id}")

        results = binding_detector.detect_binding_sites(request.pdb_id, request.structure_data)

        if not results:
            return {"binding_sites": [], "pdb_id": request.pdb_id, "method": "geometric_cavity_detection"}

        return {
            "binding_sites": results,
            "pdb_id": request.pdb_id,
            "method": "geometric_cavity_detection",
            "total_sites": len(results)
        }

    except Exception as e:
        logger.error(f"Binding site detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Binding site detection failed: {str(e)}")

@app.post("/api/v1/workflows/{workflow_id}/binding-sites")
async def analyze_workflow_binding_sites(workflow_id: str, request: BindingAnalysisRequest):
    """Analyze binding sites for workflow"""
    try:
        logger.info(f"Analyzing binding sites for workflow {workflow_id} with PDB ID: {request.pdb_id}")

        results = binding_detector.detect_binding_sites(request.pdb_id, request.structure_data)

        if not results:
            raise HTTPException(status_code=400, detail="Failed to analyze binding sites")

        response_data = {
            "workflow_id": workflow_id,
            "pdb_id": request.pdb_id,
            "binding_sites": results,
            "method": "real_geometric_cavity_detection",
            "status": "completed"
        }

        logger.info(f"Workflow binding site analysis completed for {request.pdb_id}: {len(results)} sites found")
        return AnalysisResponse(success=True, data=response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Workflow binding site analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Binding site analysis failed: {str(e)}")

# File upload endpoint
@app.post("/api/v1/upload/structure")
async def upload_structure(file: UploadFile = File(...)):
    """Upload and analyze structure file"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdb") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        results = structure_prep.prepare_structure_from_file(temp_file_path)

        os.unlink(temp_file_path)

        if not results:
            raise HTTPException(status_code=400, detail="Failed to process uploaded structure")

        response_data = {
            "filename": file.filename,
            "details": {
                "descriptors": results
            },
            "status": "completed",
            "method": "real_protein_analysis"
        }

        return AnalysisResponse(success=True, data=response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
