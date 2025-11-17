from typing import Dict, List, Any, Optional
import logging
import numpy as np
from datetime import datetime

from models.confidence_scorer import EnsembleConfidenceScorer, ConfidenceFeatures
from models.event_classifier import EventClassifier
from models.fraud_detector import FraudDetector

logger = logging.getLogger(__name__)

class MLService:
    def __init__(
        self,
        xgb_model_path: Optional[str] = None,
        nn_model_path: Optional[str] = None,
        device: str = 'cpu'
    ):
        logger.info("Initializing ML Service components...")
        
        self.scorer = EnsembleConfidenceScorer(
            xgb_model_path=xgb_model_path,
            nn_model_path=nn_model_path,
            device=device
        )
        
        self.classifier = EventClassifier()
        self.fraud_detector = FraudDetector()
        
        logger.info("ML Service initialized successfully")
    
    async def classify_event(
        self,
        description: str,
        sources: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            classification = self.classifier.classify(description)
            
            source_types = [s.get('type', 'unknown') for s in sources]
            source_diversity = len(set(source_types))
            
            avg_credibility = np.mean([s.get('credibility', 0.5) for s in sources])
            
            time_sensitivity = self._determine_time_sensitivity(classification['primaryCategory'])
            objectivity = self._determine_objectivity(classification['primaryCategory'])
            
            return {
                'primaryCategory': classification['primaryCategory'],
                'subcategory': classification['subcategory'],
                'confidence': classification['confidence'],
                'timeSensitivity': time_sensitivity,
                'objectivity': objectivity,
                'recommendedAction': classification['recommendedAction'],
                'sourceDiversity': source_diversity,
                'avgCredibility': avg_credibility,
            }
        
        except Exception as e:
            logger.error(f"Classification failed: {str(e)}", exc_info=True)
            raise
    
    def extract_features(
        self,
        sources: List[Dict[str, Any]],
        classification: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> ConfidenceFeatures:
        source_count = len(sources)
        avg_credibility = np.mean([s.get('credibility', 0.5) for s in sources])
        
        source_types = [s.get('type', 'unknown') for s in sources]
        source_diversity = len(set(source_types))
        
        outcomes = [s.get('data', {}).get('outcome') for s in sources if 'outcome' in s.get('data', {})]
        if outcomes:
            most_common = max(set(outcomes), key=outcomes.count)
            consensus_percentage = outcomes.count(most_common) / len(outcomes)
        else:
            consensus_percentage = 1.0
        
        conflict_count = len(set(outcomes)) - 1 if len(outcomes) > 1 else 0
        
        timestamps = [s.get('timestamp', datetime.now().timestamp()) for s in sources]
        oldest_timestamp = min(timestamps) if timestamps else datetime.now().timestamp()
        time_since_event_hours = (datetime.now().timestamp() - oldest_timestamp) / 3600
        
        category_confidence = classification.get('confidence', 0.5)
        
        historical_accuracy = metadata.get('historical_accuracy', 0.85)
        
        data_values = [s.get('data', {}).get('value') for s in sources if 'value' in s.get('data', {})]
        if len(data_values) > 1:
            data_consistency_score = 1.0 - (np.std(data_values) / (np.mean(data_values) + 1e-6))
        else:
            data_consistency_score = 1.0
        
        social_sentiment = metadata.get('social_sentiment', 0.5)
        
        return ConfidenceFeatures(
            source_count=source_count,
            avg_credibility=avg_credibility,
            source_diversity=source_diversity,
            consensus_percentage=consensus_percentage,
            conflict_count=conflict_count,
            time_since_event_hours=time_since_event_hours,
            category_confidence=category_confidence,
            historical_accuracy=historical_accuracy,
            data_consistency_score=data_consistency_score,
            social_sentiment=social_sentiment,
        )
    
    def calculate_confidence(self, features: ConfidenceFeatures) -> Dict[str, Any]:
        try:
            result = self.scorer.score(features)
            return result
        
        except Exception as e:
            logger.error(f"Confidence calculation failed: {str(e)}", exc_info=True)
            raise
    
    def detect_fraud(self, proposal_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            result = self.fraud_detector.detect(proposal_data)
            return result
        
        except Exception as e:
            logger.error(f"Fraud detection failed: {str(e)}", exc_info=True)
            raise
    
    def _determine_time_sensitivity(self, category: str) -> str:
        high_sensitivity = ['sports', 'breaking_news', 'trading']
        medium_sensitivity = ['politics', 'elections', 'entertainment']
        
        if category in high_sensitivity:
            return 'high'
        elif category in medium_sensitivity:
            return 'medium'
        else:
            return 'low'
    
    def _determine_objectivity(self, category: str) -> str:
        objective = ['sports', 'weather', 'scientific']
        subjective = ['opinion', 'prediction', 'sentiment']
        
        if category in objective:
            return 'objective'
        elif category in subjective:
            return 'subjective'
        else:
            return 'mixed'