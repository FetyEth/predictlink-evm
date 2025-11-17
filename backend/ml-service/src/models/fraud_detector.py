import numpy as np
from typing import Dict, List, Any
from sklearn.ensemble import IsolationForest
import logging

logger = logging.getLogger(__name__)

class FraudDetector:
    def __init__(self):
        self.isolation_forest = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        
        self.risk_thresholds = {
            'low': 0.3,
            'medium': 0.6,
            'high': 0.8
        }
    
    def detect(self, proposal_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            features = self._extract_features(proposal_data)
            
            anomaly_score = self._calculate_anomaly_score(features)
            
            risk_factors = self._identify_risk_factors(proposal_data, features)
            
            risk_level = self._determine_risk_level(anomaly_score, risk_factors)
            
            is_fraudulent = anomaly_score > self.risk_thresholds['high']
            
            return {
                'is_fraudulent': is_fraudulent,
                'anomaly_score': float(anomaly_score),
                'risk_level': risk_level,
                'risk_factors': risk_factors,
                'confidence': float(1 - abs(anomaly_score - 0.5) * 2),
                'recommendation': 'reject' if is_fraudulent else 'approve'
            }
        
        except Exception as e:
            logger.error(f"Fraud detection failed: {str(e)}", exc_info=True)
            return {
                'is_fraudulent': False,
                'anomaly_score': 0.5,
                'risk_level': 'unknown',
                'risk_factors': [],
                'confidence': 0.0,
                'recommendation': 'manual_review'
            }
    
    def _extract_features(self, proposal_data: Dict[str, Any]) -> np.ndarray:
        features = []
        
        features.append(proposal_data.get('confidence_score', 0.5))
        
        features.append(len(proposal_data.get('sources', [])))
        
        features.append(proposal_data.get('time_since_event', 1.0))
        
        features.append(proposal_data.get('proposer_reputation', 0.5))
        
        features.append(proposal_data.get('source_diversity', 1))
        
        features.append(proposal_data.get('consensus_level', 0.5))
        
        features.append(proposal_data.get('timing_anomaly', 0.0))
        
        features.append(proposal_data.get('pattern_similarity', 0.0))
        
        return np.array(features).reshape(1, -1)
    
    def _calculate_anomaly_score(self, features: np.ndarray) -> float:
        try:
            score = self.isolation_forest.fit_predict(features)[0]
            
            normalized_score = (score + 1) / 2
            
            return normalized_score
        except Exception as e:
            logger.error(f"Anomaly score calculation failed: {str(e)}")
            return 0.5
    
    def _identify_risk_factors(
        self,
        proposal_data: Dict[str, Any],
        features: np.ndarray
    ) -> List[str]:
        risk_factors = []
        
        if proposal_data.get('confidence_score', 1.0) < 0.5:
            risk_factors.append('low_confidence')
        
        if len(proposal_data.get('sources', [])) < 2:
            risk_factors.append('insufficient_sources')
        
        if proposal_data.get('time_since_event', 100) < 0.1:
            risk_factors.append('premature_submission')
        
        if proposal_data.get('proposer_reputation', 1.0) < 0.3:
            risk_factors.append('low_proposer_reputation')
        
        if proposal_data.get('source_diversity', 10) < 2:
            risk_factors.append('low_source_diversity')
        
        if proposal_data.get('consensus_level', 1.0) < 0.5:
            risk_factors.append('low_consensus')
        
        if proposal_data.get('timing_anomaly', 0.0) > 0.7:
            risk_factors.append('suspicious_timing')
        
        if proposal_data.get('pattern_similarity', 0.0) > 0.8:
            risk_factors.append('coordination_suspected')
        
        return risk_factors
    
    def _determine_risk_level(
        self,
        anomaly_score: float,
        risk_factors: List[str]
    ) -> str:
        critical_factors = [
            'coordination_suspected',
            'suspicious_timing',
            'low_proposer_reputation'
        ]
        
        has_critical = any(factor in risk_factors for factor in critical_factors)
        
        if anomaly_score > self.risk_thresholds['high'] or has_critical:
            return 'high'
        elif anomaly_score > self.risk_thresholds['medium'] or len(risk_factors) >= 3:
            return 'medium'
        elif anomaly_score > self.risk_thresholds['low'] or len(risk_factors) >= 1:
            return 'low'
        else:
            return 'minimal'