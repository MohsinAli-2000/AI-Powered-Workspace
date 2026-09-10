import sys
import logging
from src.processor import processor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("process_job")

def main():
    if len(sys.argv) < 2:
        logger.error("Usage: python -m src.process_job <version_id>")
        sys.exit(1)

    version_id = sys.argv[1].strip()
    logger.info(f"Triggering processing for version_id: {version_id}")
    try:
        res = processor.process_version(version_id)
        logger.info(f"Completed processing version {version_id}: {res}")
    except Exception as e:
        logger.error(f"Failed processing version {version_id}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
