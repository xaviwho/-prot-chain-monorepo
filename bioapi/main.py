import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import tempfile
from typing import Optional, Dict, Any, List

from structure_analysis import StructurePreparation
from binding_analysis import RealBindingSiteDetection
from druggability_model import get_predictor
from literature_search import get_searcher
from virtual_screening import get_screener
from compound_parser import parse_csv, parse_sdf
from molecular_docking import get_docking_engine
from molecular_dynamics import get_md_engine
from lead_optimization import get_lead_optimizer

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

# --- Compound Parsing ---

@app.post("/api/v1/compounds/parse")
async def parse_compound_file(file: UploadFile = File(...)):
    """Parse a CSV or SDF compound file and compute molecular descriptors."""
    try:
        filename = (file.filename or "").lower()
        content = await file.read()

        if filename.endswith(".csv"):
            result = parse_csv(content.decode("utf-8", errors="replace"))
        elif filename.endswith(".sdf"):
            result = parse_sdf(content)
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload a .csv or .sdf file.",
            )

        logger.info(
            f"Compound parsing completed: {result['count']} compounds, "
            f"{len(result['warnings'])} warnings"
        )
        return AnalysisResponse(success=True, data=result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compound parsing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Compound parsing failed: {str(e)}")


# --- AI Druggability Scoring ---

class AIDruggabilityRequest(BaseModel):
    binding_sites: List[Dict[str, Any]]
    pdb_id: Optional[str] = None

@app.post("/api/v1/structure/binding-sites/ai-score")
async def ai_druggability_score(request: AIDruggabilityRequest):
    """ML-enhanced druggability scoring for binding sites."""
    try:
        if not request.binding_sites:
            raise HTTPException(status_code=400, detail="binding_sites list is required")

        predictor = get_predictor()
        predictions = predictor.predict(request.binding_sites)

        logger.info(f"AI druggability scoring completed for {len(request.binding_sites)} sites")
        return AnalysisResponse(
            success=True,
            data={
                "predictions": predictions,
                "pdb_id": request.pdb_id,
                "model": "GradientBoostingRegressor",
                "feature_count": 8,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI druggability scoring error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI scoring failed: {str(e)}")


# --- Literature Search ---

class LiteratureSearchRequest(BaseModel):
    pdb_id: str
    protein_name: Optional[str] = None

@app.post("/api/v1/literature/search")
async def literature_search(request: LiteratureSearchRequest):
    """Search PubMed, UniProt, and RCSB PDB for protein research context."""
    try:
        if not request.pdb_id:
            raise HTTPException(status_code=400, detail="pdb_id is required")

        searcher = get_searcher()
        results = searcher.search_all(request.pdb_id, request.protein_name)

        logger.info(
            f"Literature search completed for {request.pdb_id}: "
            f"{results.get('total_papers', 0)} papers found"
        )
        return AnalysisResponse(success=True, data=results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Literature search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Literature search failed: {str(e)}")


# --- Virtual Screening ---

class VirtualScreeningRequest(BaseModel):
    workflow_id: Optional[str] = None
    binding_site: Dict[str, Any]
    pdb_content: Optional[str] = None
    compound_library: Optional[str] = "fda_approved"
    max_compounds: Optional[int] = 50
    custom_compounds: Optional[List[Dict[str, Any]]] = None

@app.post("/api/v1/screening/virtual-screening")
async def virtual_screening(request: VirtualScreeningRequest):
    """Run virtual screening against a binding site pocket."""
    try:
        if not request.binding_site:
            raise HTTPException(status_code=400, detail="binding_site is required")

        screener = get_screener()
        results = screener.screen(
            binding_site=request.binding_site,
            pdb_content=request.pdb_content,
            compound_library=request.compound_library or "fda_approved",
            max_compounds=request.max_compounds or 50,
            custom_compounds=request.custom_compounds,
        )

        logger.info(
            f"Virtual screening completed: {results['compounds_screened']} screened, "
            f"{results['hits_found']} hits"
        )
        return AnalysisResponse(success=True, data=results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Virtual screening error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Virtual screening failed: {str(e)}")


# --- Vina Molecular Docking ---

class VinaDockingRequest(BaseModel):
    workflow_id: Optional[str] = None
    binding_site: Dict[str, Any]
    pdb_content: str
    compound_library: Optional[str] = "fda_approved"
    max_compounds: Optional[int] = 50
    custom_compounds: Optional[List[Dict[str, Any]]] = None

@app.post("/api/v1/screening/vina-docking")
async def vina_docking(request: VinaDockingRequest):
    """Run real molecular docking using AutoDock Vina with parallel batch processing."""
    try:
        if not request.binding_site:
            raise HTTPException(status_code=400, detail="binding_site is required")
        if not request.pdb_content:
            raise HTTPException(status_code=400, detail="pdb_content (PDB file content) is required")

        # Build compound list from library or custom compounds
        if request.custom_compounds:
            compounds = request.custom_compounds
        else:
            from virtual_screening import _get_library
            library_name = request.compound_library or "fda_approved"
            library = _get_library(library_name)
            compounds = [
                {
                    "name": c.name,
                    "smiles": c.smiles,
                    "molecular_weight": c.molecular_weight,
                    "logp": c.logp,
                    "category": c.category,
                    "hbd": c.hbd,
                    "hba": c.hba,
                    "rotatable_bonds": c.rotatable_bonds,
                    "tpsa": c.tpsa,
                    "lipinski_violations": sum([
                        1 if c.molecular_weight > 500 else 0,
                        1 if c.logp > 5 else 0,
                        1 if c.hbd > 5 else 0,
                        1 if c.hba > 10 else 0,
                    ]),
                }
                for c in library
            ]

        engine = get_docking_engine()
        results = engine.dock_batch(
            pdb_content=request.pdb_content,
            binding_site=request.binding_site,
            compounds=compounds,
            max_compounds=request.max_compounds or 50,
        )

        logger.info(
            f"Vina docking completed: {results['compounds_docked']} docked, "
            f"{results['hits_found']} hits in {results['total_docking_time_seconds']}s"
        )
        return AnalysisResponse(success=True, data=results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vina docking error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Vina docking failed: {str(e)}")


# --- Molecular Dynamics Simulation ---

class MDSimulationRequest(BaseModel):
    workflow_id: Optional[str] = None
    binding_site: Dict[str, Any]
    pdb_content: str
    top_compounds: List[Dict[str, Any]]
    temperature: Optional[float] = 300.0
    n_steps: Optional[int] = 5000
    max_compounds: Optional[int] = 10

@app.post("/api/v1/simulation/molecular-dynamics")
async def molecular_dynamics(request: MDSimulationRequest):
    """Run molecular dynamics stability simulation for top compounds."""
    try:
        if not request.binding_site:
            raise HTTPException(status_code=400, detail="binding_site is required")
        if not request.pdb_content:
            raise HTTPException(status_code=400, detail="pdb_content (PDB file content) is required")
        if not request.top_compounds:
            raise HTTPException(status_code=400, detail="top_compounds list is required")

        engine = get_md_engine()
        results = engine.simulate(
            pdb_content=request.pdb_content,
            binding_site=request.binding_site,
            top_compounds=request.top_compounds,
            temperature=request.temperature or 300.0,
            n_steps=request.n_steps or 5000,
            max_compounds=request.max_compounds or 10,
        )

        logger.info(
            f"MD simulation completed: {results['compounds_simulated']} compounds, "
            f"{results['stable_compounds']} stable in {results['total_computation_time_seconds']}s"
        )
        return AnalysisResponse(success=True, data=results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MD simulation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MD simulation failed: {str(e)}")


# --- Lead Optimization ---

class LeadOptimizationRequest(BaseModel):
    workflow_id: Optional[str] = None
    compounds: List[Dict[str, Any]]
    max_compounds: Optional[int] = 20
    enable_mmp: Optional[bool] = True
    enable_rgroup: Optional[bool] = True
    enable_bioisosteres: Optional[bool] = True
    enable_pareto: Optional[bool] = True
    enable_analogs: Optional[bool] = True
    enable_pharmacophore: Optional[bool] = True

@app.post("/api/v1/optimization/lead-optimization")
async def lead_optimization(request: LeadOptimizationRequest):
    """Run lead optimization analysis on compounds from MD/screening stages."""
    try:
        if not request.compounds:
            raise HTTPException(status_code=400, detail="compounds list is required")

        optimizer = get_lead_optimizer()
        results = optimizer.optimize(
            compounds=request.compounds,
            max_compounds=request.max_compounds or 20,
            enable_mmp=request.enable_mmp,
            enable_rgroup=request.enable_rgroup,
            enable_bioisosteres=request.enable_bioisosteres,
            enable_pareto=request.enable_pareto,
            enable_analogs=request.enable_analogs,
            enable_pharmacophore=request.enable_pharmacophore,
        )

        logger.info(
            f"Lead optimization completed: {results['compounds_analyzed']} analyzed, "
            f"{results['advance_count']} ready to advance in {results['total_computation_time_seconds']}s"
        )
        return AnalysisResponse(success=True, data=results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lead optimization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lead optimization failed: {str(e)}")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
