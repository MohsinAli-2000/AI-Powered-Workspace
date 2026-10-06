import logging
import sys

# The API spawns this process with its output redirected to a file; never let a non-ASCII filename or
# error message crash logging on a legacy Windows codepage.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stdout)
logger = logging.getLogger("process_job")


def main():
    if len(sys.argv) < 2:
        logger.error("Usage: python -m src.process_job <version_id>")
        sys.exit(1)

    version_id = sys.argv[1].strip()
    logger.info(f"Triggering processing for version_id: {version_id}")
    try:
        # Imported here (not at module level) so configuration/import errors are logged and reported as a
        # non-zero exit - the API then marks the version FAILED instead of leaving it QUEUED.
        from src.processor import processor

        res = processor.process_version(version_id)
        logger.info(f"Completed processing version {version_id}: {res}")
    except Exception as e:
        logger.error(f"Failed processing version {version_id}: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
