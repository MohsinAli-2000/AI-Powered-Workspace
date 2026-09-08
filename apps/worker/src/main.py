import logging
import signal
import sys

from src.config import settings
from src.db import close_connection_pool
from src.queue_consumer import QueueConsumer

# Configure root logging with level from settings
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("worker")


def main():
    logger.info("Initializing AI Worker service...")
    consumer = QueueConsumer()

    # Graceful shutdown handler
    def handle_shutdown(signum, frame):
        signame = signal.Signals(signum).name
        logger.info(f"Received signal {signame}. Initiating graceful shutdown...")
        consumer.stop()
        close_connection_pool()
        logger.info("Worker shutdown complete.")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info("Starting QueueConsumer message loop...")
    try:
        consumer.start_consuming()
    finally:
        close_connection_pool()


if __name__ == "__main__":
    main()

