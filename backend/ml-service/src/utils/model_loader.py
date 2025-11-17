from typing import Dict, Any, Optional
import numpy as np
import logging

logger = logging.getLogger(__name__)

class ModelLoader:
    @staticmethod
    def load_xgboost(path: str):
        import xgboost as xgb
        model = xgb.XGBRegressor()
        model.load_model(path)
        return model
    
    @staticmethod
    def load_pytorch(path: str, device: str = 'cpu'):
        import torch
        model = torch.load(path, map_location=device)
        model.eval()
        return model

class FeatureValidator:
    @staticmethod
    def validate_features(features: Dict[str, float]) -> bool:
        required_fields = [
            'source_count',
            'avg_credibility',
            'source_diversity',
            'consensus_percentage',
            'conflict_count',
            'time_since_event_hours',
            'category_confidence',
            'historical_accuracy',
            'data_consistency_score',
            'social_sentiment',
        ]
        
        for field in required_fields:
            if field not in features:
                logger.error(f"Missing required field: {field}")
                return False
            
            value = features[field]
            if not isinstance(value, (int, float)):
                logger.error(f"Invalid type for field {field}: {type(value)}")
                return False
            
            if np.isnan(value) or np.isinf(value):
                logger.error(f"Invalid value for field {field}: {value}")
                return False
        
        return True
    
    @staticmethod
    def normalize_features(features: Dict[str, float]) -> Dict[str, float]:
        normalized = features.copy()
        
        for key, value in normalized.items():
            if value < 0:
                normalized[key] = 0.0
            elif key in ['avg_credibility', 'consensus_percentage', 'category_confidence', 
                         'historical_accuracy', 'data_consistency_score', 'social_sentiment']:
                if value > 1.0:
                    normalized[key] = 1.0
        
        return normalized