from pydantic import BaseModel, Field, validator
from typing import Optional

class ModelConfig(BaseModel):
    xgb_model_path: str = Field(default="models/xgboost/confidence_model.json")
    nn_model_path: str = Field(default="models/neural/confidence_model.pt")
    device: str = Field(default="cpu")
    cache_ttl: int = Field(default=300, ge=0)
    batch_size: int = Field(default=32, ge=1)
    
    @validator('device')
    def validate_device(cls, v):
        if v not in ['cpu', 'cuda']:
            raise ValueError('Device must be either cpu or cuda')
        return v

class ServiceConfig(BaseModel):
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000, ge=1, le=65535)
    debug: bool = Field(default=False)
    workers: int = Field(default=4, ge=1)
    log_level: str = Field(default="INFO")
    
    @validator('log_level')
    def validate_log_level(cls, v):
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in valid_levels:
            raise ValueError(f'Log level must be one of {valid_levels}')
        return v.upper()
