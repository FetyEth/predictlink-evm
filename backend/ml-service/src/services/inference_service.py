import asyncio
from typing import Dict, List, Any
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class InferenceService:
    def __init__(self, ml_service):
        self.ml_service = ml_service
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.cache = {}
        self.cache_ttl = 300
    
    async def batch_inference(
        self,
        requests: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        logger.info(f"Starting batch inference for {len(requests)} requests")
        
        tasks = [
            self._process_single_request(req)
            for req in requests
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = [r for r in results if not isinstance(r, Exception)]
        failed = [r for r in results if isinstance(r, Exception)]
        
        logger.info(f"Batch inference complete: {len(successful)} successful, {len(failed)} failed")
        
        return results
    
    async def _process_single_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        try:
            cache_key = self._generate_cache_key(request)
            
            cached_result = self._get_from_cache(cache_key)
            if cached_result:
                logger.debug(f"Cache hit for request: {cache_key}")
                return cached_result
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._synchronous_inference,
                request
            )
            
            self._add_to_cache(cache_key, result)
            
            return result
        
        except Exception as e:
            logger.error(f"Inference failed: {str(e)}", exc_info=True)
            raise
    
    def _synchronous_inference(self, request: Dict[str, Any]) -> Dict[str, Any]:
        classification = self.ml_service.classifier.classify(request['description'])
        
        features = self.ml_service.extract_features(
            request.get('sources', []),
            classification,
            request.get('metadata', {})
        )
        
        confidence_result = self.ml_service.scorer.score(features)
        
        fraud_result = self.ml_service.fraud_detector.detect(request)
        
        return {
            'event_id': request.get('event_id'),
            'classification': classification,
            'confidence': confidence_result,
            'fraud_detection': fraud_result,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _generate_cache_key(self, request: Dict[str, Any]) -> str:
        key_parts = [
            request.get('event_id', ''),
            request.get('description', '')[:50],
            str(len(request.get('sources', [])))
        ]
        return '_'.join(key_parts)
    
    def _get_from_cache(self, key: str) -> Any:
        if key in self.cache:
            entry = self.cache[key]
            if datetime.now().timestamp() - entry['timestamp'] < self.cache_ttl:
                return entry['data']
            else:
                del self.cache[key]
        return None
    
    def _add_to_cache(self, key: str, data: Any) -> None:
        self.cache[key] = {
            'data': data,
            'timestamp': datetime.now().timestamp()
        }
        
        self._clean_cache()
    
    def _clean_cache(self) -> None:
        current_time = datetime.now().timestamp()
        expired_keys = [
            key for key, entry in self.cache.items()
            if current_time - entry['timestamp'] >= self.cache_ttl
        ]
        
        for key in expired_keys:
            del self.cache[key]