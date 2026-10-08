import logging
import threading
import time
from src.db import claim_next_queued_version
from src.processor import processor

logger = logging.getLogger("worker.db_poller")


class DbPoller(threading.Thread):
    """
    Background worker thread that continually checks PostgreSQL for QUEUED document versions.
    Uses SELECT ... FOR UPDATE SKIP LOCKED to claim jobs with multi-worker concurrency safety.
    """

    def __init__(self, poll_interval: float = 3.0):
        super().__init__(daemon=True, name="DbQueuePoller")
        self.poll_interval = poll_interval
        self._stop_event = threading.Event()

    def run(self):
        logger.info(
            f"Database queue poller started (interval: {self.poll_interval}s). "
            "Monitoring document_versions for QUEUED jobs..."
        )
        while not self._stop_event.is_set():
            try:
                version_id = claim_next_queued_version()
                if version_id:
                    logger.info(f"[DB Poller] Claimed queued document version {version_id} for processing.")
                    result = processor.process_version(version_id)
                    if result.get("skipped"):
                        logger.info(f"[DB Poller] Version {version_id} was already held; skipped duplicate.")
                        # Back off so a version that stays QUEUED is not re-selected in a hot loop.
                        self._stop_event.wait(self.poll_interval)
                    else:
                        chunks_count = result.get("chunks_count", 0)
                        logger.info(
                            f"[DB Poller] Successfully completed processing for version {version_id} "
                            f"({chunks_count} chunks generated)."
                        )
                    # Loop immediately to drain backlog if multiple jobs are queued
                    continue
            except Exception as e:
                logger.error(f"[DB Poller] Unexpected exception processing document version: {e}", exc_info=True)

            self._stop_event.wait(self.poll_interval)

    def stop(self):
        logger.info("Stopping database queue poller...")
        self._stop_event.set()
