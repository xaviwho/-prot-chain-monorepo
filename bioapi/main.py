from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import json
import tempfile
from typing import Optional, Dict, Any

from structure_analysis import StructurePreparation
from binding_analysis import RealBindingSiteDetection

app = FastAPI(title="ProtChain BioAPI", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        print(f"Processing structure for workflow {workflow_id} with PDB ID: {request.pdb_id}")
        
        # Prepare structure using real analysis
        results = structure_prep.prepare_structure(request.pdb_id, request.structure_data)
        
        if not results:
            raise HTTPException(status_code=400, detail="Failed to process structure")
        
        # Format response for frontend compatibility
        response_data = {
            "workflow_id": workflow_id,
            "pdb_id": request.pdb_id,
            "details": {
                "descriptors": results
            },
            "status": "completed",
            "method": "real_protein_analysis"
        }
        
        print(f"Structure processing completed successfully for {request.pdb_id}")
        return AnalysisResponse(success=True, data=response_data)
        
    except Exception as e:
        print(f"Structure processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Structure processing failed: {str(e)}")

@app.post("/api/v1/structure/workflows/{workflow_id}/structure")
async def process_structure_direct(workflow_id: str, request: StructureRequest):
    """Direct structure processing without workflow dependency"""
    try:
        print(f"Direct structure processing for workflow {workflow_id} with PDB ID: {request.pdb_id}")
        
        # Prepare structure using real analysis
        results = structure_prep.prepare_structure(request.pdb_id, request.structure_data)
        
        if not results:
            raise HTTPException(status_code=400, detail="Failed to process structure")
        
        # Format response for frontend compatibility
        response_data = {
            "workflow_id": workflow_id,
            "pdb_id": request.pdb_id,
            "details": {
                "descriptors": results
            },
            "status": "completed",
            "method": "real_protein_analysis"
        }
        
        print(f"Direct structure processing completed successfully for {request.pdb_id}")
        return AnalysisResponse(success=True, data=response_data)
        
    except Exception as e:
        print(f"Direct structure processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Structure processing failed: {str(e)}")

# Binding site analysis endpoints
@app.post("/api/v1/binding/direct-binding-analysis")
async def analyze_binding_sites(request: BindingAnalysisRequest):
    """Analyze binding sites using real geometric detection"""
    try:
        print(f"Analyzing binding sites for PDB ID: {request.pdb_id}")
        
        # Perform real binding site detection
        results = binding_detector.detect_binding_sites(request.pdb_id, request.structure_data)
        
        if not results:
            raise HTTPException(status_code=400, detail="Failed to analyze binding sites")
        
        # Format response
        response_data = {
            "pdb_id": request.pdb_id,
            "binding_sites": results,
            "method": "real_geometric_cavity_detection",
            "status": "completed"
        }
        
        print(f"Binding site analysis completed for {request.pdb_id}: {len(results)} sites found")
        return AnalysisResponse(success=True, data=response_data)
        
    except Exception as e:
        print(f"Binding site analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Binding site analysis failed: {str(e)}")

@app.post("/api/v1/workflows/{workflow_id}/binding-sites")
async def analyze_workflow_binding_sites(workflow_id: str, request: BindingAnalysisRequest):
    """Analyze binding sites for workflow"""
    try:
        print(f"Analyzing binding sites for workflow {workflow_id} with PDB ID: {request.pdb_id}")
        
        # Perform real binding site detection
        results = binding_detector.detect_binding_sites(request.pdb_id, request.structure_data)
        
        if not results:
            raise HTTPException(status_code=400, detail="Failed to analyze binding sites")
        
        # Format response
        response_data = {
            "workflow_id": workflow_id,
            "pdb_id": request.pdb_id,
            "binding_sites": results,
            "method": "real_geometric_cavity_detection",
            "status": "completed"
        }
        
        print(f"Workflow binding site analysis completed for {request.pdb_id}: {len(results)} sites found")
        return AnalysisResponse(success=True, data=response_data)
        
    except Exception as e:
        print(f"Workflow binding site analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Binding site analysis failed: {str(e)}")

# File upload endpoint
@app.post("/api/v1/upload/structure")
async def upload_structure(file: UploadFile = File(...)):
    """Upload and analyze structure file"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdb") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Analyze uploaded structure
        results = structure_prep.prepare_structure_from_file(temp_file_path)
        
        # Clean up temp file
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
        
    except Exception as e:
        print(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
