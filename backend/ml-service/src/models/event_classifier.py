import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class EventClassifier:
    def __init__(self):
        self.categories = {
            'sports': ['game', 'match', 'score', 'team', 'player', 'win', 'lose', 'championship'],
            'politics': ['election', 'vote', 'poll', 'candidate', 'government', 'senate', 'congress'],
            'entertainment': ['movie', 'film', 'actor', 'award', 'show', 'release', 'box office'],
            'crypto': ['bitcoin', 'ethereum', 'blockchain', 'token', 'crypto', 'defi', 'nft'],
            'weather': ['temperature', 'rain', 'storm', 'hurricane', 'weather', 'forecast'],
            'economics': ['gdp', 'inflation', 'market', 'stock', 'economy', 'recession', 'growth'],
            'technology': ['software', 'hardware', 'ai', 'tech', 'launch', 'product', 'innovation'],
        }
        
        self.subcategories = {
            'sports': {
                'football': ['football', 'nfl', 'super bowl', 'quarterback'],
                'basketball': ['basketball', 'nba', 'finals', 'playoff'],
                'soccer': ['soccer', 'world cup', 'fifa', 'premier league'],
                'general': []
            },
            'politics': {
                'elections': ['election', 'vote', 'ballot', 'primary'],
                'legislation': ['bill', 'law', 'congress', 'senate'],
                'general': []
            }
        }
    
    def classify(self, description: str) -> Dict[str, Any]:
        description_lower = description.lower()
        
        category_scores = {}
        for category, keywords in self.categories.items():
            score = sum(1 for keyword in keywords if keyword in description_lower)
            if score > 0:
                category_scores[category] = score / len(keywords)
        
        if not category_scores:
            return self._default_classification()
        
        primary_category = max(category_scores, key=category_scores.get)
        confidence = category_scores[primary_category]
        
        subcategory = self._classify_subcategory(primary_category, description_lower)
        
        recommended_action = self._recommend_action(confidence, primary_category)
        
        return {
            'primaryCategory': primary_category,
            'subcategory': subcategory,
            'confidence': min(confidence * 1.5, 1.0),
            'timeSensitivity': self._get_time_sensitivity(primary_category),
            'objectivity': self._get_objectivity(primary_category),
            'recommendedAction': recommended_action,
        }
    
    def _classify_subcategory(self, category: str, description: str) -> str:
        if category not in self.subcategories:
            return 'general'
        
        subcats = self.subcategories[category]
        for subcat, keywords in subcats.items():
            if subcat == 'general':
                continue
            if any(keyword in description for keyword in keywords):
                return subcat
        
        return 'general'
    
    def _recommend_action(self, confidence: float, category: str) -> str:
        if confidence >= 0.95:
            return 'auto_process'
        elif confidence >= 0.7:
            if category in ['sports', 'weather']:
                return 'auto_process'
            else:
                return 'human_review'
        else:
            return 'human_review'
    
    def _get_time_sensitivity(self, category: str) -> str:
        high = ['sports', 'weather', 'breaking_news']
        medium = ['politics', 'entertainment', 'technology']
        
        if category in high:
            return 'high'
        elif category in medium:
            return 'medium'
        else:
            return 'low'
    
    def _get_objectivity(self, category: str) -> str:
        objective = ['sports', 'weather', 'economics']
        subjective = ['entertainment', 'politics']
        
        if category in objective:
            return 'objective'
        elif category in subjective:
            return 'subjective'
        else:
            return 'mixed'
    
    def _default_classification(self) -> Dict[str, Any]:
        return {
            'primaryCategory': 'general',
            'subcategory': 'unknown',
            'confidence': 0.5,
            'timeSensitivity': 'low',
            'objectivity': 'mixed',
            'recommendedAction': 'human_review',
        }