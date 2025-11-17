import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseSettings
import logging
from pathlib import Path

from api.routes import router
from services.ml_service import MLService

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    APP_NAME: str = "PredictLink ML Service"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "*"
    
    XGB_MODEL_PATH: str = "models/xgboost/confidence_model.json"
    NN_MODEL_PATH: str = "models/neural/confidence_model.pt"
    
    class Config:
        env_file = ".env"

settings = Settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ml_service = None

@app.on_event("startup")
async def startup_event():
    global ml_service
    logger.info("Initializing ML Service...")
    
    try:
        ml_service = MLService(
            xgb_model_path=settings.XGB_MODEL_PATH,
            nn_model_path=settings.NN_MODEL_PATH,
        )
        logger.info("ML Service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize ML Service: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down ML Service...")

@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.VERSION
    }

app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )