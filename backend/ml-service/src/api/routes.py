from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

from services.ml_service import MLService
from services.inference_service import InferenceService
from models.confidence_scorer import ConfidenceFeatures

logger = logging.getLogger(__name__)

router = APIRouter()

ml_service: Optional[MLService] = None
inference_service: Optional[InferenceService] = None

def get_ml_service() -> MLService:
    from main import ml_service as service
    if service is None:
        raise HTTPException(status_code=503, detail="ML Service not initialized")
    return service

class EventAnalysisRequest(BaseModel):
    event_id: str
    description: str
    category: str
    sources: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None

class ConfidenceScoreRequest(BaseModel):
    event_id: str
    source_count: int
    avg_credibility: float
    source_diversity: int
    consensus_percentage: float
    conflict_count: int
    time_since_event_hours: float
    category_confidence: float
    historical_accuracy: float
    data_consistency_score: float
    social_sentiment: float

class ClassificationRequest(BaseModel):
    description: str
    sources: List[Dict[str, Any]]

class AnalysisResponse(BaseModel):
    event_id: str
    confidence_score: float
    classification: Dict[str, Any]
    recommendation: str
    predicted_outcome: Optional[Any] = None
    outcome_hash: Optional[str] = None
    evidence_uri: Optional[str] = None

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_event(request: EventAnalysisRequest):
    try:
        logger.info(f"Analyzing event: {request.event_id}")
        
        service = get_ml_service()
        
        classification = await service.classify_event(
            request.description,
            request.sources
        )
        
        features = service.extract_features(
            request.sources,
            classification,
            request.metadata or {}
        )
        
        confidence_result = service.calculate_confidence(features)
        
        return AnalysisResponse(
            event_id=request.event_id,
            confidence_score=confidence_result['confidence_score'],
            classification=classification,
            recommendation=confidence_result['recommendation'],
            predicted_outcome=None,
            outcome_hash=None,
            evidence_uri=None
        )
    
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/classify")
async def classify_event(request: ClassificationRequest):
    try:
        logger.info("Classifying event")
        
        service = get_ml_service()
        result = await service.classify_event(request.description, request.sources)
        
        return result
    
    except Exception as e:
        logger.error(f"Classification failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/confidence")
async def calculate_confidence(request: ConfidenceScoreRequest):
    try:
        logger.info(f"Calculating confidence for event: {request.event_id}")
        
        service = get_ml_service()
        
        features = ConfidenceFeatures(
            source_count=request.source_count,
            avg_credibility=request.avg_credibility,
            source_diversity=request.source_diversity,
            consensus_percentage=request.consensus_percentage,
            conflict_count=request.conflict_count,
            time_since_event_hours=request.time_since_event_hours,
            category_confidence=request.category_confidence,
            historical_accuracy=request.historical_accuracy,
            data_consistency_score=request.data_consistency_score,
            social_sentiment=request.social_sentiment,
        )
        
        result = service.calculate_confidence(features)
        result['event_id'] = request.event_id
        
        return result
    
    except Exception as e:
        logger.error(f"Confidence calculation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-analyze")
async def batch_analyze(requests: List[EventAnalysisRequest], background_tasks: BackgroundTasks):
    try:
        logger.info(f"Batch analyzing {len(requests)} events")
        
        results = []
        for req in requests:
            try:
                result = await analyze_event(req)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to analyze event {req.event_id}: {str(e)}")
                results.append({
                    "event_id": req.event_id,
                    "error": str(e)
                })
        
        return {"results": results, "total": len(requests), "successful": len([r for r in results if "error" not in r])}
    
    except Exception as e:
        logger.error(f"Batch analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/status")
async def get_model_status():
    try:
        service = get_ml_service()
        
        return {
            "xgb_model": "loaded",
            "nn_model": "loaded",
            "device": str(service.scorer.device),
            "status": "healthy"
        }
    
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))